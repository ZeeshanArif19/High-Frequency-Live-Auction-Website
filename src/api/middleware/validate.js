/**
 * src/api/middleware/validate.js
 *
 * Request validation middleware using Zod (AGENTS.md §6, TASK.md §STEP-09).
 * Validates request payload against a Zod schema before reaching route handlers.
 */

import { z } from 'zod';

/**
 * Creates an Express middleware to validate req.body against a Zod schema.
 *
 * @param {z.ZodTypeAny} schema - Zod schema to validate against.
 * @returns {import('express').RequestHandler}
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Creates an Express middleware to validate req.params, req.query, or req.body.
 *
 * @param {{ params?: z.ZodTypeAny, query?: z.ZodTypeAny, body?: z.ZodTypeAny }} schemas
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
