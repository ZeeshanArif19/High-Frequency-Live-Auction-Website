# High-Frequency Live Auction Engine

A production-ready, event-driven live auction platform built for **high concurrency, consistency, and fault tolerance**. Built with Node.js, Express, PostgreSQL, Redis, RabbitMQ, and React.

**Stress-tested** to handle 1,000 concurrent identical bids while guaranteeing a single winner. Sustained 12,634 requests across 250 concurrent clients with **0 failures, 0 timeouts, and 1,621 ms p95 latency**.

---

## 🎯 Key Features

### Bidding & Auction Lifecycle

- **Atomic bid arbitration** using Redis Lua scripts—prevents duplicate winners under concurrent traffic
- **Asynchronous transactional persistence** via RabbitMQ—HTTP endpoints return in ~100ms; database writes follow via worker
- **Six-stage auction lifecycle**: SCHEDULED → LIVE → ENDED → PAYMENT_PENDING → SETTLED/UNSOLD
- **Automatic state transitions** with deterministic winner selection and fallback to next eligible bidder on payment expiry
- **Real-time WebSocket updates** broadcast confirmed bids to all connected clients

### Security

- **JWT authentication** with bcrypt password hashing (never expose raw passwords)
- **Ownership-based authorization** (users cannot bid on/edit their own auctions)
- **Request body validation** using Zod schemas
- **HMAC-signed payment webhooks** with cryptographic verification

### Performance & Reliability

- **Dual-layer consistency**:
  - Fast layer: Redis atomicity for immediate bid acceptance (HTTP 202)
  - Durable layer: PostgreSQL transactions for eventual consistency
- **Dead-letter queue** for failed bids (automatic retry/inspection)
- **Connection pooling** and singleton pattern for all external services (DB, Redis, RabbitMQ)
- **Comprehensive test suite** covering auth, auction lifecycle, payment workflows, and load scenarios

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                   │
│  • Real-time bid updates via WebSocket                      │
│  • Auction discovery, product grid, bidding terminal        │
│  • JWT-based authentication flow                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP + WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express.js HTTP API                         │
│  • POST /auctions/:id/bids           → 202 Accepted         │
│  • GET /auctions/:id                 → Auction details      │
│  • POST /auth/register, /auth/login  → JWT tokens           │
│  • POST /payments/webhook            → HMAC-verified        │
└──┬─────────────────────────┬──────────────────────┬─────────┘
   │ (1) Fast path           │ (2) Async path       │ WebSocket
   ▼                         ▼                      ▼
┌─────────────┐      ┌──────────────────┐    ┌──────────┐
│ Redis       │      │   RabbitMQ       │    │ WebSocket│
│ (Lua        │      │ bid_persist_queue│    │ Server   │
│ atomicity)  │      └────────┬─────────┘    └──────────┘
└─────────────┘               │
                              │ (3) Eventual consistency
                              ▼
                    ┌─────────────────────┐
                    │   Bid Consumer      │
                    │  (transactional)    │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │   PostgreSQL        │
                    │  • auctions         │
                    │  • bids             │
                    │  • users            │
                    │  • payments         │
                    └─────────────────────┘
