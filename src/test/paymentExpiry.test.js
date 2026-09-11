import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import redis from '../redis/client.js';
import { channel, connection } from '../mq/connection.js';
import {
  AUCTION_STATUSES,
  initializeAuctionLifecycle,
  processAuctionLifecycle,
} from '../services/auctionLifecycleService.js';
import { createPaymentOrder, processSandboxWebhook } from '../services/paymentService.js';
import { SANDBOX_PAYMENT_EVENTS } from '../services/sandboxPaymentProvider.js';

const auctionIds = [];
const userIds = [];

async function createUser(label) {
  const id = randomUUID();
  userIds.push(id);
  await pool.query(
    `INSERT INTO users (id, email, username, password_hash, role)
     VALUES ($1, $2, $3, 'test-hash', $4)`,
    [id, `${id}@expiry.test`, `expiry_${label}_${id.slice(0, 8)}`, 'USER']
  );
  return id;
}

async function createPendingAuction(ownerId, bids, deadline = "CURRENT_TIMESTAMP + INTERVAL '15 minutes'") {
  const auctionResult = await pool.query(`
    INSERT INTO auctions (
      title, item_name, starting_price, current_max_bid, start_time, end_time,
      minimum_bid_increment, description, owner_id, status, payment_deadline
    )
    VALUES ($1, $1, 100, 100, CURRENT_TIMESTAMP - INTERVAL '2 hours',
            CURRENT_TIMESTAMP - INTERVAL '1 hour', 10, 'Expiry test', $2,
            'PAYMENT_PENDING', ${deadline})
    RETURNING id
  `, [`Expiry ${randomUUID()}`, ownerId]);
  const auctionId = auctionResult.rows[0].id;
  auctionIds.push(auctionId);

  const bidRows = [];
  for (const bid of bids) {
    const bidResult = await pool.query(`
      INSERT INTO bids (auction_id, user_id, bid_amount, accepted_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second'))
      RETURNING id
    `, [auctionId, bid.userId, bid.amount, bid.ageSeconds ?? 0]);
    bidRows.push({ ...bid, id: bidResult.rows[0].id });
  }

  const winner = bidRows[0];
  await pool.query(`
    UPDATE auctions
    SET current_max_bid = $2, winner_user_id = $3, winning_bid_id = $4
    WHERE id = $1
  `, [auctionId, winner.amount, winner.userId, winner.id]);
  await pool.query(`
    INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
    SELECT id, winner_user_id::uuid, winning_bid_id, payment_deadline
    FROM auctions WHERE id = $1
  `, [auctionId]);
  return { id: auctionId, winnerBid: winner, bidRows };
}

async function sendSuccess(payment, eventId = randomUUID()) {
  return processSandboxWebhook({
    eventId,
    event: SANDBOX_PAYMENT_EVENTS.SUCCEEDED,
    orderId: payment.provider_order_id,
    paymentId: `sandbox_payment_${randomUUID()}`,
    amount: payment.amount,
  });
}

async function state(auctionId) {
  return (await pool.query(
    `SELECT status, winner_user_id, winning_bid_id, payment_deadline
     FROM auctions WHERE id = $1`,
    [auctionId]
  )).rows[0];
}

