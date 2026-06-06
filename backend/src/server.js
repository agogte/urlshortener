const express = require('express');
const pinoHttp = require('pino-http');
const { nanoid } = require('nanoid');

const logger = require('./logger');
const db = require('./db');
const cache = require('./cache');
const Url = require('./models/url');
const {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  urlsCreated,
  urlsRedirected,
  activeShortUrls,
} = require('./metrics');

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(express.json());
app.use(pinoHttp({ logger }));

// Track duration + request count for every response
app.use((req, res, next) => {
  const endTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status: res.statusCode };
    endTimer(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Prometheus scrape endpoint ────────────────────────────────────────────────

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── Shorten ───────────────────────────────────────────────────────────────────

app.post('/shorten', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const existing = await db.timed('find_existing', () =>
      Url.findOne({ redirectURL: url })
    );

    if (existing) {
      await cache.set(existing.shortID, url);
      req.log.info({ shortID: existing.shortID, url, reused: true }, 'Returning existing short URL');
      return res.json({
        shortID: existing.shortID,
        shortUrl: `http://localhost:${PORT}/${existing.shortID}`,
      });
    }

    const shortID = nanoid(7);
    await db.timed('insert_url', () =>
      Url.create({ shortID, redirectURL: url })
    );
    await cache.set(shortID, url);

    urlsCreated.inc();
    activeShortUrls.inc();

    req.log.info({ shortID, url }, 'URL shortened');
    res.status(201).json({ shortID, shortUrl: `http://localhost:${PORT}/${shortID}` });
  } catch (err) {
    req.log.error({ err }, 'Failed to shorten URL');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Redirect ──────────────────────────────────────────────────────────────────

app.get('/:shortID', async (req, res) => {
  const { shortID } = req.params;
  if (shortID === 'favicon.ico') return res.status(404).end();

  try {
    let redirectURL = await cache.get(shortID, 'redirect');

    if (!redirectURL) {
      const entry = await db.timed('find_url', () =>
        Url.findOne({ shortID })
      );
      if (!entry) return res.status(404).json({ error: 'Short URL not found' });
      redirectURL = entry.redirectURL;
      await cache.set(shortID, redirectURL);
    }

    // Don't block the redirect on the counter update
    db.timed('increment_clicks', () =>
      Url.updateOne({ shortID }, { $inc: { clickCount: 1 } })
    ).catch((err) => logger.error({ err, shortID }, 'Failed to increment click count'));

    urlsRedirected.inc();
    req.log.info({ shortID, redirectURL }, 'Redirecting');
    res.redirect(302, redirectURL);
  } catch (err) {
    req.log.error({ err }, 'Redirect failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────

app.get('/api/stats/:shortID', async (req, res) => {
  const { shortID } = req.params;
  try {
    const entry = await db.timed('get_stats', () =>
      Url.findOne({ shortID }, 'shortID redirectURL createdAt clickCount')
    );
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (err) {
    req.log.error({ err }, 'Failed to get stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  await cache.connect();
  await db.connect();
  await db.seedGauge(Url);
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server listening');
  });
}

start().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
