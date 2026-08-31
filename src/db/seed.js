/**
 * src/db/seed.js
 *
 * Seeds sample auction data into PostgreSQL and Redis for development and testing.
 */

import { pool } from './pool.js';
import { redis } from '../redis/client.js';

export async function seedDemoAuction() {
  console.log('[Seed] Creating demo live auction...');

  const sql = `
    INSERT INTO auctions (item_name, starting_price, current_max_bid, end_time)
    VALUES ($1, $2, $3, NOW() + INTERVAL '2 hours')
    RETURNING id, item_name, starting_price, current_max_bid, end_time
  `;

  const { rows } = await pool.query(sql, [
    '2026 Chrono Collector Watch - Limited Edition',
    250.0,
    250.0,
  ]);

  const demoAuction = rows[0];
  const redisKey = `auction:${demoAuction.id}:max_bid`;

  await redis.set(redisKey, demoAuction.starting_price.toString());

  console.log('\n=============================================================');
  console.log('✅ Demo Auction created successfully!');
  console.log('-------------------------------------------------------------');
  console.log(`Auction ID    : ${demoAuction.id}`);
  console.log(`Item Name     : ${demoAuction.item_name}`);
  console.log(`Starting Price: $${demoAuction.starting_price}`);
  console.log(`Redis Key Set : ${redisKey} -> ${demoAuction.starting_price}`);
  console.log(`Frontend URL  : http://localhost:5173/?auctionId=${demoAuction.id}`);
  console.log('=============================================================\n');

  return demoAuction;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDemoAuction()
    .then(async () => {
      await redis.quit();
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Error seeding data:', err);
      await redis.quit();
      await pool.end();
      process.exit(1);
    });
}
