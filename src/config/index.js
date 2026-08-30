/**
 * src/config/index.js
 *
 * Centralized configuration module. All environment variables are read here
 * and exported as a single frozen object. No other module may access
 * process.env directly (AGENTS.md §2).
 */

try {
  process.loadEnvFile?.();
} catch {
  // Ignore if .env file is not present or cannot be read
}

export const config = Object.freeze({
  port: parseInt(process.env.PORT ?? "3000", 10),

  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    name: process.env.DB_NAME ?? "auction_db",
    user: process.env.DB_USER ?? "auction_user",
    password: process.env.DB_PASSWORD ?? "auction_pass",
    poolMax: parseInt(process.env.DB_POOL_MAX ?? "10", 10),
  },

  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
    bidQueue: process.env.RABBITMQ_BID_QUEUE ?? "bid_persist_queue",
  },
});
