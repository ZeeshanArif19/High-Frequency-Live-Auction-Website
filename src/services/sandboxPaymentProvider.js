import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';

export const SANDBOX_PAYMENT_EVENTS = Object.freeze({
  SUCCEEDED: 'payment.succeeded',
  FAILED: 'payment.failed',
});

export function createSandboxOrder({ amount }) {
  return {
    providerOrderId: `sandbox_order_${randomUUID()}`,
    amount: String(amount),
  };
}

export function verifySandboxWebhook(rawBody, signature) {
  if (!rawBody || !signature?.startsWith('sha256=')) return false;

  const expected = Buffer.from(
    createHmac('sha256', config.payment.webhookSecret).update(rawBody).digest('hex'),
    'utf8'
  );
  const received = Buffer.from(signature.slice(7), 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}