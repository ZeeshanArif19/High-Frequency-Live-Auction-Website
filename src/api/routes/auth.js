/**
 * src/api/routes/auth.js
 *
 * User registration, login, and profile routes (AGENTS.md §2, §6, §8).
 * Enforces Zod validation, bcrypt password hashing, and JWT token issuance.
 */

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { hashPassword, comparePassword, generateToken } from '../../utils/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();

// ── Validation Schemas ────────────────────────────────────────────────────────

const registerBodySchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address format')
    .toLowerCase(),
  username: z
    .string({ required_error: 'Username is required' })
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

const loginBodySchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address format')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Registers a new user account with hashed password.
 */
router.post(
  '/register',
  validate({ body: registerBodySchema }),
  async (req, res, next) => {
    try {
      const { email, username, password } = req.body;

      // Check if user with same email or username already exists
      const existingQuery = `
        SELECT id, email, username
        FROM users
        WHERE email = $1 OR username = $2
        LIMIT 1
      `;
      const { rows: existingRows } = await pool.query(existingQuery, [email, username]);

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        if (existing.email.toLowerCase() === email) {
          return res.status(409).json({ error: 'A user with this email already exists.' });
        }
        return res.status(409).json({ error: 'A user with this username already exists.' });
      }

      // Hash password securely
      const passwordHash = await hashPassword(password);

      // Persist user to PostgreSQL
      const insertQuery = `
        INSERT INTO users (email, username, password_hash, role)
        VALUES ($1, $2, $3, 'USER')
        RETURNING id, email, username, role, created_at
      `;
      const { rows } = await pool.query(insertQuery, [email, username, passwordHash]);
      const user = rows[0];

      // Issue JWT
      const token = generateToken(user);

      return res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.created_at,
        },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/login
 * Verifies credentials and returns a JWT token.
 */
router.post(
  '/login',
  validate({ body: loginBodySchema }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const query = `
        SELECT id, email, username, password_hash, role, created_at
        FROM users
        WHERE email = $1
      `;
      const { rows } = await pool.query(query, [email]);

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = rows[0];
      const passwordMatches = await comparePassword(password, user.password_hash);

      if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(user);

      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.created_at,
        },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /auth/me
 * Returns current authenticated user profile.
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const query = `
      SELECT id, email, username, role, created_at
      FROM users
      WHERE id = $1
    `;
    const { rows } = await pool.query(query, [req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.status(200).json({
      user: rows[0],
    });
  } catch (err) {
    next(err);
  }
});
