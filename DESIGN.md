# Design Decisions

This document explains the non-obvious choices made in this URL shortener. Each decision involves a real tradeoff; the goal is to show the reasoning, not just the outcome.

---

## 1. Why P95 for alerting, not P99

### The SLO vs. the alert are different things

The SLO is defined on the aggregate: *99 % of redirects must complete in under 200 ms over a rolling 30-day window*. That number lives in the Grafana error-budget panel and the `SLOFastBurn` / `SLOSlowBurn` Prometheus alerts, which fire on **burn rate** rather than on an instantaneous percentile.

The existing `HighP95Latency` alert is a **symptom detector**, not the SLO enforcer. Alerting on P95 there is a deliberate choice:

### Statistical stability at low traffic

At moderate traffic (say, 500 req/min on the redirect route), a 5-minute window contains ~2 500 requests. The P99 is determined by the slowest ~25 of those. A single slow DB query, a GC pause, or a connection-pool blip produces one or two outliers — enough to move P99 dramatically while P95 stays flat. P99-based alerts at this scale fire on noise, not on real user impact.

P95 requires ~125 of those 2 500 requests to be slow. That is a structural problem (saturated connection pool, bad index, Redis unavailability), not a one-off event. The signal-to-noise ratio is meaningfully higher.

### Alert fatigue is a safety issue

An alert that fires three times a night and self-resolves before anyone can respond trains the on-call rotation to ignore it. P95 alerting produces fewer, higher-confidence pages. When it does fire, it is almost always worth waking someone up.

### What P99 is good for

P99 belongs on dashboards for **capacity planning** and in post-mortems. It is the right metric for catching tail-latency regressions during a deploy (compare P99 before and after). It is the wrong metric for operational alerting at typical web-app traffic levels.

### The 30-day SLO uses an aggregate, not a percentile

The Prometheus query for SLO compliance is:

```promql
increase(http_request_duration_seconds_bucket{route="/:shortID",le="0.2"}[30d])
/
increase(http_request_duration_seconds_count{route="/:shortID"}[30d])
```

This counts every redirect over 30 days and asks what fraction completed in under 200 ms. The burn-rate alerts fire when the *rate* of budget consumption exceeds what the 1 % error budget can sustain. This is the approach recommended in the Google SRE Workbook (chapter 5): define the SLO on an aggregate ratio, alert on burn rate, and keep instantaneous-percentile alerts as supporting signals only.

---

## 2. Why 302 (Temporary Redirect) instead of 301 (Permanent Redirect)

### 301 is cached forever by browsers — and there is no way to undo it

HTTP 301 tells the client: *this resource has moved permanently; cache the destination and never ask me again*. Major browsers (Chrome, Firefox, Safari) honour this indefinitely. Once a user's browser has seen `301 → https://destination.com`, it will go directly to `https://destination.com` without hitting the shortener, regardless of what you change on the server.

For a URL shortener, that is catastrophic:

- **No click tracking.** Every subsequent visit skips the server entirely, so `urls_redirected_total` misses all cached hits.
- **Unrevocable links.** If the destination URL changes, moves behind auth, or is taken down, users who already have the 301 cached will land on the wrong (or broken) page — possibly forever.
- **No A/B routing or link expiry.** Any feature that requires server-side logic per redirect is incompatible with 301 caching.

### 302 keeps control server-side

`302 Found` tells the client: *go here for this request, but check back next time*. The browser may cache a 302 for the duration of the session, but it will revalidate on subsequent visits. This means:

- Every redirect hits the server → accurate click counts.
- Changing the destination URL takes effect immediately for all users.
- Future features (expiring links, per-user routing, rate limiting) are possible without invalidating anything in the browser.

### The performance argument for 301 does not hold at this scale

The argument for 301 is that it removes one round-trip for returning users. In practice: a redirect server that responds in < 50 ms P50 adds negligible latency compared to DNS resolution and TLS handshake on the destination. The 30-day P99 on a warm Redis cache is well under 10 ms. The "saved round-trip" is not worth giving up control of the link permanently.

### Why not 307 or 308?

307 (Temporary Redirect, method-preserving) and 308 (Permanent, method-preserving) exist so that a `POST` redirects as a `POST`. Shorteners only receive `GET` requests on the redirect path, so the distinction does not matter. 302 remains the conventional choice and is immediately recognisable to any engineer reading the code.

---

## 3. Why Redis TTL is 1 hour (3 600 seconds)

### Redis is a cache, not a source of truth

MongoDB holds the canonical mapping. Redis is an acceleration layer. The TTL exists to prevent unbounded memory growth: without it, every URL ever shortened would live in Redis indefinitely.

### Why not a shorter TTL (e.g., 5 minutes)?

URL destinations do not change often — for this service, essentially never after creation. A 5-minute TTL means a URL clicked 100 times an hour misses the cache every 5 minutes and pays a MongoDB round-trip. Under sustained load that amplifies DB pressure without providing any benefit (the data has not changed).

A 5-minute TTL also defeats the purpose during traffic spikes. If a short URL goes viral, the cache should absorb the burst. With a 5-minute TTL, the cache warms up and expires before the spike subsides, and the database takes the full load.

### Why not a longer TTL (e.g., 24 hours or no TTL)?

Two reasons:

1. **Memory.** Redis is configured with a default eviction policy (`allkeys-lru` is typical). Without a TTL, stale entries (URLs that were clicked once and never again) occupy memory indefinitely and crowd out hot entries.

2. **Operational simplicity.** If we ever add a "delete link" or "update destination" feature, we need a bounded staleness window. With a 1-hour TTL, stale reads self-heal within an hour. With no TTL, every delete operation would need to explicitly invalidate Redis (`cache.del(shortID)`) — the code already does this, but the TTL is a safety net if the delete path fails.

### The power-law argument for 1 hour

Web traffic follows a power-law distribution: the top ~1 % of short URLs receive the majority of clicks (viral links, homepage links, campaign URLs). A 1-hour TTL ensures these hot URLs stay warm continuously, since they are re-requested far more frequently than once per hour. Cold URLs (clicked once a week) expire naturally between visits, freeing memory for the hot tier. One hour is long enough to cover a viral spike (typically 15–60 minutes of peak traffic) and short enough to keep the working set manageable.

### The 500 ms cache timeout

Alongside TTL, `cache.js` enforces a 500 ms timeout on every Redis call. If Redis is unavailable or slow, the request falls through to MongoDB rather than hanging. This is a deliberate degraded-mode decision: the SLO is on end-to-end redirect latency, not on cache availability. A Redis outage should not cause 502s; it should cause a temporary latency increase (DB path adds ~5–20 ms P95 on warm Mongo) that is well within the 200 ms SLO budget.

---

## SLO Math Reference

| Metric | Value |
|---|---|
| SLO target | 99 % of redirects < 200 ms over 30 days |
| Error budget | 1 % = 432 minutes of "bad" time in 30 days |
| Fast-burn threshold | 14.4× (budget exhausted in < 50 hours) |
| Slow-burn threshold | 1× (consuming budget at exactly the allowed rate) |
| Histogram bucket for SLI | `le="0.2"` (exact 200 ms boundary) |

Burn rate is computed as:

```
burn_rate = (1 - good_requests / total_requests) / error_budget_ratio
           = error_rate / 0.01
```

A burn rate of 1 means you consume exactly 1 % of requests above the threshold — the budget lasts exactly 30 days. At 14.4×, the budget exhausts in 30 d / 14.4 ≈ 2.08 days (≈ 50 hours), which is the Google SRE Workbook's recommended fast-burn threshold for a 2-hour alert window.
