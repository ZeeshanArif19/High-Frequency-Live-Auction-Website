/**
 * src/db/seed.js
 *
 * Seeds sample auction data and bid history into PostgreSQL and Redis for development and testing.
 */

import { pool } from './pool.js';
import { redis } from '../redis/client.js';
import { hashPassword } from '../utils/auth.js';
import { initializeAuctionState } from '../redis/scripts/index.js';

const DEMO_AUCTIONS = [
  {
    itemName: 'A. Lange & Söhne Datograph Perpetual',
    category: 'Horology',
    lotNumber: '402',
    description: 'Platinum case, black dial. Reference 403.035. Flyback chronograph with perpetual calendar. Complete with original box and papers.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO1DX2P9y4CRKbeqmFsUN8Sm28ldyeDNvre4CGrzXXeAoe8ktB-1a4WgqJKCBD5DGOOaoT-yhxBnC0vhiWBHsk2hdxQqPCWWU9pJp5OZqBkz7zQgxMf-sZG4lJ9Sco1oLSy21KCZFyPn8KGaTQdBJhvKkQBA8BLgZ1kluHwx8oGNHBZxhSO-Mfd59c7o_eg6ynv-bJPf25DOX_Z7Ixwf-OG8y_RMKTGOpDxiNym-NzrFoevTf04GdHNw',
    startingPrice: 2000000.0,
    currentMaxBid: 2417000.0,
    hoursToEnd: 4,
    bids: [
      { userId: 'GUEST_901', amount: 2050000.0, minsAgo: 25 },
      { userId: 'TRADER_42', amount: 2217000.0, minsAgo: 18 },
      { userId: 'ALPHA_WOLF', amount: 2317000.0, minsAgo: 8 },
      { userId: 'TRADER_42', amount: 2417000.0, minsAgo: 2 },
    ],
  },
  {
    itemName: '1962 Ferrari 250 GTO Competizione Spec',
    category: 'Automotive',
    lotNumber: '088',
    description: 'Immaculate Classiche certified restoration. Matching numbers 3.0L Colombo V12 engine. Eligible for Mille Miglia and Goodwood Revival.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGTFUpZc_UzS4RoxqIEAHevcJ_LehR39HTF0AAyP8CyiqEBgSuJYcBgVFi_FXe9MBnSBZLv6U5Yav8d6iEwhtZ9Txz-C25cHu2zDKrSAyS9wXRVvddz5NCHV_9Prs7-onaH4pDyfN0nm7RY5TFzEbFdLzMpwWWxDGIMWpD4opD2AXg5nTF45TLjRCslXr6krzrQll9L6ny4CSaahokUmOzqqTVVZqcYO0-fvQG102Iqr9C78ks246zLg',
    startingPrice: 20000000.0,
    currentMaxBid: 24170000.0,
    hoursToEnd: 6,
    bids: [
      { userId: 'SCUDERIA_X', amount: 21000000.0, minsAgo: 45 },
      { userId: 'MONACO_VAULT', amount: 22500000.0, minsAgo: 30 },
      { userId: 'APEX_COLLECTOR', amount: 24170000.0, minsAgo: 10 },
    ],
  },
  {
    itemName: 'Genesis Block Artefact #004',
    category: 'Digital Asset',
    lotNumber: '774',
    description: 'Cryptographically signed early network artifact. Transferred directly from cold storage multi-sig enclave with cryptographic proof of provenance.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAKN8XxVQickP8I6N3vPaRq9r7kRI_w7_wtxc-zG1MEVgWBMUwmYzzgLe0fOxmpfuV8JvToRg5M5PmD8yhr2ykDKqpiLNx0Fs5sI5EVZPv7DxzJ5rhwgm_q5dHwVsNh0k50zQRHmgRMpaGeFOxozxI83WpePXMwy4zlVaZfM4qzKmpABVprHGevqEebXnC_8Pl3HB3ZENYLkCk4O9IA3Tek4NkOFtxiG08fM2k0ukPeIrrXHqXv8wXgLg',
    startingPrice: 3500000.0,
    currentMaxBid: 4025000.0,
    hoursToEnd: 2,
    bids: [
      { userId: 'SATOSHI_NODE', amount: 3600000.0, minsAgo: 35 },
      { userId: 'BYTE_VENTURES', amount: 3850000.0, minsAgo: 20 },
      { userId: 'ETHER_WHALE', amount: 4025000.0, minsAgo: 5 },
    ],
  },
  {
    itemName: 'Patek Philippe Grandmaster Chime 6300G',
    category: 'Horology',
    lotNumber: '512',
    description: 'White gold reversible double-dial case. 20 complications including 5 chiming modes. Factory sealed in original double-box with presentation case.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmhcVEE2OZDSGgrnP0VWEeall_0cmiqG1abdjbKLLrlD8KMK-ZaOQEutlNkitBEY6pJA4mYbD6QsVvMQ3cwCU5lB52fukMvIqWX-n2ClEnLHUmBi_3b3vLD4TYKTTfUXudZTV-jQ89pb8ELBDgdUyo_7REot1Y6soCdfVWt3IJHrCoVfWNkxA3sS8S3BnLt0vjFV1x5mqdcrYnroyv5lpjWng4SB1EVUxjNQPnQb1ymohk99iznfvh1w',
    startingPrice: 15000000.0,
    currentMaxBid: 18500000.0,
    hoursToEnd: 8,
    bids: [
      { userId: 'GENEVA_VAULT', amount: 16000000.0, minsAgo: 50 },
      { userId: 'CHRONO_KING', amount: 18500000.0, minsAgo: 14 },
    ],
  },
  {
    itemName: '1955 Mercedes-Benz 300 SL Gullwing',
    category: 'Automotive',
    lotNumber: '620',
    description: 'Silver Metallic over Blue Tartan interior. Matching-numbers M198 engine with Bosch mechanical direct fuel injection. Complete documentation history.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGTFUpZc_UzS4RoxqIEAHevcJ_LehR39HTF0AAyP8CyiqEBgSuJYcBgVFi_FXe9MBnSBZLv6U5Yav8d6iEwhtZ9Txz-C25cHu2zDKrSAyS9wXRVvddz5NCHV_9Prs7-onaH4pDyfN0nm7RY5TFzEbFdLzMpwWWxDGIMWpD4opD2AXg5nTF45TLjRCslXr6krzrQll9L6ny4CSaahokUmOzqqTVVZqcYO0-fvQG102Iqr9C78ks246zLg',
    startingPrice: 11000000.0,
    currentMaxBid: 13200000.0,
    hoursToEnd: 5,
    bids: [
      { userId: 'SILVER_ARROW', amount: 12000000.0, minsAgo: 60 },
      { userId: 'HERITAGE_CAPITAL', amount: 13200000.0, minsAgo: 12 },
    ],
  },
  {
    itemName: 'Zero-Knowledge Security Master Core',
    category: 'Digital Asset',
    lotNumber: '890',
    description: 'Decentralized protocol governance core with historic consensus validation credentials and permanent immutability guarantee.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAKN8XxVQickP8I6N3vPaRq9r7kRI_w7_wtxc-zG1MEVgWBMUwmYzzgLe0fOxmpfuV8JvToRg5M5PmD8yhr2ykDKqpiLNx0Fs5sI5EVZPv7DxzJ5rhwgm_q5dHwVsNh0k50zQRHmgRMpaGeFOxozxI83WpePXMwy4zlVaZfM4qzKmpABVprHGevqEebXnC_8Pl3HB3ZENYLkCk4O9IA3Tek4NkOFtxiG08fM2k0ukPeIrrXHqXv8wXgLg',
    startingPrice: 5000000.0,
    currentMaxBid: 5800000.0,
    hoursToEnd: 3,
    bids: [
      { userId: 'ZK_VALIDATOR', amount: 5200000.0, minsAgo: 40 },
      { userId: 'CYPHER_LABS', amount: 5800000.0, minsAgo: 15 },
    ],
  },
];