```

### Data Flow: Bid Submission

1. **Client submits bid** → POST `/auctions/:id/bids`
2. **Server validates**:
   - Auction exists, not ended, status is LIVE
   - User is not the auction owner
   - Bid amount is positive and finite
3. **Redis Lua script** (`try_place_bid.lua`):
   - Atomically checks `auction:{id}:max_bid` vs incoming bid
   - If incoming > current: SET and return `1` (accepted)
   - Otherwise: return `0` (rejected)
4. **If accepted**: Publish payload to RabbitMQ `bid_persist_queue`, return HTTP 202
5. **Consumer** (running in same/separate process):
   - Dequeue message
   - Begin PostgreSQL transaction
   - Insert bid row + update `auctions.current_max_bid`
   - Commit and ACK message
   - Broadcast via WebSocket to all connected clients
6. **If any failure**: ROLLBACK, NACK with `requeue: false` → message routes to dead-letter queue

---

## 📊 Load Test Results

### Correctness

| Test              | Concurrency | Accepted | Rejected | Errors       | Result                                   |
| ----------------- | ----------- | -------- | -------- | ------------ | ---------------------------------------- |
| Identical bids    | 1,000       | 1        | 999      | 0            | ✅ Single-winner invariant held          |
| Different amounts | 500         | 2        | 498      | 0            | ✅ Correct winner selection              |
| Sustained (60s)   | 250 clients | 145      | 12,489   | 0            | ✅ 0 failures, 0 timeouts                |

### Performance

| Test            | Concurrency | Req/sec | p50      | p95          | p99      |
| --------------- | ----------- | ------- | -------- | ------------ | -------- |
| Baseline        | 10          | 70.66   | 108 ms   | 125 ms       | 125 ms   |
| Identical bids  | 500         | 100.25  | 3,279 ms | 3,769 ms     | 3,808 ms |
| Sustained (60s) | 250         | 210.57  | 736 ms   | **1,621 ms** | 3,260 ms |

**Key insight**: The system maintained correctness through 1,000 concurrent identical bids with zero data corruption. Main bottleneck at high concurrency is application-level (queue serialization + consumer prefetch), not database or machine resources.

See [docs/load-test-report.md](docs/load-test-report.md) for full analysis.

---

## 🛠 Tech Stack

| Layer             | Technology                                       |
| ----------------- | ------------------------------------------------ |
| **Frontend**      | React 18, Vite, WebSocket client                 |
| **Backend**       | Node.js (ES6 modules), Express 5                 |
| **Database**      | PostgreSQL 16 (connection pooling, transactions) |
| **Cache**         | Redis 7 (Lua scripting for atomicity)            |
| **Message Queue** | RabbitMQ 3.13 (durable, dead-letter configured)  |
| **Real-time**     | WebSocket (ws library)                           |
| **Auth**          | JWT, bcryptjs (password hashing)                 |
| **Validation**    | Zod (schema validation)                          |
| **Deployment**    | Docker, Docker Compose                           |

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose (for PostgreSQL, Redis, RabbitMQ)
- Node.js ≥ 18
- npm

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/high-frequency-live-auction-website.git
cd high-frequency-live-auction-website

npm install
npm --prefix client install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your settings (defaults work for local Docker Compose):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5433
DB_NAME=auction_db
DB_USER=auction_user
DB_PASSWORD=auction_pass
DB_POOL_MAX=20

REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_BID_QUEUE=bid_persist_queue

JWT_SECRET=your-secret-key-here
PAYMENT_WEBHOOK_SECRET=your-webhook-secret-here
```

### 3. Start Services

```bash
# Start PostgreSQL, Redis, RabbitMQ in Docker
docker compose up -d

# Wait for health checks (~30s)
docker compose ps

# Run database migrations
npm run migrate

# (Optional) Seed sample data
npm run seed
```

### 4. Run Backend & Frontend

```bash
# Terminal 1: Start backend server
npm start
# Backend runs on http://localhost:3000

# Terminal 2: Start frontend dev server
npm run dev:client
# Frontend runs on http://localhost:5173
```

### 5. Verify

- **Backend health**: `curl http://localhost:3000/auctions`
- **Frontend**: Open http://localhost:5173
- **RabbitMQ management**: http://localhost:15672 (guest:guest)

---

## 🧪 Testing

```bash
# Auth & Authorization
npm run test:auth

# Auction Lifecycle (SCHEDULED → LIVE → ENDED → PAYMENT_PENDING → SETTLED)
npm run test:lifecycle

# Payment Workflows & Webhooks
npm run test:payment

# Payment Expiry & Bidder Fallback
npm run test:payment-expiry

# Load Testing (1,000 concurrent bids)
npm run test:load -- --scenario=identical-bids --concurrency=1000

# All tests
npm run test
```

Each test is a standalone Node.js script that:

1. Connects to live services (no mocks)
2. Creates test data
3. Asserts correctness
4. Cleans up after itself

---

## 📁 Project Structure