async function run() {
  const ownerId = await createUser('owner');
  const winnerId = await createUser('winner');
  const secondId = await createUser('second');
  const thirdId = await createUser('third');

  const paysBeforeDeadline = await createPendingAuction(ownerId, [
    { userId: winnerId, amount: 500 },
  ]);
  const earlyPayment = await createPaymentOrder({ auctionId: paysBeforeDeadline.id, userId: winnerId });
  await sendSuccess(earlyPayment);
  assert.equal((await state(paysBeforeDeadline.id)).status, AUCTION_STATUSES.SETTLED);

  const expires = await createPendingAuction(ownerId, [
    { userId: winnerId, amount: 700 },
    { userId: secondId, amount: 600, ageSeconds: 1 },
  ]);
  const expiredPayment = await createPaymentOrder({ auctionId: expires.id, userId: winnerId });
  await pool.query(`
    UPDATE auctions
    SET payment_deadline = CURRENT_TIMESTAMP - INTERVAL '1 second'
    WHERE id = $1
  `, [expires.id]);
  await processAuctionLifecycle();
  let current = await state(expires.id);
  assert.equal(current.status, AUCTION_STATUSES.PAYMENT_PENDING);
  assert.equal(current.winner_user_id, secondId);
  assert.equal((await pool.query(
    "SELECT status FROM payments WHERE id = $1", [expiredPayment.id]
  )).rows[0].status, 'PAYMENT_EXPIRED');
  assert.equal((await pool.query(
    `SELECT status FROM auction_payment_claims
     WHERE auction_id = $1 AND user_id = $2`, [expires.id, winnerId]
  )).rows[0].status, 'EXPIRED');

  const secondPayment = await createPaymentOrder({ auctionId: expires.id, userId: secondId });
  await sendSuccess(secondPayment);
  assert.equal((await state(expires.id)).status, AUCTION_STATUSES.SETTLED);
  assert.equal((await state(expires.id)).winner_user_id, secondId);

  const unsold = await createPendingAuction(ownerId, [
    { userId: winnerId, amount: 800 },
  ], "CURRENT_TIMESTAMP - INTERVAL '1 second'");
  await processAuctionLifecycle();
  assert.equal((await state(unsold.id)).status, AUCTION_STATUSES.UNSOLD);

  const nearDeadline = await createPendingAuction(ownerId, [
    { userId: thirdId, amount: 900 },
  ], "CURRENT_TIMESTAMP + INTERVAL '1 minute'");
  const nearPayment = await createPaymentOrder({ auctionId: nearDeadline.id, userId: thirdId });
  await sendSuccess(nearPayment);
  assert.equal((await state(nearDeadline.id)).status, AUCTION_STATUSES.SETTLED);

  const duplicatePayment = await sendSuccess(nearPayment, randomUUID());
  assert.equal(duplicatePayment.duplicate, true);
  assert.equal((await pool.query(
    "SELECT COUNT(*)::int AS count FROM payments WHERE auction_id = $1 AND status = 'PAID'",
    [nearDeadline.id]
  )).rows[0].count, 1);
  assert.equal((await state(nearDeadline.id)).status, AUCTION_STATUSES.SETTLED);

  const concurrent = await createPendingAuction(ownerId, [
    { userId: winnerId, amount: 1000 },
    { userId: secondId, amount: 900, ageSeconds: 1 },
  ]);
  const concurrentPayment = await createPaymentOrder({ auctionId: concurrent.id, userId: winnerId });
  await pool.query(`
    UPDATE auctions
    SET payment_deadline = CURRENT_TIMESTAMP - INTERVAL '1 second'
    WHERE id = $1
  `, [concurrent.id]);
  const concurrentResults = await Promise.allSettled([
    sendSuccess(concurrentPayment),
    processAuctionLifecycle(),
  ]);
  assert.equal(concurrentResults.filter((result) => result.status === 'rejected').length, 1);
  current = await state(concurrent.id);
  assert.equal(current.status, AUCTION_STATUSES.PAYMENT_PENDING);
  assert.equal(current.winner_user_id, secondId);

  const duplicateTimeout = await processAuctionLifecycle();
  assert.equal(duplicateTimeout, false);
  assert.equal((await state(concurrent.id)).winner_user_id, secondId);

  const restart = await createPendingAuction(ownerId, [
    { userId: winnerId, amount: 1100 },
    { userId: thirdId, amount: 1000, ageSeconds: 1 },
  ], "CURRENT_TIMESTAMP - INTERVAL '1 second'");
  await initializeAuctionLifecycle();
  assert.equal((await state(restart.id)).winner_user_id, thirdId);
  assert.equal((await state(restart.id)).status, AUCTION_STATUSES.PAYMENT_PENDING);

  console.log('All payment expiry tests passed.');
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
