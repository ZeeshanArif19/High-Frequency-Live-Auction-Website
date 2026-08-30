/**
 * src/ws/server.js
 *
 * WebSocket server for real-time bid updates (TASK.md §STEP-10).
 * Attaches to the existing HTTP server and broadcasts confirmed max bids.
 */

import { WebSocketServer, WebSocket } from 'ws';

let wss = null;

/**
 * Initializes and attaches the WebSocket server to the provided HTTP server instance.
 *
 * @param {import('http').Server} server - The HTTP server to attach to.
 * @returns {WebSocketServer}
 */
export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    ws.on('error', (err) => {
      console.error('[WebSocket] Socket error:', err.message);
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });
  });

  console.log('[WebSocket] WebSocket server initialized');
  return wss;
}

/**
 * Broadcasts a new max bid update to all connected WebSocket clients.
 *
 * @param {string} auctionId - UUID of the auction.
 * @param {number|string} newMaxBid - The new maximum bid amount.
 */
export function broadcastBidUpdate(auctionId, newMaxBid) {
  if (!wss) {
    return;
  }

  const payload = JSON.stringify({
    auctionId,
    newMaxBid,
    timestamp: new Date().toISOString(),
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
