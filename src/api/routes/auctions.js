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

const createAuctionBodySchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').optional(),
    item_name: z.string().trim().min(1, 'Item name cannot be empty').optional(),
    description: z
      .string({ required_error: 'Description is required' })
      .trim()
      .min(1, 'Description cannot be empty'),
    startingPrice: z
      .number({ required_error: 'startingPrice is required' })
      .positive('startingPrice must be greater than 0')
      .finite('startingPrice must be a finite decimal')
      .optional(),
    starting_price: z
      .number({ required_error: 'starting_price is required' })
      .positive('starting_price must be greater than 0')
      .finite('starting_price must be a finite decimal')
      .optional(),
    minimumBidIncrement: z
      .number({ required_error: 'minimumBidIncrement is required' })
      .positive('minimumBidIncrement must be greater than 0')
      .finite('minimumBidIncrement must be a finite decimal')
      .optional(),
    minimum_bid_increment: z
      .number({ required_error: 'minimum_bid_increment is required' })
      .positive('minimum_bid_increment must be greater than 0')
      .finite('minimum_bid_increment must be a finite decimal')
      .optional(),
    startTime: z
      .string({ required_error: 'startTime is required' })
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid startTime date format')
      .optional(),
    start_time: z
      .string({ required_error: 'start_time is required' })
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid start_time date format')
      .optional(),
    endTime: z
      .string({ required_error: 'endTime is required' })
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid endTime date format')
      .optional(),
    end_time: z
      .string({ required_error: 'end_time is required' })
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid end_time date format')
      .optional(),
    category: z.string().optional().nullable(),
    image_url: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    lot_number: z.string().optional().nullable(),
    lotNumber: z.string().optional().nullable(),
    ownerId: z.any().optional(),
    sellerId: z.any().optional(),
    owner_id: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.title && !data.item_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'title is required',
        path: ['title'],
      });
    }
    if (data.startingPrice === undefined && data.starting_price === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startingPrice is required',
        path: ['startingPrice'],
      });
    }
    if (data.minimumBidIncrement === undefined && data.minimum_bid_increment === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minimumBidIncrement is required',
        path: ['minimumBidIncrement'],
      });
    }
    if (!data.startTime && !data.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startTime is required',
        path: ['startTime'],
      });
    }
    if (!data.endTime && !data.end_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime is required',
        path: ['endTime'],
      });
    }
    const startStr = data.startTime || data.start_time;
    const endStr = data.endTime || data.end_time;
    if (startStr && endStr) {
      const startMs = new Date(startStr).getTime();
      const endMs = new Date(endStr).getTime();
      if (startMs >= endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startTime must be before endTime',
          path: ['startTime'],
        });
      }
    }
  });

const updateAuctionBodySchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').optional(),
    item_name: z.string().trim().min(1, 'item_name cannot be empty').optional(),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    image_url: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    lot_number: z.string().optional().nullable(),
    lotNumber: z.string().optional().nullable(),
    startingPrice: z.number().positive('startingPrice must be greater than 0').finite().optional(),
    starting_price: z.number().positive('starting_price must be greater than 0').finite().optional(),
    minimumBidIncrement: z.number().positive('minimumBidIncrement must be greater than 0').finite().optional(),
    minimum_bid_increment: z.number().positive('minimum_bid_increment must be greater than 0').finite().optional(),
    startTime: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid startTime date format')
      .optional(),
    start_time: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid start_time date format')
      .optional(),
    endTime: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid endTime date format')
      .optional(),
    end_time: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid end_time date format')
      .optional(),
  })
  .superRefine((data, ctx) => {
    const startStr = data.startTime || data.start_time;
    const endStr = data.endTime || data.end_time;
    if (startStr && endStr) {
      const startMs = new Date(startStr).getTime();
      const endMs = new Date(endStr).getTime();
      if (startMs >= endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startTime must be before endTime',
          path: ['startTime'],
        });
      }
    }
  });

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * GET /auctions
 * Fetches all auctions from PostgreSQL.
 */