```
.
├── docs/
│   ├── TASK.md                      # Atomic implementation steps (design doc)
│   └── load-test-report.md          # Comprehensive load test analysis
├── src/
│   ├── server.js                    # Entry point: HTTP + WebSocket server
│   ├── app.js                       # Express app setup
│   ├── config/
│   │   └── index.js                 # Centralized config from env vars
│   ├── db/
│   │   ├── pool.js                  # PostgreSQL connection pool (singleton)
│   │   ├── migrate.js               # Migration runner
│   │   ├── seed.js                  # Sample data seeding
│   │   ├── repositories/
│   │   │   └── bidRepository.js     # Bid persistence functions
│   │   └── migrations/              # SQL migration files (001 - 011)
│   ├── redis/
│   │   ├── client.js                # Redis client (singleton)
│   │   └── scripts/
│   │       ├── try_place_bid.lua    # Atomic bid comparison & set
│   │       └── index.js             # Lua script loader & wrapper functions
│   ├── mq/
│   │   ├── connection.js            # RabbitMQ connection + channel setup
│   │   └── consumers/
│   │       └── bidConsumer.js       # Worker: consume & persist bids
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auctions.js          # GET/POST auctions, bidding
│   │   │   ├── auth.js              # Register, login, profile
│   │   │   └── payments.js          # Payment webhooks
│   │   └── middleware/
│   │       ├── auth.js              # JWT verification
│   │       ├── validate.js          # Zod schema validation
│   │       └── errorHandler.js      # Centralized error responses
│   ├── services/
│   │   ├── bidService.js            # Core bid submission logic
│   │   ├── auctionLifecycleService.js # State transitions
│   │   ├── paymentService.js        # Payment orchestration
│   │   └── sandboxPaymentProvider.js # Sandbox webhook simulator
│   ├── utils/
│   │   └── auth.js                  # JWT token generation/verification
│   ├── ws/
│   │   └── server.js                # WebSocket broadcast server
│   └── test/
│       ├── authAndAuthorization.test.js
│       ├── auctionLifecycle.test.js
│       ├── payment.test.js
│       ├── paymentExpiry.test.js
│       └── loadTest.js
├── client/
│   ├── src/
│   │   ├── main.jsx                 # React entry point
│   │   ├── App.jsx                  # Main app component & router
│   │   ├── components/
│   │   │   ├── Auction/             # Auction detail views
│   │   │   ├── Auth/                # Login/register modals
│   │   │   ├── Landing/             # Landing page components
│   │   │   ├── Products/            # Product grid
│   │   │   └── User/                # User auctions, bids
│   │   ├── services/
│   │   │   ├── auctionService.js    # API calls
│   │   │   ├── authService.js       # Auth flows
│   │   │   ├── wsService.js         # WebSocket connection
│   │   │   └── formatters.js        # Currency formatting
│   │   ├── hooks/
│   │   │   ├── useAuction.js        # Auction state + live updates
│   │   │   └── useAuctionsList.js   # Auctions list state
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Global auth state
│   │   ├── data/
│   │   │   └── placeholderData.js   # Sample auctions
│   │   └── index.css
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml               # PostgreSQL, Redis, RabbitMQ services
├── Dockerfile                       # Multi-stage backend build
├── package.json
├── .env.example
└── README.md
```

---

## 🔌 API Endpoints

### Authentication

```
POST   /auth/register           Create account
POST   /auth/login              Login (returns JWT)
POST   /auth/me                 Get current user profile
```

### Auctions

```
GET    /auctions                List all auctions
POST   /auctions                Create new auction (authenticated)
GET    /auctions/:id            Get auction details
PUT    /auctions/:id            Update auction (owner only)
DELETE /auctions/:id            Delete auction (owner only, no bids)
```

### Bidding

```
POST   /auctions/:id/bids       Submit bid
       Body: { bidAmount: number }
       Returns: 202 Accepted or 409 Conflict
```

### Payments

```
POST   /payments                Create payment order (authenticated)
POST   /payments/webhook        Payment provider webhook (HMAC-verified)
```

### Real-time

```
WebSocket /ws                   Connect for live bid updates
       Message: { auctionId, newMaxBid, timestamp }
```

---

## 🔐 Security Highlights

- **No plaintext passwords**: All passwords hashed with bcryptjs (cost: 12)
- **No credentials in git**: Environment variables via `.env` (in `.gitignore`)
- **JWT expiry**: Tokens expire in 24 hours; refresh via re-login
- **CORS**: Configured for frontend origin only
- **SQL injection prevention**: All queries use parameterized statements
- **Webhook verification**: HMAC-SHA256 signature validation on payment webhooks
- **Rate limiting** (recommended for production): Implement with express-rate-limit

