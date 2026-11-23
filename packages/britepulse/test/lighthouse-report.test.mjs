import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLighthouseReport,
  lighthouseMetricDefinitions,
  scheduleSyntheticSamples,
  aggregateSyntheticSamples,
} from '../dist/index.js';

const url = 'https://example.com/';
const context = {
  url,
  reports: { json: 'original/attempt-1.json', html: 'original/attempt-1.html' },
};

function report() {
  return {
    lighthouseVersion: '13.6.0',
    gatherMode: 'navigation',
    requestedUrl: url,
    finalDisplayedUrl: url,
    fetchTime: '2026-11-05T12:00:00.000Z',
    runWarnings: ['Fixture warning'],
    audits: Object.fromEntries(
      [
        ['first-contentful-paint', 100.25],
        ['largest-contentful-paint', 200.5],
        ['speed-index', 120.25],
        ['total-blocking-time', 0],
        ['cumulative-layout-shift', 0.125],
      ].map(([id, value]) => [
        id,
        {
          numericValue: value,
          numericUnit: id === 'cumulative-layout-shift' ? 'unitless' : 'millisecond',
          scoreDisplayMode: 'numeric',
          displayValue: 'DO NOT PARSE',
        },
      ]),
    ),
    categories: { performance: { score: 0.87 } },
    unrelatedUpstreamField: true,
  };
}

test('normalizes numeric units, zero values and fractional scores without mutating source', () => {
  const original = report();
  const before = structuredClone(original);
  const result = normalizeLighthouseReport(original, context);
  assert.equal(result.outcome.status, 'success');
  assert.deepEqual(result.outcome.metrics['largest-contentful-paint'], {
    value: 200.5,
    unit: 'ms',
  });
  assert.deepEqual(result.outcome.metrics['cumulative-layout-shift'], {
    value: 0.125,
    unit: 'unitless',
  });
  assert.deepEqual(result.outcome.metrics['total-blocking-time'], { value: 0, unit: 'ms' });
  assert.deepEqual(result.outcome.metrics['performance-score'], { value: 0.87, unit: 'score' });
  assert.deepEqual(result.outcome.reports, context.reports);
  assert.deepEqual(result.diagnostics, ['Fixture warning']);
  assert.deepEqual(original, before);
});

test('missing, invalid, error-mode and incompatible-unit metrics stay unknown', () => {
  for (const audit of [
    undefined,
    { numericValue: NaN },
    { numericValue: -1 },
    { numericValue: '123' },
    { numericValue: 123, numericUnit: 'second', scoreDisplayMode: 'numeric' },
    { numericValue: 123, numericUnit: 'millisecond', scoreDisplayMode: 'error' },
  ]) {
    const original = report();
    original.audits['largest-contentful-paint'] = audit;
    original.categories.performance.score = null;
    const result = normalizeLighthouseReport(original, context);
    assert.equal(result.outcome.status, 'success');
    assert.equal(result.outcome.metrics['largest-contentful-paint'].value, null);
    assert.equal(result.outcome.metrics['performance-score'].value, null);
    assert(result.diagnostics.some((message) => message.includes('largest-contentful-paint')));
  }
});

test('runtime errors and unexpected final URLs fail attempts and discard stale measurements', () => {
  for (const override of [
    { runtimeError: { code: 'NO_FCP', message: 'No paint' } },
    { finalDisplayedUrl: 'https://example.com/login' },
    { finalDisplayedUrl: 'chrome-error://chromewebdata/' },
  ]) {
    const result = normalizeLighthouseReport({ ...report(), ...override }, context);
    assert.equal(result.outcome.status, 'failed');
    assert(result.outcome.error);
    assert(Object.values(result.outcome.metrics).every((metric) => metric.value === null));
    assert.deepEqual(result.outcome.reports, context.reports);
  }
});

test('rejects unsupported versions/modes, wrong requested URL and unsafe artifact references', () => {
  for (const override of [
    { lighthouseVersion: '14.0.0' },
    { gatherMode: 'timespan' },
    { requestedUrl: 'https://other.example/' },
    { fetchTime: 'yesterday' },
    { audits: null },
  ])
    assert.throws(() => normalizeLighthouseReport({ ...report(), ...override }, context));
  assert.throws(() =>
    normalizeLighthouseReport(report(), { ...context, reports: { json: '../secret', html: null } }),
  );
});

test('normalization feeds scheduling and per-metric aggregation without browser imports', async () => {
  const samples = await scheduleSyntheticSamples(
    { url, runs: 3, retries: 0 },
    async () => normalizeLighthouseReport(report(), context).outcome,
  );
  const result = aggregateSyntheticSamples({
    url,
    expectedSamples: 3,
    metrics: lighthouseMetricDefinitions,
    samples,
  });
  assert.equal(result.status, 'complete');
  assert.equal(result.metrics['performance-score'].median, 0.87);
  assert.equal(result.metrics['largest-contentful-paint'].medianAbsoluteDeviation, 0);
});

test('invalid numeric measurements and out-of-range scores cannot become valid values', () => {
  for (const value of [null, -1, NaN, Infinity, '123']) {
    const original = report();
    original.audits['largest-contentful-paint'].numericValue = value;
    assert.equal(
      normalizeLighthouseReport(original, context).outcome.metrics['largest-contentful-paint']
        .value,
      null,
    );
  }
  for (const score of [-0.1, 1.1, NaN, Infinity, '0.9']) {
    const original = report();
    original.categories.performance.score = score;
    assert.equal(
      normalizeLighthouseReport(original, context).outcome.metrics['performance-score'].value,
      null,
    );
  }
});
