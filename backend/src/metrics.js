const client = require('prom-client');

const register = new client.Registry();

// Default Node.js process metrics (CPU, memory, GC, event loop lag)
client.collectDefaultMetrics({ register, prefix: 'app_' });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['operation'],
  registers: [register],
});

const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['operation'],
  registers: [register],
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of PostgreSQL queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

const urlsCreated = new client.Counter({
  name: 'urls_created_total',
  help: 'Total URLs shortened',
  registers: [register],
});

const urlsRedirected = new client.Counter({
  name: 'urls_redirected_total',
  help: 'Total URL redirects served',
  registers: [register],
});

const activeShortUrls = new client.Gauge({
  name: 'active_short_urls',
  help: 'Total number of short URLs in the database',
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  cacheHits,
  cacheMisses,
  dbQueryDuration,
  urlsCreated,
  urlsRedirected,
  activeShortUrls,
};
