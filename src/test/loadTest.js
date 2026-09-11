import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pool } from '../db/pool.js';
import redis from '../redis/client.js';
import { channel, connection } from '../mq/connection.js';
import { config } from '../config/index.js';
import { generateToken } from '../utils/auth.js';

const execFileAsync = promisify(execFile);
const baseUrl = process.env.LOAD_TEST_BASE_URL ?? `http://localhost:${config.port}`;
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 10000);
const report = [];
const createdAuctionIds = [];

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function percentile(values, percentage) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarize(results, durationMs) {
  const latencies = results.map((result) => result.latencyMs);
  return {
    total: results.length,
    accepted: results.filter((result) => result.status === 202 && result.body?.accepted === true).length,
    rejected: results.filter((result) => result.status === 409 && result.body?.accepted === false).length,
    failed: results.filter((result) => result.status >= 500 || result.error).length,
    timeouts: results.filter((result) => result.timeout).length,
    other4xx: results.filter((result) => result.status >= 400 && result.status < 500 && result.status !== 409).length,
    durationMs: Math.round(durationMs),
    requestsPerSecond: Number((results.length / Math.max(durationMs / 1000, 0.001)).toFixed(2)),
    p50: Math.round(percentile(latencies, 50)),
    p95: Math.round(percentile(latencies, 95)),
    p99: Math.round(percentile(latencies, 99)),
  };
}

async function waitFor(predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeout}ms`);
}

async function createAuction(startingPrice) {
  const { rows } = await pool.query(
    `INSERT INTO auctions
       (item_name, title, description, starting_price, current_max_bid,
        start_time, end_time, minimum_bid_increment, status)
     VALUES ($1, $1, $2, $3, $3, CURRENT_TIMESTAMP - INTERVAL '1 minute',
             CURRENT_TIMESTAMP + INTERVAL '2 hours', 1, 'LIVE')
     RETURNING id`,
    [`Load test auction ${Date.now()}-${createdAuctionIds.length}`, 'Load test fixture', startingPrice]
  );
  const auctionId = rows[0].id;
  createdAuctionIds.push(auctionId);
  await redis.set(`auction:${auctionId}:max_bid`, startingPrice.toFixed(2));
  return auctionId;
}

async function submitBid(auctionId, bidAmount, userId) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/auctions/${auctionId}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${generateToken({ id: userId, username: userId, email: `${userId}@load.test` })}`,
      },
      body: JSON.stringify({ bidAmount }),
      signal: controller.signal,
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    return { status: response.status, body, latencyMs: performance.now() - started };
  } catch (error) {
    return { error: error.message, timeout: error.name === 'AbortError', latencyMs: performance.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function burst(auctionId, bids) {
  const started = performance.now();
  const results = await Promise.all(
    bids.map((bidAmount, index) => submitBid(auctionId, bidAmount, `load-${Date.now()}-${index}`))
  );
  return { results, summary: summarize(results, performance.now() - started) };
}

async function queueDepth() {
  const result = await channel.checkQueue(config.rabbitmq.bidQueue);
  return { ready: result.messageCount, consumers: result.consumerCount };
}

async function dockerStats() {
  try {
    const { stdout } = await execFileAsync('docker', [
      'stats', '--no-stream', '--format', '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}',
    ]);
    return stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const [name, cpu, memory, memoryPercent] = line.split('|');
      return { name, cpu, memory, memoryPercent };
    });
  } catch (error) {
    return [{ error: error.message }];
  }
}

