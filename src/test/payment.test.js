import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { app } from '../app.js';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';
import redis from '../redis/client.js';
import { channel, connection } from '../mq/connection.js';
import { createPaymentOrder, processSandboxWebhook } from '../services/paymentService.js';
import { SANDBOX_PAYMENT_EVENTS } from '../services/sandboxPaymentProvider.js';

const userIds = [];
const auctionIds = [];

async function createUser(label) {
  const id = randomUUID();
  userIds.push(id);
  await pool.query(
    `INSERT INTO users (id, email, username, password_hash, role)
     VALUES ($1, $2, $3, 'test-hash', 'USER')`,
    [id, `${id}@payment.test`, `pay_${label}_${id.slice(0, 8)}`]
  );
  return id;
}

async function createPaymentPendingAuction(ownerId, winnerId, amount = 500) {
  const auctionResult = await pool.query(`
    INSERT INTO auctions (
      title, item_name, starting_price, current_max_bid, start_time, end_time,
      minimum_bid_increment, description, owner_id, status, winner_user_id, payment_deadline
    )
    VALUES ($1, $1, $2, $2, CURRENT_TIMESTAMP - INTERVAL '2 hours',
            CURRENT_TIMESTAMP - INTERVAL '1 hour', 10, 'Payment test', $3, 'PAYMENT_PENDING', $4,
            CURRENT_TIMESTAMP + INTERVAL '24 hours')
    RETURNING id
  `, [`Payment ${randomUUID()}`, amount, ownerId, winnerId]);
  const auctionId = auctionResult.rows[0].id;
  auctionIds.push(auctionId);
  const bidResult = await pool.query(`
    INSERT INTO bids (auction_id, user_id, bid_amount, accepted_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    RETURNING id
  `, [auctionId, winnerId, amount]);
  await pool.query('UPDATE auctions SET winning_bid_id = $2 WHERE id = $1', [auctionId, bidResult.rows[0].id]);
  return auctionId;
}

function signedBody(payload) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', config.payment.webhookSecret).update(body).digest('hex');
  return { body, signature: `sha256=${signature}` };
}

async function postWebhook(server, payload, signature = signedBody(payload).signature) {
  return fetch(`http://localhost:${server.address().port}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sandbox-signature': signature },
    body: JSON.stringify(payload),
  });
}

async function run() {
  const ownerId = await createUser('owner');
  const winnerId = await createUser('winner');
  const otherBidderId = await createUser('other');
  const server = app.listen(0);

  try {
    const authorizationAuctionId = await createPaymentPendingAuction(ownerId, winnerId);
    await assert.rejects(
      createPaymentOrder({ auctionId: authorizationAuctionId, userId: otherBidderId }),
      (error) => error.status === 403
    );
    await assert.rejects(
      createPaymentOrder({ auctionId: authorizationAuctionId, userId: ownerId }),
      (error) => error.status === 403
    );

    const payment = await createPaymentOrder({ auctionId: authorizationAuctionId, userId: winnerId });
    assert.equal(payment.status, 'PAYMENT_PENDING', 'winner receives a pending sandbox order');
    assert.match(payment.provider_order_id, /^sandbox_order_/);
    const restartedPayment = await createPaymentOrder({ auctionId: authorizationAuctionId, userId: winnerId });
    assert.equal(restartedPayment.id, payment.id, 'pending order survives application restart/retry');

    const forged = await postWebhook(server, {
      eventId: randomUUID(),
      event: SANDBOX_PAYMENT_EVENTS.SUCCEEDED,
      orderId: payment.provider_order_id,
      paymentId: `sandbox_payment_${randomUUID()}`,
      amount: 500,
    }, 'sha256=forged');
    assert.equal(forged.status, 401, 'forged webhook is rejected');

    const mismatchEvent = {
      eventId: randomUUID(),
      event: SANDBOX_PAYMENT_EVENTS.SUCCEEDED,
      orderId: payment.provider_order_id,
      paymentId: `sandbox_payment_${randomUUID()}`,
      amount: 501,
    };
    const mismatch = await postWebhook(server, mismatchEvent);
    assert.equal(mismatch.status, 400, 'database transaction rejects an invalid payment payload');
    assert.equal((await pool.query('SELECT status FROM payments WHERE id = $1', [payment.id])).rows[0].status, 'PAYMENT_PENDING');

    const databaseFailureEvent = {
      eventId: randomUUID(),
      event: SANDBOX_PAYMENT_EVENTS.SUCCEEDED,
      orderId: payment.provider_order_id,
      paymentId: 'x'.repeat(256),
      amount: 500,
    };
    const databaseFailure = await postWebhook(server, databaseFailureEvent);
    assert.equal(databaseFailure.status, 500, 'database failure is surfaced as an internal error');
    assert.equal((await pool.query('SELECT status FROM payments WHERE id = $1', [payment.id])).rows[0].status, 'PAYMENT_PENDING', 'database failure rolls back payment state');

    const successPayload = {
      eventId: randomUUID(),
      event: SANDBOX_PAYMENT_EVENTS.SUCCEEDED,
      orderId: payment.provider_order_id,
      paymentId: `sandbox_payment_${randomUUID()}`,
      amount: 500,
    };
    const success = await postWebhook(server, successPayload);
    assert.equal(success.status, 200);
    assert.equal((await pool.query('SELECT status FROM auctions WHERE id = $1', [authorizationAuctionId])).rows[0].status, 'SETTLED');

    const duplicate = await postWebhook(server, successPayload);
    assert.equal(duplicate.status, 200);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM payments WHERE auction_id = $1 AND status = \'PAID\'', [authorizationAuctionId])).rows[0].count, 1);

    const repeatedSuccess = await postWebhook(server, {
      ...successPayload,
      eventId: randomUUID(),
      paymentId: `sandbox_payment_${randomUUID()}`,
    });
    assert.equal(repeatedSuccess.status, 200, 'repeated success after settlement is idempotent');
    await assert.rejects(
      createPaymentOrder({ auctionId: authorizationAuctionId, userId: winnerId }),
      (error) => error.status === 409
    );

    const failedAuctionId = await createPaymentPendingAuction(ownerId, winnerId, 700);
    const failedPayment = await createPaymentOrder({ auctionId: failedAuctionId, userId: winnerId });
    const failedPayload = {
      eventId: randomUUID(),
      event: SANDBOX_PAYMENT_EVENTS.FAILED,
      orderId: failedPayment.provider_order_id,
      paymentId: `sandbox_payment_${randomUUID()}`,
      amount: 700,
      failureReason: 'sandbox_declined',
    };
    const failed = await postWebhook(server, failedPayload);
    assert.equal(failed.status, 200);
    assert.equal((await pool.query('SELECT status FROM payments WHERE id = $1', [failedPayment.id])).rows[0].status, 'PAYMENT_FAILED');
    assert.equal((await pool.query('SELECT status FROM auctions WHERE id = $1', [failedAuctionId])).rows[0].status, 'PAYMENT_PENDING');
    const retry = await createPaymentOrder({ auctionId: failedAuctionId, userId: winnerId });
    assert.notEqual(retry.id, failedPayment.id, 'failed payment remains retryable');

    const directRepeat = await processSandboxWebhook({ ...successPayload, eventId: randomUUID() });
    assert.equal(directRepeat.duplicate, true, 'service-level repeated success does not settle twice');
    console.log('All payment sandbox tests passed.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.query('DELETE FROM auctions WHERE id = ANY($1::uuid[])', [auctionIds]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    await redis.quit();
    await pool.end();
    try { await channel.close(); } catch {}
    try { await connection.close(); } catch {}
  }
}

await run();
