import { pool } from '../db/pool.js';
import { createSandboxOrder, SANDBOX_PAYMENT_EVENTS } from './sandboxPaymentProvider.js';

export const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'PAYMENT_PENDING',
  PAID: 'PAID',
  FAILED: 'PAYMENT_FAILED',
  EXPIRED: 'PAYMENT_EXPIRED',
});

function paymentError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function createPaymentOrder({ auctionId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const auctionResult = await client.query(`
                  SELECT a.id, a.status, a.winner_user_id, a.winning_bid_id,
                    a.payment_deadline,
                    CURRENT_TIMESTAMP >= a.payment_deadline AS payment_expired,
                    b.bid_amount
      FROM auctions a
      JOIN bids b ON b.id = a.winning_bid_id
      WHERE a.id = $1
      FOR UPDATE
    `, [auctionId]);
    const auction = auctionResult.rows[0];

    if (!auction) throw paymentError('Auction not found.', 404);
    if (auction.winner_user_id !== userId) {
      throw paymentError('Only the selected winner can initiate payment.', 403);
    }
    if (auction.status !== 'PAYMENT_PENDING') {
      throw paymentError('Payment is only available for payment-pending auctions.', 409);
    }
    if (auction.payment_expired) {
      throw paymentError('The payment deadline has expired.', 409);
    }

    await client.query(`
      INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (auction_id, bid_id) DO NOTHING
    `, [auctionId, userId, auction.winning_bid_id, auction.payment_deadline]);
    const claimResult = await client.query(`
      SELECT id, status
      FROM auction_payment_claims
      WHERE auction_id = $1 AND bid_id = $2
      FOR UPDATE
    `, [auctionId, auction.winning_bid_id]);
    if (claimResult.rows[0]?.status !== 'PAYMENT_PENDING') {
      throw paymentError('The payment claim is no longer active.', 409);
    }

    const existing = await client.query(`
      SELECT id, auction_id, provider_order_id, amount, status, created_at
      FROM payments
      WHERE auction_id = $1 AND status = 'PAYMENT_PENDING'
      FOR UPDATE
    `, [auctionId]);
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return existing.rows[0];
    }

    const providerOrder = createSandboxOrder({ amount: auction.bid_amount });
    const result = await client.query(`
      INSERT INTO payments (auction_id, user_id, claim_id, provider_order_id, amount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, auction_id, provider_order_id, amount, status, created_at
    `, [auctionId, userId, claimResult.rows[0].id, providerOrder.providerOrderId, auction.bid_amount]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function processSandboxWebhook({ eventId, event, orderId, paymentId, amount, failureReason }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const duplicate = await client.query(
      'SELECT id, status FROM payments WHERE webhook_event_id = $1 FOR UPDATE',
      [eventId]
    );
    if (duplicate.rows[0]) {
      await client.query('COMMIT');
      return { duplicate: true, status: duplicate.rows[0].status };
    }

    const paymentResult = await client.query(`
      SELECT id, auction_id, user_id, claim_id, amount, status
      FROM payments
      WHERE provider_order_id = $1
    `, [orderId]);
    const payment = paymentResult.rows[0];
    if (!payment) throw paymentError('Payment order not found.', 404);
    if (String(payment.amount) !== String(amount)) throw paymentError('Payment amount mismatch.', 400);

    const auctionResult = await client.query(
      `SELECT id, status, winner_user_id, payment_deadline,
          CURRENT_TIMESTAMP > payment_deadline AS payment_expired
       FROM auctions WHERE id = $1 FOR UPDATE`,
      [payment.auction_id]
    );
    const auction = auctionResult.rows[0];
    if (auction.winner_user_id !== payment.user_id) throw paymentError('Payment winner mismatch.', 409);
    const lockedPayment = (await client.query(
      'SELECT id, status, claim_id FROM payments WHERE id = $1 FOR UPDATE',
      [payment.id]
    )).rows[0];
    if (!lockedPayment.claim_id) {
      const insertedClaim = (await client.query(`
        INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, payment_deadline)
        SELECT id, winner_user_id::uuid, winning_bid_id, payment_deadline
        FROM auctions
        WHERE id = $1 AND winner_user_id = $2 AND winning_bid_id IS NOT NULL
        ON CONFLICT (auction_id, bid_id) DO NOTHING
        RETURNING id
      `, [payment.auction_id, payment.user_id])).rows[0];
      const backfillClaim = insertedClaim ?? (await client.query(`
        SELECT c.id
        FROM auction_payment_claims c
        JOIN auctions a ON a.id = c.auction_id AND a.winning_bid_id = c.bid_id
        WHERE c.auction_id = $1 AND c.user_id = $2
        FOR UPDATE
      `, [payment.auction_id, payment.user_id])).rows[0];
      await client.query(
        'UPDATE payments SET claim_id = $2 WHERE id = $1 AND claim_id IS NULL',
        [payment.id, backfillClaim.id]
      );
      lockedPayment.claim_id = backfillClaim.id;
    }
    const claim = (await client.query(
      'SELECT id, status FROM auction_payment_claims WHERE id = $1 FOR UPDATE',
      [lockedPayment.claim_id]
    )).rows[0];

    if (event === SANDBOX_PAYMENT_EVENTS.SUCCEEDED) {
      if (lockedPayment.status === PAYMENT_STATUSES.PAID || auction.status === 'SETTLED') {
        await client.query(`UPDATE payments SET webhook_event_id = COALESCE(webhook_event_id, $2), provider_payment_id = COALESCE(provider_payment_id, $3), updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [payment.id, eventId, paymentId]);
        await client.query('COMMIT');
        return { duplicate: true, status: PAYMENT_STATUSES.PAID };
      }
      if (lockedPayment.status !== PAYMENT_STATUSES.PENDING || claim?.status !== 'PAYMENT_PENDING' || auction.status !== 'PAYMENT_PENDING' || auction.payment_expired) {
        throw paymentError('Payment is no longer payable.', 409);
      }
      await client.query(`
        UPDATE payments
        SET status = 'PAID', provider_payment_id = $2, webhook_event_id = $3,
            paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [payment.id, paymentId, eventId]);
      await client.query(`
        UPDATE auction_payment_claims
        SET status = 'PAID', settled_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'PAYMENT_PENDING'
      `, [claim.id]);
      await client.query(`
        UPDATE auctions SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'PAYMENT_PENDING'
      `, [payment.auction_id]);
    } else if (event === SANDBOX_PAYMENT_EVENTS.FAILED) {
      if (lockedPayment.status === PAYMENT_STATUSES.PAID || auction.status === 'SETTLED') {
        throw paymentError('Settled payments cannot fail.', 409);
      }
      if (lockedPayment.status === PAYMENT_STATUSES.PENDING && claim?.status === 'PAYMENT_PENDING') {
        await client.query(`
          UPDATE payments
          SET status = 'PAYMENT_FAILED', provider_payment_id = $2, failure_reason = $3,
              webhook_event_id = $4, failed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [payment.id, paymentId ?? null, failureReason ?? 'Sandbox payment failed', eventId]);
      }
    } else {
      throw paymentError('Unsupported payment event.', 400);
    }

    await client.query('COMMIT');
    return { duplicate: false, status: event === SANDBOX_PAYMENT_EVENTS.SUCCEEDED ? PAYMENT_STATUSES.PAID : PAYMENT_STATUSES.FAILED };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}