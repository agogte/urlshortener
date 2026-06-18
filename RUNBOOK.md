# Incident Response Runbook

This runbook maps every alert in [`prometheus/alerts.yml`](prometheus/alerts.yml) to a concrete response procedure. Each entry follows the same shape: **what fired → what it means → how to triage → how to mitigate → when to escalate**. The goal is to keep Mean Time to Resolution (MTTR) low by removing decision-making from the critical path — by the time you're paged, the steps should already be written down.

## How to use this document

1. Find the alert name in the table of contents below.
2. Follow the triage steps in order — they're ordered cheapest-check-first.
3. If the mitigation step resolves it, confirm with the verification query before closing.
4. If you escalate or this turns into a real incident, open a postmortem (see [Postmortem Trigger Criteria](#postmortem-trigger-criteria)).

## Alert Index

| Alert | Severity | Threshold | MTTA target | MTTR target |
|---|---|---|---|---|
| [SLOFastBurn](#slofastburn) | critical | burn rate > 14.4× for 5 m | < 5 min | < 1 hour |
| [HighErrorRate](#higherrorrate) | critical | 5xx rate > 5 % for 1 m | < 5 min | < 30 min |
| [SLOSlowBurn](#sloslowburn) | warning | burn rate > 1× for 1 h | < 30 min | < 4 hours |
| [HighP95Latency](#highp95latency) | warning | P95 > 500 ms for 2 m | < 15 min | < 1 hour |
| [SlowDbQueries](#slowdbqueries) | warning | DB P95 > 100 ms for 3 m | < 15 min | < 1 hour |
| [LowCacheHitRatio](#lowcachehitratio) | warning | hit ratio < 50 % for 5 m | < 30 min | < 2 hours |

MTTA = Mean Time to Acknowledge, MTTR = Mean Time to Resolution. Targets are aspirational baselines for this project's scale; recalibrate against real incident data once you have a sample size worth trusting.

---

## SLOFastBurn

**Fires when:** error-budget burn rate exceeds 14.4× for 5 minutes — at this rate the 30-day error budget (99% of redirects < 200 ms) is exhausted in under 50 hours.

**What it means:** a large share of redirect requests are now exceeding 200 ms. This is the highest-signal alert in the system — it's the one that should page someone immediately, day or night.

**Triage (in order):**
1. Check the **SLO Compliance History** and **Error Budget Burn Rate** panels on the [Grafana SLO dashboard](grafana/provisioning/dashboards/url-shortener.json) — confirm this isn't a single-route blip by checking the **P95 Latency by Route** panel.
2. Check **DB Query Duration P95 by Operation** — if `find_url` or `increment_clicks` spiked, the database is the likely cause.
3. Check **Cache Hit Ratio** — a sudden drop means Redis is unavailable or evicting aggressively, pushing traffic to Mongo (each cache miss costs ~10–20 ms more).
4. Check **Node.js CPU Usage** and **Heap Memory** — rule out the app process itself being CPU-starved or GC-thrashing.
5. Check infra-level signals outside this stack: is the host under load, is there a network partition to Mongo/Redis, did a deploy just go out (`git log` / deploy tooling)?

**Mitigate:**
- If a recent deploy correlates with the spike → roll back immediately. Don't wait for root cause.
- If Redis is down/degraded → the app already degrades gracefully (500 ms cache timeout, falls through to Mongo — see [DESIGN.md](DESIGN.md#3-why-redis-ttl-is-1-hour-3-600-seconds)). Restart the Redis container/service; confirm `cache_hits_total` resumes incrementing.
- If Mongo is slow → check for missing indexes, connection-pool exhaustion, or a long-running query holding a lock. Restart the app if connections are exhausted (`db.timed` queries will time out otherwise).
- If load-driven (legitimate traffic spike, e.g. a viral link) → this is a capacity problem, not a bug. Scale the app horizontally if infrastructure supports it; otherwise this is an accepted, documented SLO breach — record it and move to postmortem.

**Verify resolved:** burn rate drops back under 1× on the **Error Budget Burn Rate (1 h)** stat panel, sustained for at least 10 minutes.

**Escalate if:** not resolved within 30 minutes, or root cause is unclear after the triage steps above — page the on-call lead.

---

## HighErrorRate

**Fires when:** 5xx response rate exceeds 5% of all requests for 1 minute.

**What it means:** the app is actively failing requests, not just slow. Distinct from the SLO alerts — this catches hard failures (exceptions, DB connection errors, unhandled rejections), not latency.

**Triage:**
1. Tail application logs (`pino` JSON logs via `req.log.error` in [server.js](backend/src/server.js)) for the stack trace tied to the spike. Every 500 in this codebase logs `err` before responding.
2. Identify which route is failing — `/shorten`, `/:shortID`, or `/api/stats/:shortID` — via the **Request Rate by Route** panel filtered to 5xx, or by grepping logs for `"Failed to shorten URL"`, `"Redirect failed"`, or `"Failed to get stats"`.
3. Check whether Mongo is reachable at all (`db.connect()` failures show as a fatal startup error, but a mid-run disconnect surfaces as 500s on every DB-touching route).

**Mitigate:**
- Mongo connection lost → restart the app container; confirm `db.connect()` succeeds on boot.
- Bad deploy introduced an exception → roll back.
- Unexpected input causing an unhandled exception → identify the offending request from logs, patch, redeploy. If you can't patch immediately, see if input validation at the edge (e.g., a WAF rule or nginx-level filter) can shed the bad traffic as a stopgap.

**Verify resolved:** 5xx rate back under 1% sustained for 5 minutes.

**Escalate if:** not resolved within 15 minutes, or if you can't identify the failing route from logs alone.

---

## SLOSlowBurn

**Fires when:** error-budget burn rate exceeds 1× for 1 hour — consuming budget faster than it replenishes, but not at emergency pace.

**What it means:** there's a sustained, mild latency degradation. Not urgent, but if ignored it eats the monthly error budget and leaves no margin for a future incident.

**Triage:** same steps as [SLOFastBurn](#slofastburn), but there's time to be methodical. Look for slow trends rather than spikes — check whether **Cache Hit Ratio** has been declining over hours/days (TTL tuning issue, cold cache after a restart) or whether **DB Query Duration P95** has been creeping up (data growth, missing index, connection pool sized too small for current traffic).

**Mitigate:** same options as fast burn, but lower urgency justifies root-causing properly rather than rolling back reflexively.

**Verify resolved:** burn rate back under 1× sustained for 30 minutes.

**Escalate if:** unresolved after 4 hours, or the trend keeps recurring (recurring slow burns are a capacity-planning signal — bring to the next planning review, not just to on-call).

---

## HighP95Latency

**Fires when:** P95 latency on any route exceeds 500 ms for 2 consecutive minutes.

**What it means:** this is a **symptom detector**, not the SLO itself (see [DESIGN.md](DESIGN.md#1-why-p95-for-alerting-not-p99) for why P95 was chosen over P99 here). It typically fires before or alongside an SLO burn-rate alert and helps pinpoint *which route* is degraded, since the SLO alerts are scoped only to the redirect path.

**Triage:**
1. Identify the affected route from the alert's `{{ $labels.route }}` annotation.
2. If it's `/shorten` or `/api/stats/:shortID` (not the redirect path), this won't trip the SLO alerts but is still worth investigating — check **DB Query Duration P95 by Operation** for the corresponding operation (`find_existing`, `insert_url`, `get_stats`).
3. If it's `/:shortID`, treat as a leading indicator for [SLOFastBurn](#slofastburn)/[SLOSlowBurn](#sloslowburn) and jump to that triage.

**Mitigate:** route-specific; see DB/cache mitigation steps under SLOFastBurn.

**Verify resolved:** P95 for the affected route back under 500 ms for 5 minutes.

**Escalate if:** unresolved after 1 hour.

---

## SlowDbQueries

**Fires when:** P95 duration for any MongoDB operation exceeds 100 ms for 3 minutes.

**What it means:** a specific DB operation (`find_existing`, `insert_url`, `find_url`, `increment_clicks`, `get_stats`) is regressing. This is a leading indicator — DB latency shows up here before it shows up in end-to-end HTTP latency, since `/:shortID` redirects only hit Mongo on a cache miss.

**Triage:**
1. Check `{{ $labels.operation }}` in the alert to identify which query is slow.
2. Run `db.urls.find({shortID: "..."}).explain()`-style diagnostics for `find_url` / `find_existing` — confirm the `shortID` and `redirectURL` fields are indexed (`find_existing` queries by `redirectURL`, which is a less common index to have by default).
3. Check Mongo server-side metrics (connections, lock %, disk I/O) if you have access — this Prometheus setup only instruments the client side.
4. For `increment_clicks`, recall it's fire-and-forget (`.catch()`'d, not awaited by the response) — a slow click counter never blocks a redirect, but a consistently slow one suggests a missing index on `shortID` for updates, or write contention.

**Mitigate:**
- Missing index → add it. This is the most common root cause for this alert in a small, growing dataset.
- Connection pool exhaustion → increase pool size or investigate why connections aren't being released.
- Disk-bound Mongo host → this is an infrastructure capacity issue, escalate to whoever owns the DB infrastructure.

**Verify resolved:** operation P95 back under 100 ms for 5 minutes.

**Escalate if:** unresolved after 1 hour, or if it requires a schema/index migration that needs review before applying.

---

## LowCacheHitRatio

**Fires when:** cache hit ratio drops below 50% for 5 minutes.

**What it means:** more than half of redirect/lookup requests are missing Redis and falling through to Mongo. Not an outage by itself — the app degrades gracefully — but it removes the latency cushion that keeps the SLO healthy, and sustained misses increase DB load.

**Triage:**
1. Check if Redis is reachable at all — look for `"Redis client error"` or `"Cache get failed, falling back to DB"` log lines from [cache.js](backend/src/cache.js).
2. If Redis is reachable but the ratio is still low, consider: did the cache just restart (cold cache, expected temporary dip)? Did TTL tuning change? Is traffic distribution shifting toward many one-off URLs (long-tail, not power-law — see [DESIGN.md](DESIGN.md#the-power-law-argument-for-1-hour)) instead of repeat hits on a few hot links?
3. Check Redis memory usage / eviction stats if accessible — `allkeys-lru` eviction under memory pressure will silently drop entries before their TTL expires.

**Mitigate:**
- Redis down → restart it. The app will keep serving from Mongo in the meantime (slower, but correct) — this alone does not justify rolling back a deploy.
- Cold cache after restart → no action needed, ratio recovers as traffic repopulates the cache; if it doesn't recover within ~1 TTL window (1 hour), something else is wrong.
- Memory pressure / eviction → increase Redis memory allocation, or revisit the TTL (shortening it trades hit ratio for memory headroom — see the TTL tradeoff in DESIGN.md before changing it).

**Verify resolved:** hit ratio back above 70% sustained for 10 minutes.

**Escalate if:** unresolved after 2 hours, or if it's masking a deeper issue (e.g., Redis crash-looping).

---

## Postmortem Trigger Criteria

Open a postmortem when any of the following is true:
- Any `critical` severity alert ([SLOFastBurn](#slofastburn), [HighErrorRate](#higherrorrate)) was active for more than 15 minutes.
- The 30-day SLO error budget was fully exhausted (Error Budget Remaining hit 0% on the Grafana SLO dashboard).
- The same alert fired 3+ times in a 7-day period (recurring pages indicate an unaddressed root cause, not bad luck).
- Customer-visible impact occurred (broken redirects, data loss) regardless of which alert fired or whether one fired at all.

A postmortem should capture: timeline (alert fired → acknowledged → mitigated → resolved), root cause, what the runbook got right/wrong, and a follow-up action with an owner and date — not just "monitor more closely."

## Maintaining this runbook

Alert thresholds here are sourced directly from [`prometheus/alerts.yml`](prometheus/alerts.yml) and the SLO model in [`DESIGN.md`](DESIGN.md). If you change a threshold in one, update the other — a runbook describing thresholds that no longer match the live alert rules is worse than no runbook, because it actively misleads whoever is paged.
