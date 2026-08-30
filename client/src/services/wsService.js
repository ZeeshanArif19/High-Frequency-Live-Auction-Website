/**
 * client/src/services/wsService.js
 *
 * WebSocket client service managing live socket connections and broadcasting events (AGENTS.md §7, TASK.md §STEP-11).
 * Exposes an EventEmitter interface for auction real-time updates.
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.isConnected = false;
    this.url = this.getDefaultUrl();
  }

  getDefaultUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    // By default, connect directly to backend on port 3000 in dev or current host
    const port = window.location.port === '5173' ? '3000' : window.location.port;
    return `${protocol}//${host}:${port}`;
  }

  connect(customUrl) {
    if (customUrl) {
      this.url = customUrl;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connectionChange', { connected: true });
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // Broadcast general bidUpdate
          this.emit('bidUpdate', payload);
          // Also broadcast specific auctionId event
          if (payload.auctionId) {
            this.emit(`bidUpdate:${payload.auctionId}`, payload);
          }
        } catch (err) {
          console.error('[WSService] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connectionChange', { connected: false });
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[WSService] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function for easy cleanup in useEffect
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (err) {
          console.error(`[WSService] Error in event listener for ${event}:`, err);
        }
      }
    }
  }
}

export const wsService = new WebSocketService();
