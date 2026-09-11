/**
 * src/test/authAndAuthorization.test.js
 *
 * Comprehensive test suite validating:
 *  1. Successful registration (201, password hash never exposed)
 *  2. Duplicate registration (409 Conflict)
 *  3. Successful login (200, JWT returned)
 *  4. Invalid password (401 Unauthorized)
 *  5. Missing authentication token (401 Unauthorized)
 *  6. Invalid and expired token (401 Unauthorized)
 *  7. Authenticated user accessing a protected endpoint (200 OK)
 *  8. User creating an auction (201, owner_id associated, Redis initialized)
 *  9. User placing a bid on an eligible auction (202 Accepted)
 * 10. User attempting to place a bid on their OWN listing (403 Forbidden)
 * 11. User attempting to modify another user's auction (403 Forbidden)
 * 12. User successfully modifying their own eligible auction (200 OK)
 * 13. User attempting to delete another user's auction (403 Forbidden)
 * 14. User successfully deleting their own auction (200 OK)
 * 15. Unauthenticated user attempting protected actions (401 Unauthorized)
 */

import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { pool } from '../db/pool.js';
import redis from '../redis/client.js';
import { channel, connection } from '../mq/connection.js';
import { startBidConsumer } from '../mq/consumers/bidConsumer.js';
import { config } from '../config/index.js';

// Helper for polling asynchronous persistence
async function waitFor(fn, { timeout = 5000, interval = 100 } = {}) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

