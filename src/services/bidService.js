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

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch the auction row only when it exists AND has not yet expired.
 * The expiry guard is applied server-side so that clock skew between
 * application servers cannot produce inconsistent results.
 *
 * @param {string} auctionId
 * @returns {Promise<object|null>} Auction row or null if not found / expired.
 */
async function fetchActiveAuction(auctionId) {
  const sql = `
    SELECT id, item_name, starting_price, current_max_bid, end_time, owner_id
    FROM   auctions
    WHERE  id       = $1
      AND  end_time > NOW()
  `;

  const { rows } = await pool.query(sql, [auctionId]);
  return rows[0] ?? null;
}

// ── Exported service ──────────────────────────────────────────────────────────

/**
 * Attempt to submit a bid for the given auction.
 *
 * @param {{ auctionId: string, userId: string, bidAmount: number }} params
 * @returns {Promise<{ accepted: true } | { accepted: false, reason: string }>}
 */
export async function submitBid({ auctionId, userId, bidAmount }) {
  // ── Step 1: Verify the auction exists and is still active ─────────────────
  const auction = await fetchActiveAuction(auctionId);

  if (!auction) {
    return {
      accepted: false,
      reason: 'Auction not found or has already ended.',
    };
  }

  // ── Step 1b: Verify bidder is not the auction owner ───────────────────────
  if (auction.owner_id && auction.owner_id === userId) {
    return {
      accepted: false,
      reason: 'You cannot place a bid on your own auction.',
    };
  }

  // ── Step 2: Atomically compare-and-set via Redis Lua script ───────────────
  const accepted = await tryPlaceBid(auctionId, bidAmount);

  if (!accepted) {
    return {
      accepted: false,
      reason: 'Bid amount must exceed the current maximum bid.',
    };
  }

  // ── Step 3: Publish to bid_persist_queue for async DB persistence ─────────
  const payload = Buffer.from(
    JSON.stringify({ auctionId, userId, bidAmount })
  );

  channel.sendToQueue(config.rabbitmq.bidQueue, payload, {
    persistent: true, // survive broker restart
    contentType: 'application/json',
  });

  // ── Step 4: Return acceptance confirmation ────────────────────────────────
  return { accepted: true };
}
