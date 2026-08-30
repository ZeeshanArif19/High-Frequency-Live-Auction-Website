/**
 * src/redis/scripts/index.js
 *
 * Loads the try_place_bid.lua script at startup via fs.readFile (AGENTS.md §4),
 * registers it with the Redis client using SCRIPT LOAD (EVALSHA), and exports
 * the typed wrapper function tryPlaceBid(auctionId, bidAmount) → boolean.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import redis from '../client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and register the Lua script on module initialisation
const luaPath = join(__dirname, 'try_place_bid.lua');
const luaSource = await readFile(luaPath, 'utf8');

// SCRIPT LOAD returns the SHA1 digest; we store it and invoke via EVALSHA
// so the script is transmitted only once across the lifetime of the process.
const tryPlaceBidSha = await redis.script('LOAD', luaSource);

/**
 * Atomically attempt to place a bid for a given auction.
 *
 * Internally executes try_place_bid.lua via EVALSHA.
 * Key pattern follows AGENTS.md §4: auction:{id}:max_bid
 *
 * @param {string} auctionId  — UUID of the auction
 * @param {number|string} bidAmount — The bid value to compare / set
 * @returns {Promise<boolean>} true  → bid accepted and stored
 *                             false → bid rejected (≤ current max)
 */
export async function tryPlaceBid(auctionId, bidAmount) {
  const key = `auction:${auctionId}:max_bid`;
  const result = await redis.evalsha(tryPlaceBidSha, 1, key, String(bidAmount));
  return result === 1;
}
