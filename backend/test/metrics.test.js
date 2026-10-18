const test = require('node:test');
const assert = require('node:assert');

const { register, urlsCreated, cacheHits } = require('../src/metrics');

test('registry exposes the expected custom metrics', async () => {
  const output = await register.metrics();
  for (const name of [
    'http_request_duration_seconds',
    'http_requests_total',
    'cache_hits_total',
    'cache_misses_total',
    'db_query_duration_seconds',
    'urls_created_total',
    'urls_redirected_total',
    'active_short_urls',
  ]) {
    assert.ok(output.includes(name), `missing metric ${name}`);
  }
});

test('counters increment', async () => {
  urlsCreated.inc();
  cacheHits.inc({ operation: 'get' });
  const output = await register.metrics();
  assert.match(output, /urls_created_total 1/);
  assert.match(output, /cache_hits_total\{operation="get"\} 1/);
});