async function runAuthTests() {
  console.log('='.repeat(70));
  console.log('🔒 Starting Authentication & Authorization Integration Test Suite');
  console.log('='.repeat(70));

  let testServer = null;
  let baseUrl = `http://localhost:${config.port}`;
  const testUserIds = [];
  const testAuctionIds = [];

  try {
    // ── Setup in-process server if not running ──────────────────────────────
    try {
      await fetch(`${baseUrl}/auctions`);
      console.log(`[Setup] Connected to server at ${baseUrl}`);
    } catch {
      console.log(`[Setup] Starting in-process HTTP test server and consumer...`);
      await new Promise((resolve) => {
        testServer = app.listen(0, () => {
          const port = testServer.address().port;
          baseUrl = `http://localhost:${port}`;
          console.log(`[Setup] Test server running on ${baseUrl}`);
          resolve();
        });
      });
      await startBidConsumer(channel);
    }

    const uniqueSuffix = Date.now();
    const userA_email = `usera_${uniqueSuffix}@test.com`;
    const userA_username = `usera_${uniqueSuffix}`;
    const userA_password = 'Password123!';

    const userB_email = `userb_${uniqueSuffix}@test.com`;
    const userB_username = `userb_${uniqueSuffix}`;
    const userB_password = 'Password456!';

    let userA_token = '';
    let userA_id = '';
    let userB_token = '';
    let userB_id = '';
    let auctionA_id = '';

    // ── 1. Successful Registration ───────────────────────────────────────────
    console.log('\n▶ Test 1: Successful Registration');
    {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userA_email,
          username: userA_username,
          password: userA_password,
        }),
      });

      assert.strictEqual(res.status, 201, 'Expected HTTP 201 Created');
      const body = await res.json();
      assert.ok(body.token, 'Response must include JWT token');
      assert.ok(body.user, 'Response must include user object');
      assert.strictEqual(body.user.email, userA_email);
      assert.strictEqual(body.user.username, userA_username);
      assert.strictEqual(body.user.role, 'USER');
      assert.strictEqual(body.user.password_hash, undefined, 'Password hash must NEVER be exposed');

      userA_token = body.token;
      userA_id = body.user.id;
      testUserIds.push(userA_id);

      // Verify row in database
      const dbCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userA_id]);
      assert.strictEqual(dbCheck.rows.length, 1);
      assert.notStrictEqual(dbCheck.rows[0].password_hash, userA_password, 'Password must be hashed in DB');

      console.log('  ✔ Test 1 Passed: User registered, token issued, password hash hidden.');
    }

    // ── 2. Duplicate Registration ────────────────────────────────────────────
    console.log('\n▶ Test 2: Duplicate Registration (Email & Username)');
    {
      // Attempt registration with same email
      const resEmail = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userA_email,
          username: `diff_${uniqueSuffix}`,
          password: 'Password123!',
        }),
      });
      assert.strictEqual(resEmail.status, 409, 'Expected HTTP 409 for duplicate email');

      // Attempt registration with same username
      const resUser = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `diff_${uniqueSuffix}@test.com`,
          username: userA_username,
          password: 'Password123!',
        }),
      });
      assert.strictEqual(resUser.status, 409, 'Expected HTTP 409 for duplicate username');

      console.log('  ✔ Test 2 Passed: Duplicate email and username rejected with 409 Conflict.');
    }

    // Register User B for authorization tests
    {
      const resB = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userB_email,
          username: userB_username,
          password: userB_password,
        }),
      });
      assert.strictEqual(resB.status, 201);
      const dataB = await resB.json();
      userB_token = dataB.token;
      userB_id = dataB.user.id;
      testUserIds.push(userB_id);
    }

    // ── 3. Successful Login ──────────────────────────────────────────────────
    console.log('\n▶ Test 3: Successful Login');
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userA_email,
          password: userA_password,
        }),
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 OK on valid credentials');
      const body = await res.json();
      assert.ok(body.token, 'Expected JWT token on login');
      assert.strictEqual(body.user.id, userA_id);
      assert.strictEqual(body.user.password_hash, undefined, 'Password hash must not be exposed on login');

      console.log('  ✔ Test 3 Passed: User login verified with correct token returned.');
    }

    // ── 4. Invalid Password ──────────────────────────────────────────────────
    console.log('\n▶ Test 4: Invalid Password');
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userA_email,
          password: 'WrongPassword123!',
        }),
      });

      assert.strictEqual(res.status, 401, 'Expected HTTP 401 Unauthorized for incorrect password');
      console.log('  ✔ Test 4 Passed: Invalid password rejected with 401 Unauthorized.');
    }

    // ── 5. Missing Authentication Token ───────────────────────────────────────
    console.log('\n▶ Test 5: Missing Authentication Token');
    {
      const res = await fetch(`${baseUrl}/auth/me`);
      assert.strictEqual(res.status, 401, 'Expected HTTP 401 for missing token');
      const body = await res.json();
      assert.ok(body.error.includes('token'), 'Error message should mention token requirement');

      console.log('  ✔ Test 5 Passed: Missing token rejected with 401 Unauthorized.');
    }

    // ── 6. Invalid & Expired Token ───────────────────────────────────────────
    console.log('\n▶ Test 6: Invalid & Expired Token');
    {
      // 6a: Malformed token
      const resInvalid = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: 'Bearer invalid.garbage.token' },
      });
      assert.strictEqual(resInvalid.status, 401, 'Expected HTTP 401 for invalid token');

      // 6b: Expired token
      const expiredToken = jwt.sign(
        { id: userA_id, username: userA_username },
        config.jwt.secret,
        { expiresIn: '-10s' }
      );
      const resExpired = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(resExpired.status, 401, 'Expected HTTP 401 for expired token');
      const bodyExpired = await resExpired.json();
      assert.ok(bodyExpired.error.toLowerCase().includes('expired'));

      console.log('  ✔ Test 6 Passed: Malformed and expired tokens rejected with 401.');
    }

    // ── 7. Authenticated User Accessing Protected Endpoint ───────────────────
    console.log('\n▶ Test 7: Authenticated User Accessing Protected Endpoint (/auth/me)');
    {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${userA_token}` },
      });
      assert.strictEqual(res.status, 200, 'Expected HTTP 200 for valid token');
      const body = await res.json();
      assert.strictEqual(body.user.id, userA_id);
      assert.strictEqual(body.user.email, userA_email);

      console.log('  ✔ Test 7 Passed: Profile accessed with valid Bearer JWT.');
    }

    // ── 8. User Creating an Auction ───────────────────────────────────────────
    console.log('\n▶ Test 8: User Creating an Auction');
    {
      const futureDate = new Date(Date.now() + 2 * 3600000).toISOString();
      const res = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA_token}`,
        },
        body: JSON.stringify({
          item_name: 'Auth Test Auction Lot',
          starting_price: 500.0,
          end_time: futureDate,
          description: 'A test auction for ownership testing',
          category: 'Horology',
        }),
      });

      assert.strictEqual(res.status, 201, 'Expected HTTP 201 Created for auction');
      const body = await res.json();
      assert.ok(body.id, 'Auction ID must be returned');
      assert.strictEqual(body.owner_id, userA_id, 'Auction owner_id must match authenticated user');
      assert.strictEqual(parseFloat(body.starting_price), 500.0);

      auctionA_id = body.id;
      testAuctionIds.push(auctionA_id);

      // Verify Redis max_bid was initialized
      const redisMax = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(parseFloat(redisMax), 500.0, 'Redis max_bid must be initialized');

      console.log('  ✔ Test 8 Passed: Auction created and owner_id assigned to creator.');
    }

    // ── 9. User Placing a Bid (User B bids on User A's auction) ───────────────
    console.log('\n▶ Test 9: User B Placing a Bid on User A’s Auction');
    {
      const bidAmount = 600.0;
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userB_token}`,
        },
        body: JSON.stringify({ bidAmount }),
      });

      assert.strictEqual(res.status, 202, 'Expected HTTP 202 Accepted');
      const body = await res.json();
      assert.strictEqual(body.accepted, true);

      // Verify Redis updated
      const redisMax = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(parseFloat(redisMax), 600.0);

      // Verify async persistence in Postgres
      const persistedBid = await waitFor(async () => {
        const r = await pool.query(
          `SELECT * FROM bids WHERE auction_id = $1 AND bid_amount = $2`,
          [auctionA_id, bidAmount]
        );
        return r.rows.length > 0 ? r.rows[0] : null;
      });

      assert.strictEqual(persistedBid.user_id, userB_id, 'Bid user_id must match User B from JWT');

      console.log('  ✔ Test 9 Passed: User B bid accepted (202), Redis updated, and DB persisted with User B ID.');
    }

    // ── 10. User Attempting to Bid on Their OWN Auction ──────────────────────
    console.log('\n▶ Test 10: User A Attempting to Bid on Their OWN Auction');
    {
      const bidAmount = 700.0;
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA_token}`,
        },
        body: JSON.stringify({ bidAmount }),
      });

      assert.strictEqual(res.status, 403, 'Expected HTTP 403 Forbidden when bidding on own auction');
      const body = await res.json();
      assert.strictEqual(body.accepted, false);
      assert.ok(body.error.includes('own auction'), 'Error should specify cannot bid on own auction');

      // Verify Redis max bid is still 600.0
      const redisMax = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(parseFloat(redisMax), 600.0, 'Redis max_bid must NOT be updated');

      console.log('  ✔ Test 10 Passed: Bidding on own auction rejected with 403 Forbidden.');
    }

    // ── 11. User B Attempting to Modify User A’s Auction ─────────────────────
    console.log('\n▶ Test 11: User B Attempting to Modify User A’s Auction');
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userB_token}`,
        },
        body: JSON.stringify({
          item_name: 'Hacked Title By User B',
        }),
      });

      assert.strictEqual(res.status, 403, 'Expected HTTP 403 Forbidden for non-owner modification');
      const body = await res.json();
      assert.ok(body.error.includes('Forbidden') || body.error.includes('permission'));

      // Check DB was not modified
      const check = await pool.query('SELECT item_name FROM auctions WHERE id = $1', [auctionA_id]);
      assert.strictEqual(check.rows[0].item_name, 'Auth Test Auction Lot');

      console.log('  ✔ Test 11 Passed: Modifying another user’s auction rejected with 403 Forbidden.');
    }

    // ── 12. User A Successfully Modifying Their Own Auction ──────────────────
    console.log('\n▶ Test 12: User A Successfully Modifying Their Own Auction');
    {
      const newTitle = 'Updated Vintage Watch (Auth Test)';
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA_token}`,
        },
        body: JSON.stringify({
          item_name: newTitle,
          description: 'Updated description by legitimate owner.',
        }),
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 OK for owner modification');
      const body = await res.json();
      assert.strictEqual(body.item_name, newTitle);

      const check = await pool.query('SELECT item_name FROM auctions WHERE id = $1', [auctionA_id]);
      assert.strictEqual(check.rows[0].item_name, newTitle);

      console.log('  ✔ Test 12 Passed: Owner successfully modified their auction (200 OK).');
    }

    // ── 13. User B Attempting to Delete User A’s Auction ─────────────────────
    console.log('\n▶ Test 13: User B Attempting to Delete User A’s Auction');
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userB_token}`,
        },
      });

      assert.strictEqual(res.status, 403, 'Expected HTTP 403 Forbidden for non-owner deletion');

      // Verify auction still exists in DB
      const check = await pool.query('SELECT id FROM auctions WHERE id = $1', [auctionA_id]);
      assert.strictEqual(check.rows.length, 1, 'Auction must not be deleted');

      console.log('  ✔ Test 13 Passed: Deleting another user’s auction rejected with 403 Forbidden.');
    }

    // ── 14. User A Successfully Deleting Their Own Auction ───────────────────
    console.log('\n▶ Test 14: User A Successfully Deleting Their Own Auction');
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userA_token}`,
        },
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 OK on successful deletion');

      // Verify auction removed from DB
      const check = await pool.query('SELECT id FROM auctions WHERE id = $1', [auctionA_id]);
      assert.strictEqual(check.rows.length, 0, 'Auction must be deleted from PostgreSQL');

      // Verify Redis key deleted
      const redisCheck = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(redisCheck, null, 'Redis max_bid key must be deleted');

      console.log('  ✔ Test 14 Passed: Owner successfully deleted their auction lot (200 OK).');
    }

    // ── 15. Unauthenticated User Attempting Protected Actions ────────────────
    console.log('\n▶ Test 15: Unauthenticated User Attempting Protected Actions');
    {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const postAuction = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: 'test' }),
      });
      assert.strictEqual(postAuction.status, 401, 'POST /auctions must be 401');

      const putAuction = await fetch(`${baseUrl}/auctions/${fakeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: 'test' }),
      });
      assert.strictEqual(putAuction.status, 401, 'PUT /auctions/:id must be 401');

      const deleteAuction = await fetch(`${baseUrl}/auctions/${fakeId}`, {
        method: 'DELETE',
      });
      assert.strictEqual(deleteAuction.status, 401, 'DELETE /auctions/:id must be 401');

      const postBid = await fetch(`${baseUrl}/auctions/${fakeId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidAmount: 100 }),
      });
      assert.strictEqual(postBid.status, 401, 'POST /auctions/:id/bids must be 401');

      const myBids = await fetch(`${baseUrl}/auctions/user/my-bids`);
      assert.strictEqual(myBids.status, 401, 'GET /auctions/user/my-bids must be 401');

      const myAuctions = await fetch(`${baseUrl}/auctions/user/my-auctions`);
      assert.strictEqual(myAuctions.status, 401, 'GET /auctions/user/my-auctions must be 401');

      console.log('  ✔ Test 15 Passed: All protected endpoints reject unauthenticated requests with 401.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL 15 AUTHENTICATION & AUTHORIZATION TESTS PASSED SUCCESSFULLY!');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    // ── Cleanup fixtures ─────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning test users and auctions...');
    try {
      if (testAuctionIds.length > 0) {
        await pool.query('DELETE FROM auctions WHERE id = ANY($1::uuid[])', [testAuctionIds]);
        for (const id of testAuctionIds) {
          await redis.del(`auction:${id}:max_bid`);
        }
      }
      if (testUserIds.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [testUserIds]);
      }
      console.log('[Cleanup] Fixtures cleaned.');
    } catch (e) {
      console.warn('[Cleanup] Error:', e.message);
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

runAuthTests();
