import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { aggregateSyntheticSamples } from '../dist/index.js';

const url = 'https://example.com/';
const metrics = { lcp: { unit: 'ms', direction: 'lower' } };

function sample(value, attempt, overrides = {}) {
  return {
    schemaVersion: 1,
    id: randomUUID(),
    url,
    attempt,
    warmup: false,
    status: 'success',
    metrics: { lcp: { value, unit: 'ms' } },
    error: null,
    reports: { json: null, html: null },
    ...overrides,
  };
}

function aggregate(samples, expectedSamples = 3) {
  return aggregateSyntheticSamples({ url, metrics, expectedSamples, samples });
}

test('aggregates per metric, excluding warmups and failed retries without rounding', () => {
  const result = aggregate([
    sample(900, 1, { warmup: true }),
    sample(999, 2, { status: 'failed', error: 'Navigation failed' }),
    sample(1, 3),
    sample(4.5, 4),
    sample(8, 5),
  ]);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.metrics.lcp, {
    unit: 'ms',
    direction: 'lower',
    median: 4.5,
    medianAbsoluteDeviation: 3.5,
    validSamples: 3,
    attemptedSamples: 4,
  });
});

test('missing metric values keep per-metric aggregates partial and preserve zero', () => {
  const result = aggregate([sample(0, 1), sample(null, 2), sample(4, 3)]);
  assert.equal(result.status, 'partial');
  assert.equal(result.metrics.lcp.median, 2);
  assert.equal(result.metrics.lcp.medianAbsoluteDeviation, 2);
  assert.equal(result.metrics.lcp.validSamples, 2);
  assert.match(result.diagnostics.join(), /lcp/);
  const missing = aggregate([sample(null, 1, { metrics: {} })]);
  assert.equal(missing.metrics.lcp.median, null);
  assert.equal(missing.metrics.lcp.medianAbsoluteDeviation, null);
  assert.equal(aggregate([]).metrics.lcp.attemptedSamples, 0);
});

test('does not overflow even-sized medians or mutate samples', () => {
  const samples = [sample(Number.MAX_VALUE, 1), sample(Number.MAX_VALUE, 2)];
  const before = structuredClone(samples);
  assert.equal(aggregate(samples, 2).metrics.lcp.median, Number.MAX_VALUE);
  assert.deepEqual(samples, before);
});

test('rejects mixed URLs, duplicate identities, excess successes and incompatible units', () => {
  const first = sample(1, 1);
  for (const samples of [
    [sample(1, 1, { url: 'https://other.example/' })],
    [first, { ...first, attempt: 2 }],
    [first, sample(2, 1)],
    [sample(1, 1, { metrics: { lcp: { value: 1, unit: 'score' } } })],
  ])
    assert.throws(() => aggregate(samples));
  assert.throws(() => aggregate([sample(1, 1), sample(2, 2)], 1));
  assert.throws(() => aggregate([sample(NaN, 1)]));
  assert.throws(() => aggregate([], 0));
});

test('computes independent metric counts and retains fractional scores', () => {
  const samples = [1, 2, 3].map((attempt) => sample(attempt * 100, attempt));
  samples[0].metrics.score = { value: 0.75, unit: 'score' };
  samples[1].metrics.score = { value: 0.9, unit: 'score' };
  const result = aggregateSyntheticSamples({
    url,
    expectedSamples: 3,
    metrics: { ...metrics, score: { unit: 'score', direction: 'higher' } },
    samples,
  });
  assert.equal(result.status, 'partial');
  assert.equal(result.metrics.lcp.validSamples, 3);
  assert.equal(result.metrics.lcp.median, 200);
  assert.equal(result.metrics.score.validSamples, 2);
  assert.equal(result.metrics.score.median, 0.825);
  assert.equal(result.metrics.score.direction, 'higher');
  assert.equal(JSON.parse(JSON.stringify(result)).metrics.score.unit, 'score');
});
