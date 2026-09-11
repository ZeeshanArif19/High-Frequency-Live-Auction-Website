import { pool } from '../db/pool.js';
import redis from '../redis/client.js';
import { initializeAuctionState } from '../redis/scripts/index.js';

export const AUCTION_STATUSES = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  SETTLED: 'SETTLED',
  UNSOLD: 'UNSOLD',
});

const PAYMENT_WINDOW = "15 minutes";

async function transitionScheduledAuction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, current_max_bid
      FROM auctions
      WHERE status = 'SCHEDULED'
        AND start_time <= CURRENT_TIMESTAMP
      ORDER BY start_time ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const auction = rows[0];
    await client.query(
      `UPDATE auctions SET status = 'LIVE' WHERE id = $1 AND status = 'SCHEDULED'`,
      [auction.id]
    );
    await client.query('COMMIT');
    await initializeAuctionState(auction.id, auction.current_max_bid);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transitionEndedAuction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id
      FROM auctions
      WHERE status = 'LIVE'
        AND end_time <= CURRENT_TIMESTAMP
      ORDER BY end_time ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const auctionId = rows[0].id;
    const winnerResult = await client.query(`
      SELECT id, user_id, bid_amount
      FROM bids
      WHERE auction_id = $1
      ORDER BY bid_amount DESC, accepted_at ASC, id ASC
      LIMIT 1
    `, [auctionId]);
    const winner = winnerResult.rows[0] ?? null;

    await client.query(`
      UPDATE auctions
      SET status = 'ENDED',
          ended_at = CURRENT_TIMESTAMP,
          winner_user_id = $2::varchar,
          winning_bid_id = $3::uuid,
          payment_deadline = CASE
            WHEN $2 IS NULL THEN NULL
            ELSE CURRENT_TIMESTAMP + $4::interval
          END
      WHERE id = $1 AND status = 'LIVE'
    `, [auctionId, winner?.user_id ?? null, winner?.id ?? null, PAYMENT_WINDOW]);

    if (winner) {
      await client.query(`
        INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
        SELECT id, winner_user_id::uuid, winning_bid_id, payment_deadline
        FROM auctions
        WHERE id = $1
        ON CONFLICT (auction_id, bid_id) DO NOTHING
      `, [auctionId]);
    }

    await client.query('COMMIT');
    await redis.del(`auction:${auctionId}:max_bid`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transitionPaymentPendingAuction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, winner_user_id, winning_bid_id, payment_deadline
      FROM auctions
      WHERE status = 'ENDED'
        AND winner_user_id IS NOT NULL
        AND payment_deadline > CURRENT_TIMESTAMP
      ORDER BY payment_deadline ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const auction = rows[0];
    await client.query(`
      INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (auction_id, bid_id) DO NOTHING
    `, [auction.id, auction.winner_user_id, auction.winning_bid_id, auction.payment_deadline]);
    await client.query(
      `UPDATE auctions SET status = 'PAYMENT_PENDING' WHERE id = $1 AND status = 'ENDED'`,
      [auction.id]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transitionExpiredPaymentAuction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, winner_user_id, winning_bid_id
      FROM auctions
      WHERE status = 'PAYMENT_PENDING'
        AND payment_deadline < CURRENT_TIMESTAMP
      ORDER BY payment_deadline ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const auction = rows[0];
    await client.query(`
      INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
      VALUES ($1, $2, $3, (SELECT payment_deadline FROM auctions WHERE id = $1))
      ON CONFLICT (auction_id, bid_id) DO NOTHING
    `, [auction.id, auction.winner_user_id, auction.winning_bid_id]);
    const claimResult = await client.query(`
      UPDATE auction_payment_claims
      SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP
      WHERE auction_id = $1 AND bid_id = $2 AND status = 'PAYMENT_PENDING'
      RETURNING id
    `, [auction.id, auction.winning_bid_id]);
    if (claimResult.rows[0]) {
      await client.query(`
        UPDATE payments
        SET status = 'PAYMENT_EXPIRED', updated_at = CURRENT_TIMESTAMP
        WHERE claim_id = $1 AND status = 'PAYMENT_PENDING'
      `, [claimResult.rows[0].id]);
    }

    const nextBidResult = await client.query(`
      SELECT b.id, b.user_id
      FROM bids b
      WHERE b.auction_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM auction_payment_claims c
          WHERE c.auction_id = b.auction_id
            AND c.user_id::text = b.user_id
            AND c.status IN ('PAYMENT_PENDING', 'EXPIRED', 'PAID')
        )
      ORDER BY b.bid_amount DESC, b.accepted_at ASC, b.id ASC
      LIMIT 1
    `, [auction.id]);
    const nextBid = nextBidResult.rows[0];

    if (nextBid) {
      await client.query(`
        UPDATE auctions
        SET winner_user_id = $2, winning_bid_id = $3,
            payment_deadline = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
        WHERE id = $1 AND status = 'PAYMENT_PENDING'
      `, [auction.id, nextBid.user_id, nextBid.id]);
      await client.query(`
        INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
        SELECT id, winner_user_id::uuid, winning_bid_id, payment_deadline
        FROM auctions
        WHERE id = $1
      `, [auction.id]);
    } else {
      await client.query(`
        UPDATE auctions
        SET status = 'UNSOLD', winner_user_id = NULL, winning_bid_id = NULL,
            payment_deadline = NULL
        WHERE id = $1 AND status = 'PAYMENT_PENDING'
      `, [auction.id]);
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function hydrateLiveAuctionState() {
  const { rows } = await pool.query(`
    SELECT id, current_max_bid
    FROM auctions
    WHERE status = 'LIVE'
  `);

  for (const auction of rows) {
    await initializeAuctionState(auction.id, auction.current_max_bid);
  }
}

export async function processAuctionLifecycle() {
  let changed = false;

  while (await transitionScheduledAuction()) changed = true;
  while (await transitionEndedAuction()) changed = true;
  if (await transitionPaymentPendingAuction()) changed = true;
  while (await transitionExpiredPaymentAuction()) changed = true;

  return changed;
}

export async function initializeAuctionLifecycle() {
  await processAuctionLifecycle();
  await hydrateLiveAuctionState();
}
