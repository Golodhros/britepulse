import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleSnapshotSchema,
  metricAggregateSchema,
  syntheticSampleSchema,
  runManifestSchema,
  comparisonSchema,
  budgetResultSchema,
  parseBundleSnapshot,
} from '../dist/contracts.js';
const id = '48d36f03-5dfc-4b2a-80e9-d3f52efa4c27';
const sizes = {
  emittedBytes: null,
  parsedBytes: null,
  gzipBytes: null,
  brotliBytes: null,
  transferBytes: null,
};
const snapshot = () => ({
  schemaVersion: 1,
  runId: id,
  adapter: 'vite',
  toolVersions: { vite: '8.3.5' },
  capabilities: { modules: 'unavailable', routes: 'unavailable', compression: 'unavailable' },
  completeness: { status: 'partial', diagnostics: ['Missing original asset'] },
  assets: [{ id: 'assets/unknown.js', kind: 'js', sizes: { ...sizes }, modules: [] }],
  entrypoints: { main: { initial: ['assets/unknown.js'], asynchronous: [] } },
  compression: null,
});
test('snapshots round-trip unknown byte measurements without fabricating zeros', () => {
  const parsed = parseBundleSnapshot(JSON.parse(JSON.stringify(snapshot())));
  assert.equal(parsed.assets[0].sizes.emittedBytes, null);
  assert.equal(parsed.assets[0].sizes.transferBytes, null);
  assert.equal(parsed.capabilities.modules, 'unavailable');
});
test('entrypoint accounting rejects duplicates, overlap and implicit missing assets', () => {
  const duplicate = snapshot();
  duplicate.assets.push(duplicate.assets[0]);
  assert.equal(bundleSnapshotSchema.safeParse(duplicate).success, false);
  const overlap = snapshot();
  overlap.entrypoints.main.asynchronous.push('assets/unknown.js');
  assert.equal(bundleSnapshotSchema.safeParse(overlap).success, false);
  const missing = snapshot();
  missing.entrypoints.main.initial.push('missing.js');
  assert.equal(bundleSnapshotSchema.safeParse(missing).success, false);
});
test('measurement formats reject nonfinite values, negative sizes and unnamed compression', () => {
  for (const emittedBytes of [NaN, Infinity, -1, 0.5]) {
    const input = snapshot();
    input.assets[0].sizes.emittedBytes = emittedBytes;
    assert.equal(bundleSnapshotSchema.safeParse(input).success, false);
  }
  const input = snapshot();
  input.assets[0].sizes.gzipBytes = 12;
  assert.equal(bundleSnapshotSchema.safeParse(input).success, false);
  assert.throws(
    () => parseBundleSnapshot({ ...snapshot(), schemaVersion: 0 }),
    /Unsupported schemaVersion/,
  );
});
test('aggregates preserve counts and prohibit known medians without valid samples', () => {
  const aggregate = {
    unit: 'ms',
    direction: 'lower',
    median: 101,
    medianAbsoluteDeviation: 1,
    validSamples: 3,
    attemptedSamples: 4,
  };
  assert.deepEqual(metricAggregateSchema.parse(JSON.parse(JSON.stringify(aggregate))), aggregate);
  assert.equal(metricAggregateSchema.safeParse({ ...aggregate, validSamples: 5 }).success, false);
  assert.equal(metricAggregateSchema.safeParse({ ...aggregate, validSamples: 0 }).success, false);
  assert(
    metricAggregateSchema.safeParse({
      ...aggregate,
      median: null,
      medianAbsoluteDeviation: null,
      validSamples: 0,
    }).success,
  );
});
test('failed samples require diagnostics and artifact paths cannot traverse history', () => {
  const sample = {
    schemaVersion: 1,
    id,
    url: 'https://example.com/',
    attempt: 1,
    warmup: false,
    status: 'failed',
    metrics: { lcp: { value: null, unit: 'ms' } },
    error: 'Browser timed out',
    reports: { json: null, html: null },
  };
  assert(syntheticSampleSchema.safeParse(sample).success);
  assert.equal(syntheticSampleSchema.safeParse({ ...sample, error: null }).success, false);
  for (const json of [
    '../outside.json',
    '/tmp/outside.json',
    'C:\\outside.json',
    'artifacts/../outside.json',
  ])
    assert.equal(
      syntheticSampleSchema.safeParse({ ...sample, reports: { json, html: null } }).success,
      false,
    );
});
test('run state cannot claim completion without a valid completion time', () => {
  const run = {
    schemaVersion: 1,
    id,
    label: 'release',
    createdAt: '2026-11-04T12:00:00.000Z',
    finishedAt: null,
    status: 'running',
    environment: 'local',
    framework: 'vite',
    configFingerprint: 'a'.repeat(64),
    toolVersions: {},
    git: null,
    artifacts: [],
    diagnostics: [],
  };
  assert(runManifestSchema.safeParse(run).success);
  assert.equal(runManifestSchema.safeParse({ ...run, status: 'complete' }).success, false);
  assert.equal(
    runManifestSchema.safeParse({
      ...run,
      status: 'complete',
      finishedAt: '2026-11-03T12:00:00.000Z',
    }).success,
    false,
  );
});
test('missing values and zero baselines do not produce percentage claims', () => {
  const comparison = {
    schemaVersion: 1,
    id,
    baselineId: id,
    candidateId: id,
    compatible: true,
    diagnostics: [],
    metrics: {
      lcp: {
        unit: 'ms',
        direction: 'lower',
        baseline: 0,
        candidate: 10,
        absolute: 10,
        percent: null,
      },
    },
  };
  assert(comparisonSchema.safeParse(comparison).success);
  comparison.metrics.lcp.percent = 100;
  assert.equal(comparisonSchema.safeParse(comparison).success, false);
  comparison.metrics.lcp.percent = null;
  comparison.compatible = false;
  assert.equal(comparisonSchema.safeParse(comparison).success, false);
  comparison.metrics.lcp.baseline = null;
  comparison.metrics.lcp.absolute = null;
  assert(comparisonSchema.safeParse(comparison).success);
});
test('missing measurements cannot pass a budget', () => {
  const result = {
    schemaVersion: 1,
    metric: 'lcp',
    unit: 'ms',
    direction: 'lower',
    status: 'pass',
    limit: 2500,
    observed: null,
    reason: null,
  };
  assert.equal(budgetResultSchema.safeParse(result).success, false);
  assert(
    budgetResultSchema.safeParse({ ...result, status: 'error', reason: 'No valid samples' })
      .success,
  );
});
