/**
 * src/test/loadTest.js
 *
 * Integration and load testing suite for the High-Frequency Live Auction Engine.
 * Validates:
 *   - Scenario A: Valid Bid Flow (HTTP 202, Redis max_bid update, RabbitMQ -> Postgres persistence)
 *   - Scenario B: Low Bid / Conflict (HTTP 409 rejected by Redis Lua script)
 *   - Scenario C: Expired Auction (Rejected due to end_time < NOW())
 *   - Scenario D: Concurrency Race Condition (50 concurrent requests for identical bid -> 1 succeeds, 49 rejected)
 */

import assert from 'node:assert/strict';
import { app } from '../app.js';
import { pool } from '../db/pool.js';
import { redis } from '../redis/client.js';
import { channel, connection } from '../mq/connection.js';
import { startBidConsumer } from '../mq/consumers/bidConsumer.js';
import { config } from '../config/index.js';

// Helper for polling asynchronous database persistence
async function waitFor(fn, { timeout = 5000, interval = 100 } = {}) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

async function runLoadTests() {
  console.log('='.repeat(70));
  console.log('🚀 Starting Auction Engine Integration & Load Test Suite');
  console.log('='.repeat(70));

  let testServer = null;
  let baseUrl = `http://localhost:${config.port}`;
  const createdAuctionIds = [];

  try {
    // ── 0. Server & Consumer Lifecycle Setup ──────────────────────────────────
    try {
      const ping = await fetch(`${baseUrl}/auctions/00000000-0000-0000-0000-000000000000`);
      console.log(`[Setup] Connected to existing server at ${baseUrl}`);
    } catch {
      console.log(`[Setup] Starting in-process HTTP test server and RabbitMQ consumer...`);
      await new Promise((resolve) => {
        testServer = app.listen(0, () => {
          const port = testServer.address().port;
          baseUrl = `http://localhost:${port}`;
          console.log(`[Setup] In-process test server running on ${baseUrl}`);
          resolve();
        });
      });
      await startBidConsumer(channel);
    }

    // ── Scenario A: Valid Bid Flow ───────────────────────────────────────────
    console.log('\n▶ Running Scenario A: Valid Bid Flow');
    {
      // 1. Insert test auction directly into PostgreSQL
      const auctionRes = await pool.query(
        `INSERT INTO auctions (item_name, starting_price, current_max_bid, end_time)
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
         RETURNING id`,
        ['Scenario A - Vintage Watch', 100.0, 100.0]
      );
      const auctionId = auctionRes.rows[0].id;
      createdAuctionIds.push(auctionId);

      // 2. Set initial max bid in Redis
      await redis.set(`auction:${auctionId}:max_bid`, '100.00');

      // 3. Send valid POST request with higher bid
      const bidAmount = 150.0;
      const res = await fetch(`${baseUrl}/auctions/${auctionId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-scenario-a',
          bidAmount,
        }),
      });

      assert.strictEqual(res.status, 202, 'Expected HTTP 202 Accepted');
      const body = await res.json();
      assert.strictEqual(body.accepted, true, 'Expected accepted: true in response');

      // 4. Verify Redis was immediately updated
      const redisMaxBid = await redis.get(`auction:${auctionId}:max_bid`);
      assert.strictEqual(parseFloat(redisMaxBid), 150.0, 'Expected Redis max_bid to be 150.00');

      // 5. Verify async persistence to PostgreSQL via RabbitMQ
      const persistedBid = await waitFor(async () => {
        const result = await pool.query(
          `SELECT * FROM bids WHERE auction_id = $1 AND bid_amount = $2`,
          [auctionId, bidAmount]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
      });

      assert.ok(persistedBid, 'Bid should be persisted in PostgreSQL');
      assert.strictEqual(persistedBid.user_id, 'user-scenario-a');

      // Verify auction current_max_bid was updated in PostgreSQL
      const updatedAuction = await pool.query(
        `SELECT current_max_bid FROM auctions WHERE id = $1`,
        [auctionId]
      );
      assert.strictEqual(parseFloat(updatedAuction.rows[0].current_max_bid), 150.0);

      console.log('  ✔ Scenario A Passed: Bid accepted (202), Redis updated, and DB persisted asynchronously.');
    }

    // ── Scenario B: Low Bid / Conflict ───────────────────────────────────────
    console.log('\n▶ Running Scenario B: Low Bid / Conflict');
    {
      const auctionId = createdAuctionIds[0]; // Reuse active auction with max_bid = 150

      // Send bid lower than current max bid (120 <= 150)
      const res = await fetch(`${baseUrl}/auctions/${auctionId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-scenario-b',
          bidAmount: 120.0,
        }),
      });

      assert.strictEqual(res.status, 409, 'Expected HTTP 409 Conflict for lower bid');
      const body = await res.json();
      assert.strictEqual(body.accepted, false, 'Expected accepted: false');

      // Verify no bid of 120 was written to PostgreSQL
      const lowBidCheck = await pool.query(
        `SELECT * FROM bids WHERE auction_id = $1 AND bid_amount = 120.0`,
        [auctionId]
      );
      assert.strictEqual(lowBidCheck.rows.length, 0, 'Low bid must not be persisted to PostgreSQL');

      console.log('  ✔ Scenario B Passed: Lower bid rejected with 409 Conflict.');
    }

    // ── Scenario C: Expired Auction ──────────────────────────────────────────
    console.log('\n▶ Running Scenario C: Expired Auction');
    {
      // 1. Create auction with past end_time
      const auctionRes = await pool.query(
        `INSERT INTO auctions (item_name, starting_price, current_max_bid, end_time)
         VALUES ($1, $2, $3, NOW() - INTERVAL '10 minutes')
         RETURNING id`,
        ['Scenario C - Expired Art', 50.0, 50.0]
      );
      const expiredAuctionId = auctionRes.rows[0].id;
      createdAuctionIds.push(expiredAuctionId);

      await redis.set(`auction:${expiredAuctionId}:max_bid`, '50.00');

      // 2. Attempt to bid on expired auction
      const res = await fetch(`${baseUrl}/auctions/${expiredAuctionId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-scenario-c',
          bidAmount: 75.0,
        }),
      });

      assert.strictEqual(res.status, 404, 'Expected HTTP 404 for ended auction');
      const body = await res.json();
      assert.strictEqual(body.accepted, false, 'Expected accepted: false');

      console.log('  ✔ Scenario C Passed: Expired auction bid rejected.');
    }

    // ── Scenario D: Concurrency Race Condition (50 Concurrent Bids) ─────────
    console.log('\n▶ Running Scenario D: Concurrency Race (50 simultaneous requests for same amount)');
    {
      // 1. Create fresh auction
      const auctionRes = await pool.query(
        `INSERT INTO auctions (item_name, starting_price, current_max_bid, end_time)
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
         RETURNING id`,
        ['Scenario D - Rare Antique', 200.0, 200.0]
      );
      const raceAuctionId = auctionRes.rows[0].id;
      createdAuctionIds.push(raceAuctionId);

      await redis.set(`auction:${raceAuctionId}:max_bid`, '200.00');

      // 2. Prepare 50 concurrent requests for identical bid amount (300.00)
      const CONCURRENT_COUNT = 50;
      const targetBidAmount = 300.0;

      const requests = Array.from({ length: CONCURRENT_COUNT }, (_, i) =>
        fetch(`${baseUrl}/auctions/${raceAuctionId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: `user-race-${i + 1}`,
            bidAmount: targetBidAmount,
          }),
        }).then(async (res) => ({
          status: res.status,
          body: await res.json(),
        }))
      );

      // 3. Fire all requests concurrently
      const results = await Promise.all(requests);

      const accepted = results.filter((r) => r.status === 202 && r.body.accepted === true);
      const rejected = results.filter((r) => r.status === 409 && r.body.accepted === false);

      console.log(`  [Results] Total: ${CONCURRENT_COUNT} | Accepted (202): ${accepted.length} | Rejected (409): ${rejected.length}`);

      assert.strictEqual(accepted.length, 1, `Expected exactly 1 request to succeed, got ${accepted.length}`);
      assert.strictEqual(
        rejected.length,
        CONCURRENT_COUNT - 1,
        `Expected ${CONCURRENT_COUNT - 1} requests to be rejected, got ${rejected.length}`
      );

      // 4. Verify async DB persistence has exactly 1 bid row
      await waitFor(async () => {
        const result = await pool.query(
          `SELECT * FROM bids WHERE auction_id = $1 AND bid_amount = $2`,
          [raceAuctionId, targetBidAmount]
        );
        return result.rows.length === 1 ? result.rows : null;
      });

      const dbBids = await pool.query(
        `SELECT * FROM bids WHERE auction_id = $1`,
        [raceAuctionId]
      );
      assert.strictEqual(dbBids.rows.length, 1, 'Exactly 1 bid row should exist in PostgreSQL');
      assert.strictEqual(parseFloat(dbBids.rows[0].bid_amount), targetBidAmount);

      console.log('  ✔ Scenario D Passed: Atomic Redis Lua script prevented race conditions. Exactly 1 of 50 succeeded.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL INTEGRATION & LOAD TEST SCENARIOS PASSED SUCCESSFULLY!');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exitCode = 1;
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning up test fixtures...');
    try {
      if (createdAuctionIds.length > 0) {
        await pool.query(
          `DELETE FROM auctions WHERE id = ANY($1::uuid[])`,
          [createdAuctionIds]
        );
        for (const id of createdAuctionIds) {
          await redis.del(`auction:${id}:max_bid`);
        }
      }
      console.log('[Cleanup] Test fixtures removed.');
    } catch (cleanupErr) {
      console.warn('[Cleanup] Error during cleanup:', cleanupErr.message);
    }

    if (testServer) {
      testServer.close();
    }
    await redis.quit();
    await pool.end();
    if (channel) {
      try {
        await channel.close();
      } catch {}
    }
    if (connection) {
      try {
        await connection.close();
      } catch {}
    }
  }
}

runLoadTests();