export async function seedDemoAuctions() {
  console.log('[Seed] Cleaning old demo auctions and bids...');
  await pool.query('DELETE FROM bids');
  await pool.query('DELETE FROM auctions');

  console.log('[Seed] Ensuring demo user exists in PostgreSQL...');
  const demoPasswordHash = await hashPassword('password123');
  const userRes = await pool.query(
    `INSERT INTO users (email, username, password_hash, role)
     VALUES ($1, $2, $3, 'USER')
     ON CONFLICT (email) DO UPDATE SET password_hash = $3
     RETURNING id`,
    ['demo@bidstream.com', 'trader42', demoPasswordHash]
  );
  const demoUserId = userRes.rows[0].id;

  console.log('[Seed] Seeding realistic mock auctions into PostgreSQL & Redis...');

  const insertedAuctions = [];

  for (const item of DEMO_AUCTIONS) {
    const sql = `
      INSERT INTO auctions (
        title, item_name, starting_price, current_max_bid, start_time, end_time,
        minimum_bid_increment, description, category, image_url, lot_number, owner_id
      )
      VALUES ($1, $1, $2, $3, NOW(), NOW() + ($4 || ' hours')::INTERVAL, $5, $6, $7, $8, $9, $10)
      RETURNING id, title, item_name, starting_price, current_max_bid, start_time, end_time,
                minimum_bid_increment, description, category, image_url, lot_number, owner_id
    `;

    const { rows } = await pool.query(sql, [
      item.itemName,
      item.startingPrice,
      item.currentMaxBid,
      item.hoursToEnd,
      10000.0,
      item.description,
      item.category,
      item.imageUrl,
      item.lotNumber,
      demoUserId,
    ]);

    const auction = rows[0];
    insertedAuctions.push(auction);

    await initializeAuctionState(auction.id, auction.current_max_bid);

    // Insert bid history
    for (const bid of item.bids) {
      await pool.query(
        `INSERT INTO bids (auction_id, user_id, bid_amount, created_at)
         VALUES ($1, $2, $3, NOW() - ($4 || ' minutes')::INTERVAL)`,
        [auction.id, bid.userId, bid.amount, bid.minsAgo]
      );
    }

    console.log(`  ✓ Created [${auction.category}] ${auction.item_name} (ID: ${auction.id}) | Current Max: ₹${auction.current_max_bid.toLocaleString()}`);
  }

  console.log('\n=============================================================');
  console.log(`✅ ${insertedAuctions.length} Demo Auctions seeded successfully!`);
  console.log('-------------------------------------------------------------');
  console.log(`First Auction ID: ${insertedAuctions[0].id}`);
  console.log(`Frontend URL    : http://localhost:5173/?auctionId=${insertedAuctions[0].id}`);
  console.log('=============================================================\n');

  return insertedAuctions;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDemoAuctions()
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
