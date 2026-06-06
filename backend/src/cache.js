const redis = require('redis');
const logger = require('./logger');
const { cacheHits, cacheMisses } = require('./metrics');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => logger.error({ err }, 'Redis client error'));
client.on('connect', () => logger.info('Connected to Redis'));
client.on('ready', () => logger.info('Redis client ready'));

const TTL_SECONDS = 3600;
const CACHE_TIMEOUT_MS = 500;

function withTimeout(promise) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Cache timeout')), CACHE_TIMEOUT_MS)
  );
  return Promise.race([promise, timeout]);
}

async function connect() {
  await client.connect();
}

async function get(key, operation = 'get') {
  try {
    const val = await withTimeout(client.get(key));
    if (val !== null) {
      cacheHits.inc({ operation });
    } else {
      cacheMisses.inc({ operation });
    }
    return val;
  } catch (err) {
    // Redis unavailable or timed out — treat as miss, fall through to DB
    cacheMisses.inc({ operation });
    logger.warn({ key, operation, err: err.message }, 'Cache get failed, falling back to DB');
    return null;
  }
}

async function set(key, value) {
  try {
    await withTimeout(client.set(key, value, { EX: TTL_SECONDS }));
  } catch (err) {
    // Non-fatal — request still succeeds without caching
    logger.warn({ key, err: err.message }, 'Cache set failed');
  }
}

async function del(key) {
  try {
    await withTimeout(client.del(key));
  } catch (err) {
    logger.warn({ key, err: err.message }, 'Cache del failed');
  }
}

module.exports = { connect, get, set, del };
