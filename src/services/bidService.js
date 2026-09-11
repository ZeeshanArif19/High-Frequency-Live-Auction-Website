/**
 * src/services/bidService.js
 *
 * Core business logic for bid submission (AGENTS.md §6, STEP-08).
 *
 * Orchestrates the following pipeline for every incoming bid:
 *  1. Validate that the auction exists and has not yet ended (server-side SQL check).
 *  2. Atomically attempt to place the bid via the Redis Lua script (tryPlaceBid).
 *  3. On acceptance, publish the bid payload to bid_persist_queue for async DB persistence.
 *  4. Return a structured result object — never throws to the caller.
 *
 * Rules enforced:
 *  - No direct DB writes — persistence is the consumer's responsibility (AGENTS.md §7).
 *  - Auction expiry is evaluated server-side via NOW() in the SQL WHERE clause (TASK.md §STEP-08).
 *  - Queue name is sourced from config — never hardcoded (AGENTS.md §5).
 */

import { pool } from '../db/pool.js';
import { tryPlaceBid } from '../redis/scripts/index.js';
import { channel } from '../mq/connection.js';
import { config } from '../config/index.js';

// ── Exported service ──────────────────────────────────────────────────────────

/**
 * Attempt to submit a bid for the given auction.
 *
 * @param {{ auctionId: string, userId: string, bidAmount: number }} params
 * @returns {Promise<{ accepted: true } | { accepted: false, reason: string }>}
 */
export async function submitBid({ auctionId, userId, bidAmount }) {
  const client = await pool.connect();
  let committed = false;

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, status, owner_id,
             CURRENT_TIMESTAMP < start_time AS before_start,
             CURRENT_TIMESTAMP >= end_time AS after_end,
             CURRENT_TIMESTAMP AS accepted_at
      FROM auctions
      WHERE id = $1
      FOR UPDATE
    `, [auctionId]);

    const auction = rows[0];
    if (!auction) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'Auction not found.' };
    }

    if (auction.status === 'SCHEDULED' || auction.before_start) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'Auction has not started yet.' };
    }

    if (auction.status !== 'LIVE' || auction.after_end) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'Auction is not accepting bids.' };
    }

    if (auction.owner_id && auction.owner_id === userId) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'You cannot place a bid on your own auction.' };
    }

    const accepted = await tryPlaceBid(auctionId, bidAmount);
    if (!accepted) {
      await client.query('ROLLBACK');
      return { accepted: false, reason: 'Bid amount must exceed the current maximum bid.' };
    }

    const payload = Buffer.from(JSON.stringify({
      auctionId,
      userId,
      bidAmount,
      acceptedAt: auction.accepted_at.toISOString(),
    }));

    channel.sendToQueue(config.rabbitmq.bidQueue, payload, {
      persistent: true,
      contentType: 'application/json',
    });

    await client.query('COMMIT');
    committed = true;
    return { accepted: true };
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}
