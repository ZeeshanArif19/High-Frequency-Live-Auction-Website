# Load Test Report

Date: 2026-09-11

Environment: Docker Compose PostgreSQL, Redis, RabbitMQ; one host Node.js backend with the embedded bid consumer. No separate worker container exists in the current Compose file.

## Correctness

| Test                  | Concurrency | Accepted | Rejected |                Errors | Result                                                    |
| --------------------- | ----------: | -------: | -------: | --------------------: | --------------------------------------------------------- |
| Identical bids        |          10 |        1 |        9 |                     0 | Passed; Redis and PostgreSQL both 150; queue empty        |
| Identical bids        |          50 |        1 |       49 |                     0 | Passed; Redis and PostgreSQL both 150; queue empty        |
| Identical bids        |         100 |        1 |       99 |                     0 | Passed; Redis and PostgreSQL both 150; queue empty        |
| Identical bids        |         500 |        1 |      499 |                     0 | Passed; Redis and PostgreSQL both 150; queue empty        |
| Identical bids        |       1,000 |        1 |      999 |                     0 | Passed; Redis and PostgreSQL both 150; queue empty        |
| Different bid amounts |         500 |        2 |      498 |                     0 | Passed; final Redis and PostgreSQL value 500; queue empty |
| Multiple auctions     |     4 x 250 |      118 |       50 | 832 failures/timeouts | Failed; 832 requests reached the 10-second client timeout |

The single-winner invariant held for identical bid contention through 1,000 requests. No duplicate accepted bid was observed in those runs. The multi-auction run did not complete successfully because the backend saturated under cross-auction contention.

## Performance

| Test              |          Concurrency | Requests/sec |       p50 |       p95 |       p99 |
| ----------------- | -------------------: | -----------: | --------: | --------: | --------: |
| Baseline          |                   10 |        70.66 |    108 ms |    125 ms |    125 ms |
| Baseline          |                   50 |        95.92 |    366 ms |    437 ms |    442 ms |
| Identical bids    |                  100 |       121.96 |    585 ms |    652 ms |    660 ms |
| Identical bids    |                  500 |       100.25 |  3,279 ms |  3,769 ms |  3,808 ms |
| Identical bids    |                1,000 |       103.64 |  6,792 ms |  7,789 ms |  7,903 ms |
| Multiple auctions |                1,000 |        11.56 | 10,001 ms | 10,010 ms | 10,014 ms |
| Sustained         | 250 clients for 60 s |       210.57 |    736 ms |  1,621 ms |  3,260 ms |

The sustained run generated 12,634 requests: 145 accepted, 12,489 rejected, 0 failures, and 0 timeouts.

## Reliability

- Worker failure: Not independently testable. The consumer is embedded in the backend; there is no worker service in Compose.
- RabbitMQ recovery: The queue drained successfully after the measured workloads; final live and dead-letter queues were both empty.
- PostgreSQL recovery: PostgreSQL returned healthy after restart, but the backend exited during the outage and required restart. After restart, a bid returned HTTP 202 and persisted successfully.
- Redis recovery: Redis returned PONG after restart. A bid while Redis was stopped did not return within the 5-second client timeout and was cancelled by the client.
- Duplicate event/idempotency: Not run. No supported event replay or injection endpoint exists.

## Resource Usage

Observed Docker snapshots on the 8 GB host:

- PostgreSQL peak observed: about 61 MiB; 31% CPU during sustained traffic.
- Redis peak observed: about 9 MiB.
- RabbitMQ peak observed: about 167 MiB; 34% CPU during sustained traffic.
- The unrelated `wordrush_multiplayer-game-db-1` container was also running and used about 22 MiB.
- No unsafe memory growth, container restart loop, or host instability was observed.

## Conclusions

1. Highest concurrency successfully tested: 1,000 simultaneous identical bids.
2. The single-winner invariant held through 1,000 concurrent identical bids.
3. Main sustained benchmark p95 latency: 1,621 ms.
4. The multi-auction run saturated the request path: 832 of 1,000 requests timed out at 10 seconds. The consumer uses `prefetch(1)`, and asynchronous persistence also produced visible RabbitMQ backlogs.
5. The observed limit was application behavior and queue serialization, not the 8 GB machine's memory capacity.
6. Next optimization: evaluate bounded consumer concurrency and transaction/pool capacity while preserving per-auction ordering and idempotency; also add explicit backend dependency recovery and request timeouts for Redis/PostgreSQL failures.

The load-test harness exits cleanly after closing Redis, PostgreSQL, and RabbitMQ resources. It is implemented in [src/test/loadTest.js](../src/test/loadTest.js).
