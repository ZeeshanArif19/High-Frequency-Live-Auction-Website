/**
 * src/mq/consumers/bidConsumer.js
 *
 * RabbitMQ consumer that drains `bid_persist_queue` and persists bids to
 * PostgreSQL (AGENTS.md §5, STEP-07).
 *
 * Flow per message:
 *  1. Deserialize the JSON payload.
 *  2. Acquire a pool client and open a BEGIN transaction.
 *  3. Call insertBid  — write the new bid row.
 *  4. Call updateAuctionMaxBid — raise current_max_bid if this bid wins.
 *  5. COMMIT → channel.ack(msg).
 *  6. On any failure: ROLLBACK → channel.nack(msg, false, false)
 *     (requeue: false — routes to DLX per AGENTS.md §5).
 *
 * Exported function:
 *  - startBidConsumer(channel) — begins consuming from the configured queue.
 */

import { pool } from '../../db/pool.js';
import { insertBid, updateAuctionMaxBid } from '../../db/repositories/bidRepository.js';
import { config } from '../../config/index.js';
import { broadcastBidUpdate } from '../../ws/server.js';

// Queue name sourced from config — never hardcoded (AGENTS.md §5).
const BID_QUEUE = config.rabbitmq.bidQueue;

/**
 * Start consuming from `bid_persist_queue`.
 *
 * @param {import('amqplib').Channel} channel - Live RabbitMQ channel.
 * @returns {Promise<void>}
 */
export async function startBidConsumer(channel) {
  // Process one message at a time to avoid overwhelming the DB pool.
  channel.prefetch(1);

  await channel.consume(BID_QUEUE, async (msg) => {
    if (msg === null) {
      // Consumer was cancelled by the broker — nothing to process.
      return;
    }

    let payload;

    // ── 1. Deserialize ──────────────────────────────────────────────────────
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (err) {
      console.error('[BidConsumer] Failed to parse message payload:', err.message);
      // Malformed JSON — send to DLX immediately, do not requeue.
      channel.nack(msg, false, false);
      return;
    }

    const { auctionId, userId, bidAmount } = payload;

    // ── 2. Acquire transactional client ─────────────────────────────────────
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── 3. Persist the bid row ───────────────────────────────────────────
      await insertBid({ auctionId, userId, bidAmount }, client);

      // ── 4. Conditionally raise the auction max bid ───────────────────────
      await updateAuctionMaxBid({ auctionId, bidAmount }, client);

      // ── 5. Commit and ACK ────────────────────────────────────────────────
      await client.query('COMMIT');
      channel.ack(msg);

      console.log(
        `[BidConsumer] ACK  auction=${auctionId} user=${userId} amount=${bidAmount}`
      );

      // ── Broadcast update post-ACK (STEP-10) ───────────────────────────────
      broadcastBidUpdate(auctionId, bidAmount);
    } catch (err) {
      // ── 6. Rollback and NACK (requeue: false → DLX) ─────────────────────
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[BidConsumer] ROLLBACK failed:', rollbackErr.message);
      }

      console.error(
        `[BidConsumer] NACK auction=${auctionId} user=${userId} amount=${bidAmount}:`,
        err.message
      );

      // requeue=false — message routes to dead-letter exchange (AGENTS.md §5).
      channel.nack(msg, false, false);
    } finally {
      // Always release the client back to the pool (AGENTS.md §3).
      client.release();
    }
  });

  console.log(`[BidConsumer] Listening on queue "${BID_QUEUE}".`);
}
