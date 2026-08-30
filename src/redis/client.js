import Redis from "ioredis";
import { config } from "../config/index.js";

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("ready", () => {
  console.log("Redis client connected and ready.");
});

redis.on("error", (err) => {
  console.error("Redis client error:", err);
});

export default redis;
