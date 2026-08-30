/**
 * src/server.js
 *
 * Application entry point (AGENTS.md §2, TASK.md §STEP-09).
 * Starts the Express HTTP server and initializes the background RabbitMQ consumer.
 */

import { app } from './app.js';
import { config } from './config/index.js';
import { channel } from './mq/connection.js';
import { startBidConsumer } from './mq/consumers/bidConsumer.js';

const PORT = config.port;

export const server = app.listen(PORT, async () => {
  console.log(`[Server] HTTP server running on port ${PORT}`);

  try {
    await startBidConsumer(channel);
    console.log('[Server] Bid consumer initialized successfully');
  } catch (err) {
    console.error('[Server] Failed to initialize Bid consumer:', err.message);
  }
});
