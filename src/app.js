/**
 * src/app.js
 *
 * Express application setup (AGENTS.md §6, TASK.md §STEP-09).
 * Configures middleware, mounts route handlers, and registers the centralized error handler.
 */

import express from 'express';
import { router as auctionsRouter } from './api/routes/auctions.js';
import { errorHandler } from './api/middleware/errorHandler.js';

export const app = express();

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());

// ── Route Handlers ───────────────────────────────────────────────────────────
app.use('/auctions', auctionsRouter);

// ── Centralized Error Handler ────────────────────────────────────────────────
app.use(errorHandler);