async function waitForPersistence(auctionId, expectedCount, timeout = 15000) {
  await waitFor(async () => {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM bids WHERE auction_id = $1', [auctionId]);
    return rows[0].count >= expectedCount;
  }, timeout);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count, MAX(bid_amount)::numeric AS max_bid
     FROM bids WHERE auction_id = $1`,
    [auctionId]
  );
  return rows[0];
}

async function verifyAuctionState(auctionId) {
  const redisValue = await redis.get(`auction:${auctionId}:max_bid`);
  const { rows } = await pool.query(
    'SELECT current_max_bid::numeric AS current_max_bid FROM auctions WHERE id = $1',
    [auctionId]
  );
  return { redis: Number(redisValue), postgres: Number(rows[0].current_max_bid), queue: await queueDepth() };
}

async function runIdenticalBids(concurrency) {
  const auctionId = await createAuction(100);
  const { summary } = await burst(auctionId, Array(concurrency).fill(150));
  assert.equal(summary.accepted, 1);
  assert.equal(summary.rejected, concurrency - 1);
  const persisted = await waitForPersistence(auctionId, 1);
  const state = await verifyAuctionState(auctionId);
  assert.equal(persisted.count, 1);
  assert.equal(state.redis, 150);
  assert.equal(state.postgres, 150);
  report.push({ test: 'identical-bids', concurrency, ...summary, persisted, state, resources: await dockerStats() });
}

async function runDifferentBids(concurrency) {
  const auctionId = await createAuction(100);
  const amounts = [200, 250, 300, 350, 500];
  const bids = Array.from({ length: concurrency }, (_, index) => amounts[index % amounts.length]);
  const { summary } = await burst(auctionId, bids);
  await waitForPersistence(auctionId, summary.accepted);
  const state = await verifyAuctionState(auctionId);
  assert.equal(state.redis, 500);
  assert.equal(state.postgres, 500);
  report.push({ test: 'different-bids', concurrency, ...summary, state, resources: await dockerStats() });
}

async function runMultiAuction(perAuction) {
  const auctions = await Promise.all([100, 200, 300, 400].map(createAuction));
  const started = performance.now();
  const batches = await Promise.all(auctions.map((auctionId, auctionIndex) => (
    burst(auctionId, Array.from({ length: perAuction }, (_, index) => 1000 + auctionIndex * 1000 + index))
  )));
  const results = batches.flatMap((batch) => batch.results);
  await waitFor(async () => {
    const queue = await queueDepth();
    return queue.ready === 0 ? queue : null;
  }, 120000);
  for (const [index, auctionId] of auctions.entries()) {
    await waitForPersistence(auctionId, batches[index].summary.accepted, 120000);
    const state = await verifyAuctionState(auctionId);
    assert.equal(state.postgres, state.redis);
  }
  report.push({ test: 'multi-auction', auctions: auctions.length, perAuction, ...summarize(results, performance.now() - started), resources: await dockerStats() });
}

async function runSustained(clients, durationSeconds) {
  const auctions = await Promise.all([100, 200, 300, 400].map(createAuction));
  const deadline = Date.now() + durationSeconds * 1000;
  const results = [];
  async function client(clientIndex) {
    let attempt = 0;
    while (Date.now() < deadline) {
      const auctionId = auctions[(clientIndex + attempt) % auctions.length];
      results.push(await submitBid(auctionId, 101 + clientIndex + attempt, `sustained-${clientIndex}-${attempt}`));
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 100 + ((clientIndex * 17 + attempt) % 400)));
    }
  }
  await Promise.all(Array.from({ length: clients }, (_, index) => client(index)));
  await waitFor(async () => {
    const queue = await queueDepth();
    return queue.ready === 0 ? queue : null;
  }, 120000);
  report.push({ test: 'sustained', clients, durationSeconds, ...summarize(results, durationSeconds * 1000), resources: await dockerStats() });
}

async function main() {
  const scenario = argument('scenario', 'all');
  const concurrency = Number(argument('concurrency', 50));
  console.log(JSON.stringify({ event: 'load-test-start', baseUrl, scenario, timeoutMs }));
  const health = await fetch(`${baseUrl}/auctions`);
  assert.equal(health.ok, true, `API health check failed with ${health.status}`);

  if (scenario === 'baseline' || scenario === 'identical-bids') await runIdenticalBids(concurrency);
  if (scenario === 'different-bids') await runDifferentBids(concurrency);
  if (scenario === 'multi-auction') await runMultiAuction(Number(argument('per-auction', 250)));
  if (scenario === 'sustained') await runSustained(Number(argument('clients', 250)), Number(argument('duration', 60)));
  if (scenario === 'all') {
    for (const level of [10, 50, 100, 500, 1000]) await runIdenticalBids(level);
    await runDifferentBids(500);
    await runMultiAuction(250);
    await runSustained(250, 60);
  }
  console.log(JSON.stringify({ event: 'load-test-results', report }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ event: 'load-test-failed', error: error.stack ?? error.message }));
  process.exitCode = 1;
} finally {
  try {
    if (createdAuctionIds.length) {
      await pool.query('DELETE FROM auctions WHERE id = ANY($1::uuid[])', [createdAuctionIds]);
      await Promise.all(createdAuctionIds.map((id) => redis.del(`auction:${id}:max_bid`)));
    }
  } finally {
    await redis.quit();
    await pool.end();
    await channel.close().catch(() => {});
    await connection.close().catch(() => {});
  }
}