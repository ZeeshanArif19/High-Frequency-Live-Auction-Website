/**
 * src/utils/auth.js
 *
 * Cryptographic helpers for password hashing and JWT token management (AGENTS.md §2, §8).
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param {string} password - Plaintext password.
 * @returns {Promise<string>} Salted bcrypt hash.
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password with a bcrypt hash.
 *
 * @param {string} password - Plaintext password to test.
 * @param {string} hash - Stored hash to compare against.
 * @returns {Promise<boolean>} True if password matches.
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Issues a signed JWT token containing the user's non-sensitive payload.
 *
 * @param {{ id: string, email: string, username: string, role: string }} payload
 * @returns {string} Signed JWT.
 */
export function generateToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      username: payload.username,
      role: payload.role ?? 'USER',
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
}

/**
 * Verifies and decodes a JWT token.
 *
 * @param {string} token
 * @returns {object} Decoded payload.
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}
