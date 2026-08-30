# AGENTS.md — High-Frequency Live Auction Engine

> This file defines the **strict behavioral rules** for all agents (human or AI) contributing to this codebase.
> These rules are non-negotiable and must be followed in every implementation step.

---

## § 1 — Scope of Work

- **No boilerplate generation** outside of explicitly requested files.
- Only create files that have been directly asked for in a task or implementation step.
- Do not scaffold placeholder modules, stub handlers, or empty directories unless explicitly instructed.

---

## § 2 — JavaScript / Node.js Standards

- **Use ES6 modules exclusively** (`import`/`export`). CommonJS (`require`/`module.exports`) is strictly forbidden in application code.
- All Node.js source files must include `"type": "module"` support via `package.json` (already set or to be set).
- Use `async/await` for all asynchronous operations. Raw `.then()/.catch()` chains are disallowed unless interoperability requires it.
- Use named exports over default exports wherever possible for better tree-shaking and IDE discoverability.
- All environment variables must be accessed via a centralized `config` module — never via raw `process.env` calls scattered across the codebase.

---

## § 3 — Database (PostgreSQL)

- **All database queries must use connection pooling.** Direct `Client` connections are prohibited outside of migration scripts.
- The pool must be initialized once and exported as a singleton (e.g., via `src/db/pool.js`).
- All queries must use **parameterized statements** — no string interpolation of user-supplied values.
- Transactions that span multiple queries must use `pool.connect()` with explicit `BEGIN / COMMIT / ROLLBACK` handling.
- UUIDs must be generated at the **database level** using `gen_random_uuid()` (requires `pgcrypto`) or at the application level using the `crypto` module's `randomUUID()`.

---

## § 4 — Redis (Bidding Operations)

- **All Redis operations related to bidding logic must use Lua scripts for atomic execution.**
- Lua scripts must be pre-loaded/registered at application startup and invoked via `EVALSHA` (preferred) or `EVAL`.
- Lua scripts must be stored as `.lua` files under `src/redis/scripts/` and loaded programmatically — never inlined as raw strings in application logic.
- Direct `SET` / `GET` calls on bid-related keys are forbidden outside of their designated Lua scripts.
- Redis key naming must strictly follow the convention: `auction:{id}:max_bid`.

---

## § 5 — Message Queue (RabbitMQ)

- RabbitMQ connections and channels must be managed via a singleton connector module (e.g., `src/mq/connection.js`).
- The queue name `bid_persist_queue` is canonical and must not be hardcoded outside of the central config.
- All messages published to the queue must be serialized as JSON.
- Consumers must acknowledge (`ack`) messages **only after** successful database persistence. Failed persistence must trigger `nack` with `requeue: false` and route to a dead-letter queue.

---

## § 6 — API Layer (Express)

- All route handlers must be thin — business logic lives in service modules, not in route files.
- All incoming request bodies must be validated before reaching service logic (use a schema validation library e.g., `zod` or `joi`).
- All API errors must flow through a centralized error-handling middleware.
- HTTP status codes must be semantically correct (e.g., `202 Accepted` for async bid submission, not `200 OK`).

---

## § 7 — Frontend (React)

- State management for real-time bid updates must use WebSocket connections — not polling.
- No direct API calls from components; all data fetching must go through a dedicated service/hook layer.
- Component files use `.jsx` extension; utility/service files use `.js`.

---

## § 8 — Security

- No secrets or credentials are to be committed. All sensitive values live in `.env` files which are `.gitignore`d.
- All user-facing numeric inputs (bid amounts) must be validated as positive finite decimals on both client and server.

---

## § 9 — Commit Hygiene

- Each commit must correspond to exactly one atomic implementation step from `docs/TASK.md`.
- Commit messages must follow the format: `[STEP-XX] <imperative description>`.
