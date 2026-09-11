import { Router } from 'express';
import { z } from 'zod';
import { verifySandboxWebhook, SANDBOX_PAYMENT_EVENTS } from '../../services/sandboxPaymentProvider.js';
import { processSandboxWebhook } from '../../services/paymentService.js';
import { validate } from '../middleware/validate.js';

export const router = Router();

const webhookBodySchema = z.object({
  eventId: z.string().trim().min(1),
  event: z.enum([SANDBOX_PAYMENT_EVENTS.SUCCEEDED, SANDBOX_PAYMENT_EVENTS.FAILED]),
  orderId: z.string().trim().min(1),
  paymentId: z.string().trim().min(1).optional(),
  amount: z.union([z.string().trim().min(1), z.number().positive().finite()]),
  failureReason: z.string().trim().max(255).optional(),
});

router.post('/webhook', (req, res, next) => {
  try {
    if (!verifySandboxWebhook(req.rawBody, req.headers['x-sandbox-signature'])) {
      return res.status(401).json({ error: 'Invalid payment webhook signature.' });
    }
    return validate({ body: webhookBodySchema })(req, res, next);
  } catch (error) {
    return next(error);
  }
}, async (req, res, next) => {
  try {
    const result = await processSandboxWebhook(req.body);
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    return next(error);
  }
});