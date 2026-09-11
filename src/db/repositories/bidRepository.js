/**
 * src/db/repositories/bidRepository.js
 *
 * Data-access layer for bid persistence (AGENTS.md §3, STEP-07).
 *
 * Exported functions:
 *  - insertBid({ auctionId, userId, bidAmount }, [client])
 *      Inserts a new row into the `bids` table.
 *
 *  - updateAuctionMaxBid({ auctionId, bidAmount }, [client])
 *      Updates `auctions.current_max_bid` when the incoming bid exceeds
 *      the currently stored value (server-side comparison in SQL).
 *
 * Both functions accept an optional `client` parameter so that callers can
 * compose them inside a shared transaction (pool.connect() client).
 * When no client is provided they fall back to the singleton pool.
 */

import { pool } from '../pool.js';

// ── insertBid ─────────────────────────────────────────────────────────────────

/**
 * Insert a bid record into the `bids` table.
 *
 * @param {{ auctionId: string, userId: string, bidAmount: number }} params
 * @param {import('pg').PoolClient} [client] - Transactional client (optional).
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function insertBid({ auctionId, userId, bidAmount, acceptedAt }, client) {
  const executor = client ?? pool;

  const sql = `
    INSERT INTO bids (auction_id, user_id, bid_amount, accepted_at)
    VALUES ($1, $2, $3, COALESCE($4::timestamptz, CURRENT_TIMESTAMP))
    RETURNING id, auction_id, user_id, bid_amount, created_at, accepted_at
  `;

  return executor.query(sql, [auctionId, userId, bidAmount, acceptedAt ?? null]);
}

// ── updateAuctionMaxBid ───────────────────────────────────────────────────────

/**
 * Update `auctions.current_max_bid` only when `bidAmount` exceeds the
 * currently stored value (atomic guard via WHERE clause).
 *
 * @param {{ auctionId: string, bidAmount: number }} params
 * @param {import('pg').PoolClient} [client] - Transactional client (optional).
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function updateAuctionMaxBid({ auctionId, bidAmount }, client) {
  const executor = client ?? pool;

  const sql = `
    UPDATE auctions
    SET    current_max_bid = $2
    WHERE  id = $1
      AND  $2 > current_max_bid
    RETURNING id, current_max_bid
  `;

  return executor.query(sql, [auctionId, bidAmount]);
}