---

## 📈 Scalability & Performance Considerations

### Current Bottlenecks (from load test)

1. **Consumer prefetch=1** — Only one message at a time to prevent DB pool saturation
2. **Per-auction ordering** — Bids for same auction are serialized through RabbitMQ consumer
3. **DB connection pool** — Default 20 connections; tune `DB_POOL_MAX` based on your workload

### How to Scale Further

- **Separate consumer process** — Run bid consumer in dedicated worker pods
- **Increase consumer prefetch** — Test higher prefetch with bounded connection pool
- **Read replicas** — Offload read queries (auction details) to PostgreSQL replicas
- **Caching layer** — Cache auction details in Redis for repeated reads
- **Partition queues** — Multiple bid queues by auction shard for parallel consumption
- **Database tuning** — Add indexes on `auction_id`, `user_id`, improve transaction performance

---

## 🐳 Deployment

### Docker Image Build

```bash
docker build -t auction-backend:latest .
```

### Docker Compose (Development)

```bash
docker compose up -d
npm run migrate
```

### Kubernetes (Production)

1. Build and push image to registry:

   ```bash
   docker build -t your-registry/auction-backend:v1.0.0 .
   docker push your-registry/auction-backend:v1.0.0
   ```

2. Apply Kubernetes manifests (example):

   ```bash
   kubectl apply -f k8s/postgres.yaml
   kubectl apply -f k8s/redis.yaml
   kubectl apply -f k8s/rabbitmq.yaml
   kubectl apply -f k8s/backend.yaml
   kubectl apply -f k8s/frontend.yaml
   ```

3. Verify:
   ```bash
   kubectl get pods -n auction
   kubectl logs -n auction -f deployment/backend
   ```

---

## 📝 Database Schema

### Auctions Table

```sql
CREATE TABLE auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  item_name VARCHAR NOT NULL,
  starting_price DECIMAL(15,2) NOT NULL CHECK (starting_price > 0),
  current_max_bid DECIMAL(15,2) NOT NULL DEFAULT starting_price,
  minimum_bid_increment DECIMAL(15,2),
  status VARCHAR DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED', 'PAYMENT_PENDING', 'SETTLED', 'UNSOLD')),
  owner_id UUID NOT NULL REFERENCES users(id),
  winner_user_id UUID REFERENCES users(id),
  winning_bid_id UUID REFERENCES bids(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  payment_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Bids Table

```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  bid_amount DECIMAL(15,2) NOT NULL CHECK (bid_amount > 0),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

See [src/db/migrations/](src/db/migrations/) for complete schema.

---

## 🧑‍💻 Development Workflow

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes** and run tests:

   ```bash
   npm run test:auth
   npm run test:lifecycle
   ```

3. **Commit atomically** (each step = one commit):

   ```bash
   git commit -m "[STEP-XX] Feature description"
   ```

4. **Push and open a PR** for code review.

### Code Standards

- **ES6 modules only** — `import`/`export` (no CommonJS in app code)
- **Async/await** — No raw `.then()` chains
- **Named exports** — Prefer over default exports
- **Centralized config** — All env vars via `src/config/index.js`
- **Type comments** — JSDoc for public functions
- **No hardcoding** — Queue names, DB names, URLs from config

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "[STEP-XX] Description"`)
4. Push to your fork (`git push origin feature/my-feature`)
5. Open a PR for review

---

## 📞 Support

For issues or questions:

- Open an issue on GitHub
- Check [docs/TASK.md](docs/TASK.md) for implementation details
- Review [docs/load-test-report.md](docs/load-test-report.md) for performance insights

---

## 🎓 Key Learnings

This project demonstrates:

- **Event-driven architecture** with message queues for reliability
- **Dual-layer consistency** (fast cache + eventual DB persistence)
- **Atomic operations** using Redis Lua scripts
- **Transactional workflows** with PostgreSQL and ACID guarantees
- **Real-time communication** via WebSockets
- **High-concurrency testing** and profiling
- **Production-ready security** (auth, CORS, HTTPS-ready)
- **Container orchestration** with Docker Compose and Kubernetes-ready

---

**Built with ❤️ for high-frequency auction trading.**
