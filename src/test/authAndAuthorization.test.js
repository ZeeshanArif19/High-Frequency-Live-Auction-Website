/**
 * src/test/authAndAuthorization.test.js
 *
 * Comprehensive test suite validating:
 *  1.  Successful registration (201, password hash never exposed)
 *  2.  Duplicate registration (409 Conflict)
 *  3.  Successful login (200, JWT returned)
 *  4.  Invalid password (401 Unauthorized)
 *  5.  Missing authentication token (401 Unauthorized)
 *  6.  Invalid and expired token (401 Unauthorized)
 *  7.  Authenticated user accessing a protected endpoint (200 OK)
 *  8.  Successful auction creation with all required fields (201, owner_id = JWT user, Redis initialized)
 *  9.  Invalid auction data rejected (400 Bad Request) ? missing fields, bad startTime/endTime, non-positive price
 * 10.  Unauthenticated auction creation attempt (401)
 * 11.  Auction correctly associated with authenticated owner (owner_id cannot be spoofed via body)
 * 12.  User editing their own auction before LIVE (200 OK)
 * 13.  User attempting to edit another user's auction (403 Forbidden)
 * 14.  User attempting to delete another user's auction (403 Forbidden)
 * 15.  Editing a LIVE auction bidding fields when it should be forbidden (400)
 * 16.  User attempting to bid on their own auction (403 Forbidden)
 * 17.  Valid user bidding on another user's auction (202 Accepted, Redis updated, DB persisted)
 * 18.  User placing a bid on eligible auction (existing tests preserved)
 * 19.  User modifying their own LIVE auction cosmetic fields (200 OK)
 * 20.  User deleting auction with no bids (200 OK)
 * 21.  User attempting to delete auction after bids placed (400)
 * 22.  Unauthenticated user attempting all protected actions (401)
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

function databaseTime(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function runAuthTests() {
  console.log('='.repeat(70));
  console.log('?? Starting Auth, Authorization & Auction Lifecycle Integration Tests');
  console.log('='.repeat(70));

  let testServer = null;
  let baseUrl = `http://localhost:${config.port}`;
  const testUserIds = [];
  const testAuctionIds = [];

  try {
    // ?? Setup in-process server if not running ??????????????????????????????
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

    // Shared future timestamps for auction creation
    const futureStart = databaseTime(60000);                 // 1 min from now
    const futureEnd = databaseTime(2 * 3600000);             // 2 hours from now
    const pastStart = databaseTime(-2 * 3600000);             // 2 hours ago
    const nearFutureEnd = databaseTime(3600000);             // 1 hour from now

    // ?? 1. Successful Registration ???????????????????????????????????????????
    console.log('\n? Test 1: Successful Registration');
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

      const dbCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userA_id]);
      assert.strictEqual(dbCheck.rows.length, 1);
      assert.notStrictEqual(dbCheck.rows[0].password_hash, userA_password, 'Password must be hashed in DB');

      console.log('  ? Test 1 Passed: User registered, token issued, password hash hidden.');
    }

    // ?? 2. Duplicate Registration ????????????????????????????????????????????
    console.log('\n? Test 2: Duplicate Registration (Email & Username)');
    {
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

      console.log('  ? Test 2 Passed: Duplicate email and username rejected with 409 Conflict.');
    }

    // Register User B
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

    // ?? 3. Successful Login ??????????????????????????????????????????????????
    console.log('\n? Test 3: Successful Login');
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userA_email, password: userA_password }),
      });

      assert.strictEqual(res.status, 200, 'Expected HTTP 200 OK on valid credentials');
      const body = await res.json();
      assert.ok(body.token, 'Expected JWT token on login');
      assert.strictEqual(body.user.id, userA_id);
      assert.strictEqual(body.user.password_hash, undefined, 'Password hash must not be exposed on login');

      console.log('  ? Test 3 Passed: User login verified with correct token returned.');
    }

    // ?? 4. Invalid Password ??????????????????????????????????????????????????
    console.log('\n? Test 4: Invalid Password');
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userA_email, password: 'WrongPassword123!' }),
      });
      assert.strictEqual(res.status, 401);
      console.log('  ? Test 4 Passed: Invalid password rejected with 401 Unauthorized.');
    }

    // ?? 5. Missing Authentication Token ?????????????????????????????????????
    console.log('\n? Test 5: Missing Authentication Token');
    {
      const res = await fetch(`${baseUrl}/auth/me`);
      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.ok(body.error.toLowerCase().includes('token'));
      console.log('  ? Test 5 Passed: Missing token rejected with 401 Unauthorized.');
    }

    // ?? 6. Invalid & Expired Token ???????????????????????????????????????????
    console.log('\n? Test 6: Invalid & Expired Token');
    {
      const resInvalid = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: 'Bearer invalid.garbage.token' },
      });
      assert.strictEqual(resInvalid.status, 401);

      const expiredToken = jwt.sign(
        { id: userA_id, username: userA_username },
        config.jwt.secret,
        { expiresIn: '-10s' }
      );
      const resExpired = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(resExpired.status, 401);
      const bodyExpired = await resExpired.json();
      assert.ok(bodyExpired.error.toLowerCase().includes('expired'));

      console.log('  ? Test 6 Passed: Malformed and expired tokens rejected with 401.');
    }

    // ?? 7. Authenticated User Accessing Protected Endpoint ???????????????????
    console.log('\n? Test 7: Authenticated User Accessing Protected Endpoint (/auth/me)');
    {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${userA_token}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.user.id, userA_id);
      assert.strictEqual(body.user.email, userA_email);
      console.log('  ? Test 7 Passed: Profile accessed with valid Bearer JWT.');
    }

    // ?? 8. Successful Auction Creation With All Required Fields ??????????????
    console.log('\n? Test 8: Successful Auction Creation (all required fields)');
    {
      const res = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Auth Test Auction Lot',
          description: 'A test auction for ownership testing and lifecycle validation.',
          startingPrice: 500.0,
          minimumBidIncrement: 50.0,
          startTime: pastStart,     // already started ? LIVE for bid tests
          endTime: nearFutureEnd,
          category: 'Horology',
        }),
      });

      assert.strictEqual(res.status, 201, 'Expected HTTP 201 Created for auction');
      const body = await res.json();
      assert.ok(body.id, 'Auction ID must be returned');
      assert.strictEqual(body.owner_id, userA_id, 'owner_id must match authenticated user');
      assert.strictEqual(parseFloat(body.starting_price), 500.0);
      assert.ok(body.title, 'title must be returned');
      assert.ok(body.minimum_bid_increment, 'minimum_bid_increment must be returned');

      auctionA_id = body.id;
      testAuctionIds.push(auctionA_id);

      // Verify Redis max_bid was initialized
      const redisMax = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(parseFloat(redisMax), 500.0, 'Redis max_bid must be initialized to startingPrice');

      console.log('  ? Test 8 Passed: Auction created, owner_id assigned from JWT, Redis initialized.');
    }

    // ?? 9. Invalid Auction Data Rejected ????????????????????????????????????
    console.log('\n? Test 9: Invalid Auction Data (validation failures)');
    {
      // 9a: Missing required fields
      const resMissing = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({ title: 'Incomplete Auction' }),
      });
      assert.strictEqual(resMissing.status, 400, 'Missing fields should return 400');

      // 9b: Non-positive starting price
      const resNegPrice = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Bad Price Auction',
          description: 'Test',
          startingPrice: -100,
          minimumBidIncrement: 10,
          startTime: futureStart,
          endTime: futureEnd,
        }),
      });
      assert.strictEqual(resNegPrice.status, 400, 'Non-positive starting price should return 400');

      // 9c: Non-positive minimum bid increment
      const resNegIncr = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Bad Increment Auction',
          description: 'Test',
          startingPrice: 100,
          minimumBidIncrement: 0,
          startTime: futureStart,
          endTime: futureEnd,
        }),
      });
      assert.strictEqual(resNegIncr.status, 400, 'Zero minimumBidIncrement should return 400');

      // 9d: startTime >= endTime
      const resBadTimes = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Bad Times Auction',
          description: 'Test',
          startingPrice: 100,
          minimumBidIncrement: 10,
          startTime: futureEnd,   // start > end ? reversed
          endTime: futureStart,
        }),
      });
      assert.strictEqual(resBadTimes.status, 400, 'startTime >= endTime should return 400');

      console.log('  ? Test 9 Passed: Invalid auction data correctly rejected with 400.');
    }

    // ?? 10. Unauthenticated Auction Creation ?????????????????????????????????
    console.log('\n? Test 10: Unauthenticated Auction Creation Attempt');
    {
      const res = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Unauth Auction',
          description: 'Test',
          startingPrice: 100,
          minimumBidIncrement: 10,
          startTime: futureStart,
          endTime: futureEnd,
        }),
      });
      assert.strictEqual(res.status, 401, 'Unauthenticated POST /auctions must be 401');
      console.log('  ? Test 10 Passed: Unauthenticated auction creation rejected with 401.');
    }

    // ?? 11. Owner Spoofing Prevention ????????????????????????????????????????
    console.log('\n? Test 11: Auction owner cannot be spoofed via request body');
    {
      const res = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Spoof Test Auction',
          description: 'Testing owner spoof prevention',
          startingPrice: 100,
          minimumBidIncrement: 10,
          startTime: futureStart,
          endTime: futureEnd,
          // Attempt to set ownership to userB ? must be ignored
          ownerId: userB_id,
          sellerId: userB_id,
          owner_id: userB_id,
        }),
      });

      assert.strictEqual(res.status, 201, 'Expected 201 Created');
      const body = await res.json();
      assert.strictEqual(body.owner_id, userA_id, 'owner_id must be sourced from JWT, not request body');
      assert.notStrictEqual(body.owner_id, userB_id, 'owner_id must NOT be the spoofed userB ID');
      testAuctionIds.push(body.id);
      console.log('  ? Test 11 Passed: owner_id correctly sourced from JWT ? spoof attempt ignored.');
    }

    // ?? 12. User Editing Their Own Pre-LIVE Auction ??????????????????????????
    console.log('\n? Test 12: User A editing their own auction before LIVE');
    {
      // Create a pre-LIVE auction (startTime in the future)
      const createRes = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Pre-LIVE Auction',
          description: 'Can be edited before going live.',
          startingPrice: 1000.0,
          minimumBidIncrement: 100.0,
          startTime: databaseTime(10 * 60000),
          endTime: databaseTime(60 * 60000),
          category: 'Fine Art',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const created = await createRes.json();
      testAuctionIds.push(created.id);

      const updatedTitle = 'Updated Pre-LIVE Auction Title';
      const editRes = await fetch(`${baseUrl}/auctions/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({ title: updatedTitle }),
      });

      assert.strictEqual(editRes.status, 200, 'Expected 200 OK for valid owner edit');
      const updated = await editRes.json();
      assert.strictEqual(updated.title, updatedTitle, 'Title should be updated');

      const check = await pool.query(
        `SELECT COALESCE(title, item_name) AS title FROM auctions WHERE id = $1`,
        [created.id]
      );
      assert.strictEqual(check.rows[0].title, updatedTitle);
      console.log('  ? Test 12 Passed: Owner successfully edited their pre-LIVE auction (200 OK).');
    }

    // ?? 13. User B Attempting to Modify User A's Auction ?????????????????????
    console.log(`\n? Test 13: User B Attempting to Modify User A's Auction`);
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB_token}` },
        body: JSON.stringify({ title: 'Hacked Title By User B' }),
      });

      assert.strictEqual(res.status, 403, 'Expected HTTP 403 Forbidden');
      const body = await res.json();
      assert.ok(body.error.includes('Forbidden') || body.error.includes('permission'));

      const check = await pool.query(
        `SELECT COALESCE(title, item_name) AS title FROM auctions WHERE id = $1`,
        [auctionA_id]
      );
      assert.strictEqual(check.rows[0].title, 'Auth Test Auction Lot', 'Auction title must not be modified');
      console.log(`  ? Test 13 Passed: Modifying another user's auction rejected with 403 Forbidden.`);
    }

    // ?? 14. User B Attempting to Delete User A's Auction ?????????????????????
    console.log(`\n? Test 14: User B Attempting to Delete User A's Auction`);
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userB_token}` },
      });

      assert.strictEqual(res.status, 403, 'Expected HTTP 403 Forbidden');
      const check = await pool.query('SELECT id FROM auctions WHERE id = $1', [auctionA_id]);
      assert.strictEqual(check.rows.length, 1, 'Auction must not be deleted');
      console.log(`  ? Test 14 Passed: Deleting another user's auction rejected with 403 Forbidden.`);
    }

    // ?? 15. Editing a LIVE Auction's Bidding Fields (Forbidden) ??????????????
    console.log('\n? Test 15: Editing a LIVE auction bidding fields should be forbidden');
    {
      // auctionA_id uses pastStart so it's LIVE now
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          startingPrice: 9999.0,  // bidding parameter ? forbidden when LIVE
        }),
      });

      assert.strictEqual(res.status, 400, 'Expected HTTP 400 when modifying bidding params on LIVE auction');
      const body = await res.json();
      assert.ok(body.error.toLowerCase().includes('live') || body.error.toLowerCase().includes('bidding'), 'Error should mention LIVE or bidding');
      console.log('  ? Test 15 Passed: Editing LIVE auction bidding parameters rejected with 400.');
    }

    // ?? 16. User A Attempting to Bid on Their Own Auction ????????????????????
    console.log('\n? Test 16: User A Attempting to Bid on Their Own Auction');
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({ bidAmount: 700.0 }),
      });

      assert.strictEqual(res.status, 403, 'Expected HTTP 403 Forbidden when bidding on own auction');
      const body = await res.json();
      assert.strictEqual(body.accepted, false);
      assert.ok(body.error.includes('own auction'), 'Error should specify cannot bid on own auction');

      const redisMax = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(parseFloat(redisMax), 500.0, 'Redis max_bid must NOT be updated when owner bids');
      console.log('  ? Test 16 Passed: Bidding on own auction rejected with 403 Forbidden.');
    }

    // ?? 17. User B Bidding on User A's Auction (Valid) ????????????????????????
    console.log(`\n? Test 17: User B Placing a Valid Bid on User A's Auction`);
    {
      const bidAmount = 600.0;
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB_token}` },
        body: JSON.stringify({ bidAmount }),
      });

      assert.strictEqual(res.status, 202, 'Expected HTTP 202 Accepted');
      const body = await res.json();
      assert.strictEqual(body.accepted, true);

      // Verify Redis updated
      const redisMax = await redis.get(`auction:${auctionA_id}:max_bid`);
      assert.strictEqual(parseFloat(redisMax), 600.0, 'Redis max_bid must be updated');

      // Verify async persistence in Postgres
      const persistedBid = await waitFor(async () => {
        const r = await pool.query(
          `SELECT * FROM bids WHERE auction_id = $1 AND bid_amount = $2`,
          [auctionA_id, bidAmount]
        );
        return r.rows.length > 0 ? r.rows[0] : null;
      });

      assert.strictEqual(persistedBid.user_id, userB_id, 'Bid user_id must match User B from JWT');
      console.log('  ? Test 17 Passed: User B bid accepted (202), Redis updated, DB persisted with User B ID.');
    }

    // ?? 18. Editing a LIVE Auction with Bids Is Forbidden ????????????????????
    console.log('\n? Test 18: Editing a LIVE auction with existing bids is forbidden');
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({ title: 'Should fail due to bids' }),
      });

      // LIVE + bids ? 400 Cannot modify
      assert.strictEqual(res.status, 400, 'Expected 400 ? cannot modify auction once bidding has commenced');
      console.log('  ? Test 18 Passed: Modifying LIVE auction with bids rejected with 400.');
    }

    // ?? 19. Deleting Auction with Bids Is Forbidden ???????????????????????????
    console.log('\n? Test 19: Deleting an auction after bids have been placed is forbidden');
    {
      const res = await fetch(`${baseUrl}/auctions/${auctionA_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userA_token}` },
      });

      assert.strictEqual(res.status, 400, 'Expected 400 ? cannot delete auction with bids');
      const body = await res.json();
      assert.ok(body.error.toLowerCase().includes('bid') || body.error.toLowerCase().includes('delete'));

      const check = await pool.query('SELECT id FROM auctions WHERE id = $1', [auctionA_id]);
      assert.strictEqual(check.rows.length, 1, 'Auction must still exist in DB');
      console.log('  ? Test 19 Passed: Deleting auction with bids rejected with 400.');
    }

    // ?? 20. Unauthenticated User Attempting Protected Actions ?????????????????
    console.log('\n? Test 20: Unauthenticated User Attempting Protected Actions');
    {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const postAuction = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test' }),
      });
      assert.strictEqual(postAuction.status, 401, 'POST /auctions must be 401');

      const putAuction = await fetch(`${baseUrl}/auctions/${fakeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test' }),
      });
      assert.strictEqual(putAuction.status, 401, 'PUT /auctions/:id must be 401');

      const deleteAuction = await fetch(`${baseUrl}/auctions/${fakeId}`, { method: 'DELETE' });
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

      console.log('  ? Test 20 Passed: All protected endpoints reject unauthenticated requests with 401.');
    }

    // ?? 21. User Successfully Deleting Own Auction With No Bids ??????????????
    console.log('\n? Test 21: User A successfully deleting their own no-bid auction');
    {
      // Create a fresh auction with no bids
      const createRes = await fetch(`${baseUrl}/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA_token}` },
        body: JSON.stringify({
          title: 'Deletable Auction',
          description: 'This will be deleted.',
          startingPrice: 200.0,
          minimumBidIncrement: 20.0,
          startTime: futureStart,
          endTime: futureEnd,
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const created = await createRes.json();

      const delRes = await fetch(`${baseUrl}/auctions/${created.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userA_token}` },
      });
      assert.strictEqual(delRes.status, 200, 'Expected 200 OK on successful deletion');

      const dbCheck = await pool.query('SELECT id FROM auctions WHERE id = $1', [created.id]);
      assert.strictEqual(dbCheck.rows.length, 0, 'Auction must be removed from DB');

      const redisCheck = await redis.get(`auction:${created.id}:max_bid`);
      assert.strictEqual(redisCheck, null, 'Redis key must be deleted');

      console.log('  ? Test 21 Passed: Owner successfully deleted no-bid auction (200 OK).');
    }

    // ?? 22. My Auctions Endpoint Returns Correct User's Auctions ?????????????
    console.log('\n? Test 22: GET /auctions/user/my-auctions returns correct user data');
    {
      const res = await fetch(`${baseUrl}/auctions/user/my-auctions`, {
        headers: { Authorization: `Bearer ${userA_token}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body), 'Response must be an array');
      assert.ok(body.every((a) => a.owner_id === userA_id), 'All returned auctions must belong to User A');
      console.log('  ? Test 22 Passed: My Auctions endpoint returns only the authenticated user\'s auctions.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('?? ALL 22 AUTHENTICATION & AUTHORIZATION TESTS PASSED SUCCESSFULLY!');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('\n? Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    // ?? Cleanup fixtures ?????????????????????????????????????????????????????
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
      try { await channel.close(); } catch {}
    }
    if (connection) {
      try { await connection.close(); } catch {}
    }
  }
}

runAuthTests();

