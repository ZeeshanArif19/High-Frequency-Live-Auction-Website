# docs/TASK.md — Atomic Implementation Steps

> High-Frequency Live Auction Engine
> Stack: Node.js (ES6) · Express · PostgreSQL · Redis · RabbitMQ · React
> All steps must be executed in order. Each step maps to exactly one commit.

---

## Data Schema Reference

### PostgreSQL — Table: `auctions`

| Column            | Type        | Constraints                          |
|-------------------|-------------|--------------------------------------|
| `id`              | UUID        | PRIMARY KEY, DEFAULT gen_random_uuid() |
| `item_name`       | VARCHAR     | NOT NULL                             |
| `starting_price`  | DECIMAL     | NOT NULL, CHECK (starting_price > 0) |
| `current_max_bid` | DECIMAL     | NOT NULL, DEFAULT starting_price     |
| `end_time`        | TIMESTAMP   | NOT NULL                             |

### PostgreSQL — Table: `bids`

| Column        | Type      | Constraints                                      |
|---------------|-----------|--------------------------------------------------|
| `id`          | UUID      | PRIMARY KEY, DEFAULT gen_random_uuid()           |
| `auction_id`  | UUID      | NOT NULL, FOREIGN KEY → auctions(id) ON DELETE CASCADE |
| `user_id`     | VARCHAR   | NOT NULL                                         |
| `bid_amount`  | DECIMAL   | NOT NULL, CHECK (bid_amount > 0)                 |
| `created_at`  | TIMESTAMP | NOT NULL, DEFAULT NOW()                          |

### Redis Key

```
auction:{id}:max_bid   →  (DECIMAL string) Current maximum bid for a given auction
```

### RabbitMQ Queue

```
bid_persist_queue      →  Carries bid payloads for async database persistence
```

---

## Implementation Steps

---

### STEP-01 · Project Bootstrap & Environment Configuration

**Goal:** Establish the project's module system, folder skeleton, and environment contract.

**Files to create:**
- Update `package.json`: set `"type": "module"`, add `engines` field for Node ≥ 18.
- `src/config/index.js` — Centralized config module that reads from `process.env` and exports a frozen config object.
- `.env.example` — Documents all required environment variables (DB, Redis, RabbitMQ, PORT, etc.) with placeholder values.
- `.gitignore` — Excludes `.env`, `node_modules/`, `dist/`.

**Environment variables to document:**
```
PORT
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_POOL_MAX
REDIS_URL
RABBITMQ_URL
RABBITMQ_BID_QUEUE
```

---

### STEP-02 · PostgreSQL Connection Pool (Singleton)

**Goal:** Create a singleton pool module that all database-access code will import.

**Files to create:**
- `src/db/pool.js` — Initializes and exports a `pg.Pool` instance configured from `src/config/index.js`.

**Rules:**
- Pool max size must be read from config (`DB_POOL_MAX`), not hardcoded.
- Export only the pool instance; do not export the `pg` module itself.
- Log a connection verification message at startup (single `pool.query('SELECT 1')`).

---

### STEP-03 · Database Migrations

**Goal:** Define and apply the canonical schema to PostgreSQL.

**Files to create:**
- `src/db/migrations/001_create_auctions.sql` — Creates the `auctions` table with all constraints and the `pgcrypto` extension guard.
- `src/db/migrations/002_create_bids.sql` — Creates the `bids` table with the foreign key to `auctions` and all constraints.
- `src/db/migrate.js` — Script that reads migration files in order and applies them transactionally. Must be runnable via `node src/db/migrate.js`.

