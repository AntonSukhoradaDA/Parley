# Parley federation load test

Cross-server load harness for the two-stack federation compose.

## Prerequisites

```bash
docker compose -f docker-compose.federation.yml up --build
```

Side A is at `http://localhost:8080` (domain `parley-a.local`).
Side B is at `http://localhost:8081` (domain `parley-b.local`).

Before running, open each side in a browser, register a pair of test users,
and establish friendship + personal chat between them so the XMPP bridge has
a shadow remote member and a room to broadcast into. The harness picks up
from there for bulk send/receive measurements.

## Run

```bash
cd loadtest
npm install
node federation-loadtest.mjs \
  --side-a-url=http://localhost:8080 \
  --side-b-url=http://localhost:8081 \
  --side-a-domain=parley-a.local \
  --side-b-domain=parley-b.local \
  --count=50 --messages=100
```

Output: throughput (msg/s), percentile latency (p50/p95/p99), error count.
