# URL Shortener — Observability Lab
##### Author: Advait Gogte

A minimal URL-shortener API whose real purpose is learning production observability: Prometheus metrics, Grafana dashboards, structured JSON logging, and alert thresholds you can reason about.

## Stack

| Layer      | Technology               |
| ---------- | ------------------------ |
| API        | Node.js 20 + Express     |
| Database   | MongoDB 7 (Mongoose)     |
| Cache      | Redis 7                  |
| Metrics    | Prometheus + prom-client |
| Dashboards | Grafana 10               |
| Logging    | Pino (structured JSON)   |
| Runtime    | Docker Compose           |

## Quick start

```bash
docker compose up --build
```

| Service    | URL                   |
| ---------- | --------------------- |
| API        | http://localhost:3001 |
| Grafana    | http://localhost:3000 |
| Prometheus | http://localhost:9090 |

Grafana opens without a login (anonymous admin). The **URL Shortener — Observability** dashboard is pre-provisioned.

## API

### Shorten a URL

```bash
curl -X POST http://localhost:3001/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/some/long/path"}'
# → {"shortId":"abc1234","shortUrl":"http://localhost:3001/abc1234"}
```

### Follow a short URL

```bash
curl -L http://localhost:3001/abc1234
```

Redirects use `302 Found` (temporary) so every click passes through the server and is counted. A `301` would be cached by browsers and break analytics.

### Click stats

```bash
curl http://localhost:3001/api/stats/abc1234
```

### Health check

```bash
curl http://localhost:3001/health
```

### Raw Prometheus metrics

```bash
curl http://localhost:3001/metrics
```

## What you can observe

### Latency percentiles

The dashboard shows P50 / P95 / P99 across all routes. Run repeated requests and watch how the distribution changes:

```bash
for i in $(seq 1 200); do curl -s http://localhost:3001/abc1234 > /dev/null; done
```

P95 latency is the number oncall engineers page on — it captures the tail without being distorted by rare outliers the way P99 is.

### Cache hit ratio

The first redirect for a new short ID is a cache miss (MongoDB lookup). Every subsequent redirect within the 1-hour TTL is a hit. Watch the ratio climb as you replay the same short ID.

### Alert thresholds

Alerts are defined in `prometheus/alerts.yml`:

| Alert            | Condition                  | Severity |
| ---------------- | -------------------------- | -------- |
| HighP95Latency   | P95 > 500 ms for 2 min     | warning  |
| HighErrorRate    | 5xx rate > 5 % for 1 min   | critical |
| LowCacheHitRatio | hit ratio < 50 % for 5 min | warning  |
| SlowDbQueries    | DB P95 > 100 ms for 3 min  | warning  |

View firing alerts at http://localhost:9090/alerts.

### Redis resilience

The cache layer has a 500 ms timeout on every operation. If Redis is slow or unavailable, requests automatically fall back to MongoDB rather than hanging. You can observe this:

```bash
docker compose pause redis
curl http://localhost:3001/<shortID>   # responds in ~500 ms via MongoDB fallback
docker compose unpause redis
```

Redis cache data does not persist across restarts by design — it is a warm cache only, not a source of truth.

### MTTR exercise

Introduce a deliberate failure (pause Redis), watch the cache-miss spike and latency increase, then restore it and measure how long the dashboard takes to return to baseline.

```bash
docker compose pause redis
# ... observe dashboard ...
docker compose unpause redis
```

## Project structure

```
├── backend/
│   ├── src/
│   │   ├── server.js      # Express app, routes, request-metrics middleware
│   │   ├── db.js          # PostgreSQL pool + instrumented query helper
│   │   ├── cache.js       # Redis client + cache-hit/miss counters
│   │   ├── metrics.js     # All prom-client metric definitions
│   │   └── logger.js      # Pino structured JSON logger
│   ├── Dockerfile
│   └── package.json
├── prometheus/
│   ├── prometheus.yml     # Scrape config (15 s interval)
│   └── alerts.yml         # Alert rules
├── grafana/
│   └── provisioning/
│       ├── datasources/   # Auto-wires Prometheus as default datasource
│       └── dashboards/    # Auto-loads the dashboard JSON
├── docker-compose.yml
└── .env.example
```

## Metrics emitted

| Metric                          | Type      | Labels                            |
| ------------------------------- | --------- | --------------------------------- |
| `http_request_duration_seconds` | Histogram | method, route, status             |
| `http_requests_total`           | Counter   | method, route, status             |
| `cache_hits_total`              | Counter   | operation                         |
| `cache_misses_total`            | Counter   | operation                         |
| `db_query_duration_seconds`     | Histogram | operation                         |
| `urls_created_total`            | Counter   | —                                 |
| `urls_redirected_total`         | Counter   | —                                 |
| `active_short_urls`             | Gauge     | —                                 |
| `app_process_*`                 | (default) | Node.js heap, CPU, GC, event loop |