**Rules:**
- Migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`).
- Each migration file must be wrapped in a single transaction (`BEGIN` / `COMMIT`).

---

### STEP-04 · Redis Client (Singleton)

**Goal:** Create a singleton Redis client used throughout the application.

**Files to create:**
- `src/redis/client.js` — Initializes and exports a Redis client (using `ioredis`) connected via `REDIS_URL` from config.

**Rules:**
- Client must reconnect automatically on failure.
- Export only the client instance.
- Log a connection-ready event at startup.

---

### STEP-05 · Redis Lua Script — Atomic Bid Comparison & Set

**Goal:** Implement the core atomic bid logic as a Lua script.

**Files to create:**
- `src/redis/scripts/try_place_bid.lua` — Lua script that:
  1. Reads current value of `auction:{id}:max_bid`.
  2. If the incoming bid amount is strictly greater than the current value (or no value exists), atomically sets the new max bid and returns `1` (success).
  3. Otherwise returns `0` (rejected — bid too low).
- `src/redis/scripts/index.js` — Loads the `.lua` file at startup, registers it via `client.defineCommand` or stores its SHA via `SCRIPT LOAD`, and exports a typed wrapper function `tryPlaceBid(auctionId, bidAmount)`.

**Rules:**
- The script must be loaded from the `.lua` file using `fs.readFile` — no inline Lua strings in `.js` files.
- The wrapper must return a boolean (`true` = accepted, `false` = rejected).

---

### STEP-06 · RabbitMQ Connection & Channel Manager

**Goal:** Create a singleton RabbitMQ connection/channel module.

**Files to create:**
- `src/mq/connection.js` — Connects to RabbitMQ using `amqplib`, asserts the `bid_persist_queue` queue (durable, with a dead-letter exchange configured), and exports `{ connection, channel }`.

**Rules:**
- Queue name must be read from config — no hardcoding.
- Dead-letter exchange must be asserted alongside the primary queue.
- Connection must be retried up to 5 times with exponential back-off before throwing.

---

### STEP-07 · Bid Persistence Consumer (RabbitMQ → PostgreSQL)

**Goal:** Implement the consumer that drains `bid_persist_queue` and writes bids to PostgreSQL.

**Files to create:**
- `src/mq/consumers/bidConsumer.js` — Subscribes to `bid_persist_queue`, deserializes the JSON message, inserts a row into `bids`, and ACKs the message. On insert failure, NACKs with `requeue: false`.
- `src/db/repositories/bidRepository.js` — Exports `insertBid({ auctionId, userId, bidAmount })` using a parameterized pool query. Also exports `updateAuctionMaxBid({ auctionId, bidAmount })` to update `auctions.current_max_bid` if the new bid exceeds it.

**Rules:**
- ACK must only be called after **both** `insertBid` and `updateAuctionMaxBid` succeed within a single transaction.
- Use `pool.connect()` with `try/finally` to ensure the client is always released.

---

### STEP-08 · Bid Service (Core Business Logic)

**Goal:** Implement the stateless service that orchestrates a bid submission.

**Files to create:**
- `src/services/bidService.js` — Exports `submitBid({ auctionId, userId, bidAmount })` which:
  1. Validates that the auction exists and has not ended (query `auctions` table).
  2. Calls `tryPlaceBid(auctionId, bidAmount)` (Lua script via Redis).
  3. If accepted, publishes the bid payload to `bid_persist_queue` as JSON.
  4. Returns `{ accepted: true }` or `{ accepted: false, reason: string }`.

**Rules:**
- Service must never write to the database directly — that is the consumer's responsibility.
- Auction expiry check must compare `end_time` against `NOW()` server-side (in the SQL query).

---

### STEP-09 · Express HTTP API

**Goal:** Expose the bid submission and auction query endpoints.

**Files to create:**
- `src/api/routes/auctions.js` — Route definitions:
  - `GET /auctions/:id` — Returns auction details from PostgreSQL.
  - `POST /auctions/:id/bids` — Validates body (`userId`, `bidAmount`), calls `bidService.submitBid`, returns `202 Accepted` or `409 Conflict`.
- `src/api/middleware/errorHandler.js` — Centralized Express error-handling middleware.
- `src/api/middleware/validate.js` — Request body validation middleware using `zod`.
- `src/app.js` — Initializes Express, mounts routes, and mounts the error handler.
- `src/server.js` — Entry point: imports `src/app.js`, starts the HTTP server, and initializes the RabbitMQ consumer.

**Rules:**
- `POST /auctions/:id/bids` must return `202 Accepted` on success (bid entered the pipeline).
- `POST /auctions/:id/bids` must return `409 Conflict` if the bid was rejected by Redis.
- Route files must only contain route/middleware wiring — zero business logic.

---

### STEP-10 · WebSocket Server (Real-Time Bid Broadcast)

**Goal:** Broadcast live bid updates to connected React clients.

**Files to create:**
- `src/ws/server.js` — Attaches a WebSocket server (`ws` library) to the existing HTTP server. Exports a `broadcastBidUpdate(auctionId, newMaxBid)` function.
- Modify `src/mq/consumers/bidConsumer.js` — After a successful ACK, call `broadcastBidUpdate` so clients receive the confirmed new max bid in real time.

**Rules:**
- Only broadcast after confirmed DB persistence (post-ACK).
- WebSocket messages must be JSON: `{ auctionId, newMaxBid, timestamp }`.

---

### STEP-11 · React Frontend — Auction View & Live Bidding UI

**Goal:** Build a React client that displays auction state and streams live updates.

**Files to create (under `client/src/`):**
- `services/auctionService.js` — Fetches initial auction data via `GET /auctions/:id`.
- `services/wsService.js` — Establishes and manages the WebSocket connection; exposes an event-emitter interface.
- `hooks/useAuction.js` — Custom hook combining `auctionService` and `wsService` to maintain live auction state.
- `components/AuctionCard.jsx` — Displays item name, current max bid, and countdown timer.
- `components/BidForm.jsx` — Controlled form for submitting a bid amount; calls `POST /auctions/:id/bids`.
- `App.jsx` — Composes `AuctionCard` and `BidForm`; uses `useAuction` hook.

**Rules:**
- No direct `fetch`/WebSocket calls inside components — all I/O via service layer.
- Bid amount input must be validated client-side as a positive finite decimal before submission.
- On `202 Accepted`, show an optimistic "Bid placed — awaiting confirmation" state.
- On `409 Conflict`, show an inline error message.

---

### STEP-12 · Dockerization

**Goal:** Containerize the backend service.

**Files to create:**
- `Dockerfile` — Multi-stage build: `node:20-alpine` base, production dependencies only, non-root user.
- `docker-compose.yml` — Orchestrates `app` (this service), `postgres`, `redis`, and `rabbitmq` containers with correct dependency ordering and health checks.
- `.dockerignore` — Excludes `node_modules/`, `.env`, `client/`, `*.md`.

---

## Dependency Reference

> Install only when the corresponding step is being implemented.

| Package         | Step  | Purpose                              |
|-----------------|-------|--------------------------------------|
| `express`       | 09    | HTTP server framework                |
| `pg`            | 02    | PostgreSQL client with pool support  |
| `ioredis`       | 04    | Redis client with Lua script support |
| `amqplib`       | 06    | RabbitMQ / AMQP 0-9-1 client        |
| `zod`           | 09    | Request body schema validation       |
| `ws`            | 10    | WebSocket server                     |
| `react`         | 11    | Frontend framework                   |
| `vite`          | 11    | Frontend build tool / dev server     |

---

*End of TASK.md*
