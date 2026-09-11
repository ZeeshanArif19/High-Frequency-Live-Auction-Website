/**
 * src/app.js
 *
 * Express application setup (AGENTS.md §6, TASK.md §STEP-09).
 * Configures middleware, mounts route handlers, and registers the centralized error handler.
 */

import express from 'express';
import { router as auctionsRouter } from './api/routes/auctions.js';
import { router as authRouter } from './api/routes/auth.js';
import { router as paymentsRouter } from './api/routes/payments.js';
import { errorHandler } from './api/middleware/errorHandler.js';

export const app = express();

// ── Global Middleware ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));

// ── Route Handlers ───────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/auctions', auctionsRouter);
app.use('/payments', paymentsRouter);

// ── Centralized Error Handler ────────────────────────────────────────────────
app.use(errorHandler);
