/**
 * src/mq/connection.js
 *
 * Singleton RabbitMQ connection and channel manager (AGENTS.md §5).
 *
 * Responsibilities:
 *  - Connect to RabbitMQ using RABBITMQ_URL from the central config module.
 *  - Assert a dead-letter exchange (DLX) before the primary queue.
 *  - Assert the canonical bid_persist_queue as a durable queue with x-dead-letter-exchange.
 *  - Retry the connection up to 5 times with exponential back-off before throwing.
 *  - Export the live { connection, channel } pair for use by producers and consumers.
 */

import amqplib from 'amqplib';
import { config } from '../config/index.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Queue name is sourced from config — never hardcoded (AGENTS.md §5). */
const BID_QUEUE = config.rabbitmq.bidQueue;

/**
 * Dead-letter exchange name.
 * All messages nack'd with requeue:false are routed here.
 */
const DLX_NAME = `${BID_QUEUE}.dlx`;

/** Dead-letter queue receives the un-routable / failed messages for inspection. */
const DL_QUEUE_NAME = `${BID_QUEUE}.dead`;

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 500;

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt a single connection + channel setup against RabbitMQ.
 * Asserts all required exchanges and queues.
 *
 * @returns {Promise<{ connection: import('amqplib').Connection, channel: import('amqplib').Channel }>}
 */
async function attempt() {
  const connection = await amqplib.connect(config.rabbitmq.url);
  const channel = await connection.createChannel();

  // 1. Assert the dead-letter exchange (fanout is sufficient for a single DL queue)
  await channel.assertExchange(DLX_NAME, 'fanout', { durable: true });

  // 2. Assert the dead-letter queue and bind it to the DLX
  await channel.assertQueue(DL_QUEUE_NAME, { durable: true });
  await channel.bindQueue(DL_QUEUE_NAME, DLX_NAME, '');

  // 3. Assert the primary bid queue with DLX routing configured
  await channel.assertQueue(BID_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_NAME,
    },
  });

  console.log(`[MQ] Connected to RabbitMQ. Queue "${BID_QUEUE}" ready.`);

  return { connection, channel };
}

// ── Exported singleton ────────────────────────────────────────────────────────

/**
 * Connect to RabbitMQ with exponential back-off retry.
 *
 * @returns {Promise<{ connection: import('amqplib').Connection, channel: import('amqplib').Channel }>}
 * @throws {Error} after MAX_RETRIES exhausted
 */
export async function connectMQ() {
  let lastError;

  for (let attempt_n = 1; attempt_n <= MAX_RETRIES; attempt_n++) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt_n - 1);
      console.warn(
        `[MQ] Connection attempt ${attempt_n}/${MAX_RETRIES} failed. ` +
          `Retrying in ${backoff}ms… (${err.message})`
      );
      await sleep(backoff);
    }
  }

  throw new Error(
    `[MQ] Failed to connect to RabbitMQ after ${MAX_RETRIES} attempts. ` +
      `Last error: ${lastError?.message}`
  );
}

// Initialise on module load and export the live pair as a singleton promise
// so any importer awaits the same connection rather than opening a new one.
const mqSingleton = connectMQ();

export const { connection, channel } = await mqSingleton;
