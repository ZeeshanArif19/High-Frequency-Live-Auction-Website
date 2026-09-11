import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import redis from '../redis/client.js';
import { channel, connection } from '../mq/connection.js';
import { startBidConsumer } from '../mq/consumers/bidConsumer.js';
import { submitBid } from '../services/bidService.js';
import {
  AUCTION_STATUSES,
  initializeAuctionLifecycle,
  processAuctionLifecycle,
} from '../services/auctionLifecycleService.js';
import { createPaymentOrder as initiateAuctionPayment } from '../services/paymentService.js';
import { initializeAuctionState } from '../redis/scripts/index.js';

const auctionIds = [];
const userIds = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBid(auctionId, bidAmount) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await pool.query(
      'SELECT * FROM bids WHERE auction_id = $1 AND bid_amount = $2',
      [auctionId, bidAmount]
    );
    if (result.rows[0]) return result.rows[0];
    await sleep(100);
  }
  throw new Error(`Timed out waiting for bid ${bidAmount}`);
}

async function createUser() {
  const id = randomUUID();
  userIds.push(id);
  await pool.query(
    `INSERT INTO users (id, email, username, password_hash, role)
     VALUES ($1, $2, $3, 'test-hash', 'USER')`,
    [id, `${id}@lifecycle.test`, `lc_${id.slice(0, 8)}`]
  );
  return id;
}

async function createAuction({ ownerId, status, startOffsetMs, endOffsetMs, title }) {
  const result = await pool.query(`
    INSERT INTO auctions (
      title, item_name, starting_price, current_max_bid, start_time, end_time,
      minimum_bid_increment, description, owner_id, status
    )
    VALUES ($1, $1, 100, 100, CURRENT_TIMESTAMP + ($2 * INTERVAL '1 millisecond'),
            CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'), 10, 'Lifecycle test', $4, $5)
    RETURNING id
  `, [title, startOffsetMs, endOffsetMs, ownerId, status]);
  const id = result.rows[0].id;
  auctionIds.push(id);
  return id;
}

