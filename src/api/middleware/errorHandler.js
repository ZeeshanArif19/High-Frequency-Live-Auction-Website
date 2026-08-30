/**
 * src/api/middleware/errorHandler.js
 *
 * Centralized Express error-handling middleware (AGENTS.md §6, TASK.md §STEP-09).
 * Catches all unhandled errors, formats validation and application errors,
 * and responds with semantically correct HTTP status codes.
 */

import { ZodError } from 'zod';

/**
 * Express error-handling middleware.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON payload in request body',
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;

  if (statusCode === 500) {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
  }

  return res.status(statusCode).json({
    error: message,
  });
}
