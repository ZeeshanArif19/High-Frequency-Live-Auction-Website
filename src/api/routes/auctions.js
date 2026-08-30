/**
 * src/api/routes/auctions.js
 *
 * Route definitions for auction queries and bid submissions (AGENTS.md §6, TASK.md §STEP-09).
 * Route handlers are thin wrappers that wire validation, database queries, and service calls.
 */

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { submitBid } from '../../services/bidService.js';
import { validate } from '../middleware/validate.js';

export const router = Router();

// ── Validation Schemas ────────────────────────────────────────────────────────

const auctionParamsSchema = z.object({
  id: z.string().uuid('Invalid auction ID format. Must be a valid UUID.'),
});

const submitBidBodySchema = z.object({
  userId: z.string({ required_error: 'userId is required' }).trim().min(1, 'userId cannot be empty'),
  bidAmount: z.number({ required_error: 'bidAmount is required' })
    .positive('bidAmount must be greater than 0')
    .finite('bidAmount must be a finite decimal'),
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /auctions/:id
 * Fetches auction details from PostgreSQL.
 */
router.get(
  '/:id',
  validate({ params: auctionParamsSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const sql = `
        SELECT id, item_name, starting_price, current_max_bid, end_time
        FROM   auctions
        WHERE  id = $1
      `;

      const { rows } = await pool.query(sql, [id]);

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Auction not found',
        });
      }

      return res.status(200).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auctions/:id/bids
 * Submits a new bid to the auction pipeline.
 *
 * Returns:
 *  - 202 Accepted on success (bid entered pipeline)
 *  - 409 Conflict if rejected by Redis (outbid / lower bid)
 *  - 404 Not Found if auction does not exist or has expired
 */
router.post(
  '/:id/bids',
  validate({ params: auctionParamsSchema, body: submitBidBodySchema }),
  async (req, res, next) => {
    try {
      const { id: auctionId } = req.params;
      const { userId, bidAmount } = req.body;

      const result = await submitBid({
        auctionId,
        userId,
        bidAmount,
      });

      if (result.accepted) {
        return res.status(202).json({
          accepted: true,
          message: 'Bid accepted and queued for processing',
        });
      }

      if (result.reason?.includes('not found') || result.reason?.includes('ended')) {
        return res.status(404).json({
          accepted: false,
          error: result.reason,
        });
      }

      return res.status(409).json({
        accepted: false,
        error: result.reason,
      });
    } catch (err) {
      next(err);
    }
  }
);
