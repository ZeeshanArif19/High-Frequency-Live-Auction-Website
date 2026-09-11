/**
 * src/api/middleware/auth.js
 *
 * Authentication middleware enforcing JWT token verification (AGENTS.md §6, §8).
 * Ensures only authenticated users can access protected endpoints and attaches
 * the authenticated user identity to req.user.
 */

import { verifyToken } from '../../utils/auth.js';

/**
 * Express middleware requiring a valid Bearer JWT.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication token required. Please provide a Bearer token.',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: 'Authentication token missing.',
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication token has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Invalid authentication token.',
    });
  }
}