async function insertBid(auctionId, userId, amount, acceptedAt) {
  const result = await pool.query(
    `INSERT INTO bids (auction_id, user_id, bid_amount, accepted_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [auctionId, userId, amount, acceptedAt]
  );
  await pool.query(
    'UPDATE auctions SET current_max_bid = GREATEST(current_max_bid, $2) WHERE id = $1',
    [auctionId, amount]
  );
  return result.rows[0].id;
}

async function run() {
  const ownerId = await createUser();
  const bidderA = await createUser();
  const bidderB = await createUser();
  await startBidConsumer(channel);

  const scheduledId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.SCHEDULED,
    startOffsetMs: 600000,
    endOffsetMs: 1200000,
    title: 'Scheduled rejects bids',
  });
  const scheduledBid = await submitBid({ auctionId: scheduledId, userId: bidderA, bidAmount: 150 });
  assert.equal(scheduledBid.accepted, false);
  assert.match(scheduledBid.reason, /not started/i);

  const liveId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.LIVE,
    startOffsetMs: -600000,
    endOffsetMs: 600000,
    title: 'Live accepts bids',
  });
  await initializeAuctionState(liveId, 100);
  const liveBid = await submitBid({ auctionId: liveId, userId: bidderA, bidAmount: 150 });
  assert.equal(liveBid.accepted, true);
  await waitForBid(liveId, 150);

  for (const status of [AUCTION_STATUSES.ENDED, AUCTION_STATUSES.PAYMENT_PENDING, AUCTION_STATUSES.SETTLED]) {
    const id = await createAuction({
      ownerId,
      status,
      startOffsetMs: -1200000,
      endOffsetMs: -600000,
      title: `${status} rejects bids`,
    });
    const result = await submitBid({ auctionId: id, userId: bidderA, bidAmount: 200 });
    assert.equal(result.accepted, false, `${status} must reject bids`);
  }

  const autoStartId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.SCHEDULED,
    startOffsetMs: -1000,
    endOffsetMs: 600000,
    title: 'Automatic start',
  });
  await processAuctionLifecycle();
  let state = (await pool.query('SELECT status FROM auctions WHERE id = $1', [autoStartId])).rows[0];
  assert.equal(state.status, AUCTION_STATUSES.LIVE);
  assert.equal(await redis.get(`auction:${autoStartId}:max_bid`), '100');

  const autoEndId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.LIVE,
    startOffsetMs: -1200000,
    endOffsetMs: -1000,
    title: 'Automatic end',
  });
  await initializeAuctionState(autoEndId, 100);
  await processAuctionLifecycle();
  state = (await pool.query('SELECT status FROM auctions WHERE id = $1', [autoEndId])).rows[0];
  assert.equal(state.status, AUCTION_STATUSES.ENDED);
  assert.equal(await redis.get(`auction:${autoEndId}:max_bid`), null);

  const winnerId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.LIVE,
    startOffsetMs: -1200000,
    endOffsetMs: -1000,
    title: 'Deterministic winner',
  });
  const firstTime = new Date(Date.now() - 3000).toISOString();
  const secondTime = new Date(Date.now() - 2000).toISOString();
  const firstBidId = await insertBid(winnerId, bidderA, 500, firstTime);
  await insertBid(winnerId, bidderB, 500, secondTime);
  const higherBidId = await insertBid(winnerId, bidderB, 700, new Date(Date.now() - 1000).toISOString());
  await processAuctionLifecycle();
  state = (await pool.query(
    'SELECT status, winner_user_id, winning_bid_id FROM auctions WHERE id = $1',
    [winnerId]
  )).rows[0];
  assert.equal(state.status, AUCTION_STATUSES.PAYMENT_PENDING);
  assert.equal(state.winner_user_id, bidderB);
  assert.equal(state.winning_bid_id, higherBidId);
  assert.notEqual(state.winning_bid_id, firstBidId);

  await processAuctionLifecycle();
  const repeatedState = (await pool.query(
    'SELECT status, winner_user_id, winning_bid_id FROM auctions WHERE id = $1',
    [winnerId]
  )).rows[0];
  assert.deepEqual(repeatedState, state, 'repeated end processing must be idempotent');

  const payment = await initiateAuctionPayment({ auctionId: winnerId, userId: bidderB });
  assert.equal(payment.status, 'PAYMENT_PENDING');
  assert.equal(
    (await pool.query('SELECT status FROM auctions WHERE id = $1', [winnerId])).rows[0].status,
    AUCTION_STATUSES.PAYMENT_PENDING
  );

  const boundaryId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.LIVE,
    startOffsetMs: -1000,
    endOffsetMs: 1000,
    title: 'Expiry boundary',
  });
  await initializeAuctionState(boundaryId, 100);
  assert.equal((await submitBid({ auctionId: boundaryId, userId: bidderA, bidAmount: 125 })).accepted, true);
  await waitForBid(boundaryId, 125);
  await pool.query('UPDATE auctions SET end_time = CURRENT_TIMESTAMP - INTERVAL \'1 millisecond\' WHERE id = $1', [boundaryId]);
  assert.equal((await submitBid({ auctionId: boundaryId, userId: bidderB, bidAmount: 150 })).accepted, false);

  const restartId = await createAuction({
    ownerId,
    status: AUCTION_STATUSES.LIVE,
    startOffsetMs: -1000,
    endOffsetMs: 600000,
    title: 'Restart hydration',
  });
  await initializeAuctionState(restartId, 100);
  await redis.del(`auction:${restartId}:max_bid`);
  await initializeAuctionLifecycle();
  assert.equal(await redis.get(`auction:${restartId}:max_bid`), '100');

  console.log('All auction lifecycle tests passed.');
}

try {
  await run();
} finally {
  await pool.query('DELETE FROM auctions WHERE id = ANY($1::uuid[])', [auctionIds]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  for (const id of auctionIds) await redis.del(`auction:${id}:max_bid`);
  await redis.quit();
  await pool.end();
  try { await channel.close(); } catch {}
  try { await connection.close(); } catch {}
}
