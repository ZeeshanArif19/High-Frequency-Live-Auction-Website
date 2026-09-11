/**
 * src/api/routes/auctions.js
 *
 * Route definitions for auction queries, bid history, bid submissions,
 * and authenticated auction management (AGENTS.md §6, §8).
 */

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import redis from '../../redis/client.js';
import { submitBid } from '../../services/bidService.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();

// ── Validation Schemas ────────────────────────────────────────────────────────

const auctionParamsSchema = z.object({
  id: z.string().uuid('Invalid auction ID format. Must be a valid UUID.'),
});

const submitBidBodySchema = z.object({
  userId: z.string().trim().optional(),
  bidAmount: z
    .number({ required_error: 'bidAmount is required' })
    .positive('bidAmount must be greater than 0')
    .finite('bidAmount must be a finite decimal'),
});

const createAuctionBodySchema = z.object({
  item_name: z
    .string({ required_error: 'item_name is required' })
    .trim()
    .min(1, 'item_name cannot be empty'),
  starting_price: z
    .number({ required_error: 'starting_price is required' })
    .positive('starting_price must be greater than 0')
    .finite('starting_price must be a finite decimal'),
  end_time: z
    .string({ required_error: 'end_time is required' })
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid end_time date format'),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  lot_number: z.string().optional().nullable(),
});

const updateAuctionBodySchema = z.object({
  item_name: z.string().trim().min(1, 'item_name cannot be empty').optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  lot_number: z.string().optional().nullable(),
  end_time: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid end_time date format')
    .optional(),
});

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * GET /auctions
 * Fetches all auctions from PostgreSQL.
 */
router.get('/', async (req, res, next) => {
  try {
    const sql = `
      SELECT id, item_name, starting_price, current_max_bid, end_time,
             description, category, image_url, lot_number, owner_id
      FROM   auctions
      ORDER BY end_time ASC
    `;

    const { rows } = await pool.query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ── Authenticated User Specific Subroutes (Placed before /:id) ───────────────

/**
 * GET /auctions/user/my-bids
 * Fetches bidding history for the currently authenticated user.
 */
router.get('/user/my-bids', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT b.id, b.auction_id, b.user_id, b.bid_amount, b.created_at,
             a.item_name, a.current_max_bid, a.end_time, a.image_url
      FROM bids b
      JOIN auctions a ON a.id = b.auction_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT 100
    `;

    const { rows } = await pool.query(sql, [userId]);
    return res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auctions/user/my-auctions
 * Fetches all auctions created by the currently authenticated user.
 */
router.get('/user/my-auctions', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT id, item_name, starting_price, current_max_bid, end_time,
             description, category, image_url, lot_number, owner_id
      FROM auctions
      WHERE owner_id = $1
      ORDER BY end_time DESC
    `;

    const { rows } = await pool.query(sql, [userId]);
    return res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auctions
 * Creates a new auction lot owned by the authenticated user.
 */
router.post(
  '/',
  requireAuth,
  validate({ body: createAuctionBodySchema }),
  async (req, res, next) => {
    try {
      const {
        item_name,
        starting_price,
        end_time,
        description = null,
        category = null,
        image_url = null,
        lot_number = null,
      } = req.body;

      const ownerId = req.user.id;

      const insertSql = `
        INSERT INTO auctions (
          item_name, starting_price, current_max_bid, end_time,
          description, category, image_url, lot_number, owner_id
        )
        VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, item_name, starting_price, current_max_bid, end_time,
                  description, category, image_url, lot_number, owner_id
      `;

      const { rows } = await pool.query(insertSql, [
        item_name,
        starting_price,
        new Date(end_time).toISOString(),
        description,
        category,
        image_url,
        lot_number,
        ownerId,
      ]);

      const createdAuction = rows[0];

      // Initialize Redis max_bid for this auction
      await redis.set(`auction:${createdAuction.id}:max_bid`, String(starting_price));

      return res.status(201).json(createdAuction);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /auctions/:id
 * Fetches single auction details from PostgreSQL.
 */
router.get(
  '/:id',
  validate({ params: auctionParamsSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const sql = `
        SELECT id, item_name, starting_price, current_max_bid, end_time,
               description, category, image_url, lot_number, owner_id
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
 * PUT /auctions/:id
 * Modifies an auction lot. Only the authenticated owner can modify.
 */
router.put(
  '/:id',
  requireAuth,
  validate({ params: auctionParamsSchema, body: updateAuctionBodySchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 1. Check if auction exists and retrieve current owner
      const checkSql = `SELECT id, owner_id FROM auctions WHERE id = $1`;
      const { rows: existingRows } = await pool.query(checkSql, [id]);

      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Auction not found' });
      }

      const auction = existingRows[0];

      // 2. Ownership enforcement: only the owner can modify
      if (auction.owner_id !== userId) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to modify this auction.',
        });
      }

      // 3. Update fields
      const { item_name, description, category, image_url, lot_number, end_time } = req.body;

      const updateSql = `
        UPDATE auctions
        SET item_name   = COALESCE($2, item_name),
            description = COALESCE($3, description),
            category    = COALESCE($4, category),
            image_url   = COALESCE($5, image_url),
            lot_number  = COALESCE($6, lot_number),
            end_time    = COALESCE($7, end_time)
        WHERE id = $1
        RETURNING id, item_name, starting_price, current_max_bid, end_time,
                  description, category, image_url, lot_number, owner_id
      `;

      const { rows: updatedRows } = await pool.query(updateSql, [
        id,
        item_name ?? null,
        description ?? null,
        category ?? null,
        image_url ?? null,
        lot_number ?? null,
        end_time ? new Date(end_time).toISOString() : null,
      ]);

      return res.status(200).json(updatedRows[0]);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /auctions/:id
 * Deletes an auction lot. Only the authenticated owner can delete.
 */
router.delete(
  '/:id',
  requireAuth,
  validate({ params: auctionParamsSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 1. Check if auction exists and retrieve current owner
      const checkSql = `SELECT id, owner_id FROM auctions WHERE id = $1`;
      const { rows: existingRows } = await pool.query(checkSql, [id]);

      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Auction not found' });
      }

      const auction = existingRows[0];

      // 2. Ownership enforcement: only the owner can delete
      if (auction.owner_id !== userId) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to delete this auction.',
        });
      }

      // 3. Delete auction and clean up Redis max_bid
      await pool.query(`DELETE FROM auctions WHERE id = $1`, [id]);
      await redis.del(`auction:${id}:max_bid`);

      return res.status(200).json({
        message: 'Auction deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /auctions/:id/bids
 * Fetches bid history for an auction.
 */
router.get(
  '/:id/bids',
  validate({ params: auctionParamsSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const sql = `
        SELECT id, auction_id, user_id, bid_amount, created_at
        FROM   bids
        WHERE  auction_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;

      const { rows } = await pool.query(sql, [id]);
      return res.status(200).json(rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auctions/:id/bids
 * Submits a new bid to the auction pipeline.
 * Enforces JWT authentication. Uses verified user ID from req.user.id.
 */
router.post(
  '/:id/bids',
  requireAuth,
  validate({ params: auctionParamsSchema, body: submitBidBodySchema }),
  async (req, res, next) => {
    try {
      const { id: auctionId } = req.params;
      const { bidAmount } = req.body;

      // Identity strictly sourced from verified JWT (req.user)
      const userId = req.user.id;

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

      // Owner trying to bid on their own auction -> 403 Forbidden
      if (result.reason?.includes('own auction')) {
        return res.status(403).json({
          accepted: false,
          error: result.reason,
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
