/**
 * src/server.js
 *
 * Application entry point (AGENTS.md §2, TASK.md §STEP-09, §STEP-10).
 * Starts the Express HTTP server, attaches WebSocket server, and initializes the background RabbitMQ consumer.
 */

import { app } from './app.js';
import { config } from './config/index.js';
import { channel } from './mq/connection.js';
import { startBidConsumer } from './mq/consumers/bidConsumer.js';
import { initWebSocketServer } from './ws/server.js';

const PORT = config.port;

export const server = app.listen(PORT, async () => {
  console.log(`[Server] HTTP server running on port ${PORT}`);

  initWebSocketServer(server);

  try {
    await startBidConsumer(channel);
    console.log('[Server] Bid consumer initialized successfully');
  } catch (err) {
    console.error('[Server] Failed to initialize Bid consumer:', err.message);
  }
});