router.get('/', async (req, res, next) => {
  try {
    const sql = `
      SELECT id, COALESCE(title, item_name) AS title, item_name, starting_price,
             current_max_bid, start_time, end_time, minimum_bid_increment,
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
             COALESCE(a.title, a.item_name) AS title, a.item_name,
             a.current_max_bid, a.start_time, a.end_time, a.image_url
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
      SELECT a.id, COALESCE(a.title, a.item_name) AS title, a.item_name, a.starting_price,
             a.current_max_bid, a.start_time, a.end_time, a.minimum_bid_increment,
             a.description, a.category, a.image_url, a.lot_number, a.owner_id,
             COUNT(b.id)::int AS bid_count
      FROM auctions a
      LEFT JOIN bids b ON b.auction_id = a.id
      WHERE a.owner_id = $1
      GROUP BY a.id
      ORDER BY a.start_time DESC, a.end_time DESC
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
      const title = (req.body.title || req.body.item_name).trim();
      const startingPrice = Number(req.body.startingPrice ?? req.body.starting_price);
      const minimumBidIncrement = Number(req.body.minimumBidIncrement ?? req.body.minimum_bid_increment);
      const startTime = new Date(req.body.startTime || req.body.start_time).toISOString();
      const endTime = new Date(req.body.endTime || req.body.end_time).toISOString();
      const description = req.body.description.trim();
      const category = req.body.category ? req.body.category.trim() : 'Horology';
      const imageUrl = req.body.imageUrl ?? req.body.image_url ?? null;
      const lotNumber = req.body.lotNumber ?? req.body.lot_number ?? null;

      // Identity strictly sourced from verified JWT (req.user.id).
      // Client-supplied ownerId/sellerId is never accepted as ownership source.
      const ownerId = req.user.id;

      const insertSql = `
        INSERT INTO auctions (
          title, item_name, starting_price, current_max_bid, start_time, end_time,
          minimum_bid_increment, description, category, image_url, lot_number, owner_id
        )
        VALUES ($1, $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, COALESCE(title, item_name) AS title, item_name, starting_price,
                  current_max_bid, start_time, end_time, minimum_bid_increment,
                  description, category, image_url, lot_number, owner_id
      `;

      const { rows } = await pool.query(insertSql, [
        title,
        startingPrice,
        startTime,
        endTime,
        minimumBidIncrement,
        description,
        category,
        imageUrl,
        lotNumber,
        ownerId,
      ]);

      const createdAuction = rows[0];

      // Initialize Redis max_bid for this auction
      await redis.set(`auction:${createdAuction.id}:max_bid`, String(startingPrice));

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
        SELECT id, COALESCE(title, item_name) AS title, item_name, starting_price,
               current_max_bid, start_time, end_time, minimum_bid_increment,
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
 * Modifies an auction lot.
 * - Only the authenticated owner can modify.
 * - The owner may edit permitted fields only before the auction becomes LIVE.
 * - Once an auction is LIVE, prevent modifications that would break bidding consistency.
 */
router.put(
  '/:id',
  requireAuth,
  validate({ params: auctionParamsSchema, body: updateAuctionBodySchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 1. Check if auction exists and retrieve current owner and state
      const checkSql = `
        SELECT id, COALESCE(title, item_name) AS title, item_name, starting_price,
               current_max_bid, start_time, end_time, minimum_bid_increment, owner_id
        FROM auctions
        WHERE id = $1
      `;
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

      // 3. Lifecycle checks
      const now = Date.now();
      const startTimeMs = new Date(auction.start_time).getTime();
      const endTimeMs = new Date(auction.end_time).getTime();
      const isLive = now >= startTimeMs && now < endTimeMs;
      const isEnded = now >= endTimeMs;

      // Check if any bids exist
      const { rows: bidRows } = await pool.query(
        'SELECT COUNT(*) AS count FROM bids WHERE auction_id = $1',
        [id]
      );
      const bidCount = parseInt(bidRows[0].count, 10);

      if (isEnded) {
        return res.status(400).json({
          error: 'Cannot modify an auction that has already ended.',
        });
      }

      const hasBiddingChanges =
        req.body.startingPrice !== undefined ||
        req.body.starting_price !== undefined ||
        req.body.minimumBidIncrement !== undefined ||
        req.body.minimum_bid_increment !== undefined ||
        req.body.startTime !== undefined ||
        req.body.start_time !== undefined ||
        req.body.endTime !== undefined ||
        req.body.end_time !== undefined;

      if (isLive) {
        // Once an auction is LIVE:
        // Prevent modifications that break bidding consistency
        if (bidCount > 0) {
          return res.status(400).json({
            error: 'Cannot modify auction once bidding has commenced.',
          });
        }

        if (hasBiddingChanges) {
          return res.status(400).json({
            error: 'Cannot modify bidding parameters or auction schedule once auction is LIVE.',
          });
        }
      }

      // 4. Update fields
      const title = req.body.title || req.body.item_name;
      const description = req.body.description;
      const category = req.body.category;
      const imageUrl = req.body.imageUrl ?? req.body.image_url;
      const lotNumber = req.body.lotNumber ?? req.body.lot_number;
      const newStartingPrice =
        req.body.startingPrice !== undefined || req.body.starting_price !== undefined
          ? Number(req.body.startingPrice ?? req.body.starting_price)
          : null;
      const newMinIncrement =
        req.body.minimumBidIncrement !== undefined || req.body.minimum_bid_increment !== undefined
          ? Number(req.body.minimumBidIncrement ?? req.body.minimum_bid_increment)
          : null;
      const newStartTime =
        req.body.startTime || req.body.start_time
          ? new Date(req.body.startTime || req.body.start_time).toISOString()
          : null;
      const newEndTime =
        req.body.endTime || req.body.end_time
          ? new Date(req.body.endTime || req.body.end_time).toISOString()
          : null;

      // If updating start/end times before live, verify newStartTime < newEndTime
      const finalStart = newStartTime ? new Date(newStartTime).getTime() : startTimeMs;
      const finalEnd = newEndTime ? new Date(newEndTime).getTime() : endTimeMs;
      if (finalStart >= finalEnd) {
        return res.status(400).json({
          error: 'startTime must be before endTime',
        });
      }

      const updateSql = `
        UPDATE auctions
        SET title                  = COALESCE($2, title),
            item_name              = COALESCE($2, item_name),
            description            = COALESCE($3, description),
            category               = COALESCE($4, category),
            image_url              = COALESCE($5, image_url),
            lot_number             = COALESCE($6, lot_number),
            starting_price         = COALESCE($7, starting_price),
            current_max_bid        = CASE WHEN current_max_bid = starting_price AND $7 IS NOT NULL THEN $7 ELSE current_max_bid END,
            minimum_bid_increment  = COALESCE($8, minimum_bid_increment),
            start_time             = COALESCE($9, start_time),
            end_time               = COALESCE($10, end_time)
        WHERE id = $1
        RETURNING id, COALESCE(title, item_name) AS title, item_name, starting_price,
                  current_max_bid, start_time, end_time, minimum_bid_increment,
                  description, category, image_url, lot_number, owner_id
      `;

      const { rows: updatedRows } = await pool.query(updateSql, [
        id,
        title ?? null,
        description ?? null,
        category ?? null,
        imageUrl ?? null,
        lotNumber ?? null,
        newStartingPrice,
        newMinIncrement,
        newStartTime,
        newEndTime,
      ]);

      const updatedAuction = updatedRows[0];

      // Update Redis max_bid if starting_price was updated and no bids had occurred
      if (newStartingPrice && bidCount === 0) {
        await redis.set(`auction:${id}:max_bid`, String(newStartingPrice));
      }

      return res.status(200).json(updatedAuction);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /auctions/:id
 * Deletes/cancels an auction lot.
 * - Only the authenticated owner can delete.
 * - Allowed only where auction lifecycle permits it (cannot delete if bids have been placed).
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

      // 3. Lifecycle enforcement: Cannot delete/cancel once bids have been placed
      const { rows: bidRows } = await pool.query(
        'SELECT COUNT(*) AS count FROM bids WHERE auction_id = $1',
        [id]
      );
      const bidCount = parseInt(bidRows[0].count, 10);

      if (bidCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete or cancel an auction once bids have been placed.',
        });
      }

      // 4. Delete auction and clean up Redis max_bid
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

      if (result.reason?.includes('not started')) {
        return res.status(400).json({
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
