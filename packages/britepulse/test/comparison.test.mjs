import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  RunStore,
  withTemporaryDirectory,
  compareRuns,
  exportComparisonReport,
} from '../dist/index.js';
import { bundleRun, syntheticRun } from './helpers/comparison.mjs';

test('compares known bundle sizes without counting shared assets twice and persists its report', async () =>
  withTemporaryDirectory(async (directory) => {
    const store = new RunStore(join(directory, 'history'));
    const a = await bundleRun(store, 100);
    const b = await bundleRun(store, 150);
    const comparison = await compareRuns(store, a.id, b.id);
    assert.equal(comparison.compatible, true);
    const metric =
      comparison.metrics[JSON.stringify(['bundle', 'All exported assets', 'JS emittedBytes'])];
    assert.deepEqual(metric, {
      unit: 'bytes',
      direction: 'lower',
      baseline: 100,
      candidate: 150,
      absolute: 50,
      percent: 50,
    });
    const report = await store.readComparisonReport(comparison.id);
    assert.equal(report.rows.length, Object.keys(comparison.metrics).length);
    assert.equal(report.baseline.id, a.id);
    assert.equal(report.baselineComplete, true);
    const path = await exportComparisonReport(store, comparison.id, join(directory, 'report.html'));
    const html = await readFile(path, 'utf8');
    await assert.rejects(
      exportComparisonReport(store, comparison.id, join(store.directory, '..reports/report.html')),
      /outside/,
    );
    const alias = join(directory, 'history-alias');
    await symlink(store.directory, alias);
    await assert.rejects(
      exportComparisonReport(store, comparison.id, join(alias, 'report.html')),
      /outside/,
    );
    assert.match(html, /britepulse-report-data/);
    assert(!html.includes('src="./assets/'));
    assert(!html.includes('href="./assets/'));
    await assert.rejects(exportComparisonReport(store, comparison.id, path), { code: 'EEXIST' });
    await assert.rejects(
      exportComparisonReport(store, comparison.id, join(store.directory, 'report.html')),
      /outside/,
    );
  }));

test('incompatible profiles retain values but cannot produce numeric differences', async () =>
  withTemporaryDirectory(async (directory) => {
    const store = new RunStore(directory);
    const a = await bundleRun(store, 100);
    const b = await bundleRun(store, 150, { metadata: { configFingerprint: 'b'.repeat(64) } });
    const comparison = await compareRuns(store, a.id, b.id);
    assert.equal(comparison.compatible, false);
    assert(
      Object.values(comparison.metrics).every(
        (metric) => metric.absolute === null && metric.percent === null,
      ),
    );
    assert(comparison.diagnostics.includes('Configuration fingerprints differ'));
  }));

test('missing bundle sizes and added entrypoints do not become zero baselines', async () =>
  withTemporaryDirectory(async (directory) => {
    const store = new RunStore(directory);
    const a = await bundleRun(store, null, {
      status: 'partial',
      snapshot: { completeness: { status: 'partial', diagnostics: ['Unknown size'] } },
    });
    const b = await bundleRun(store, 50, {
      snapshot: { entrypoints: { 'new.html': { initial: ['shared.js'], asynchronous: [] } } },
    });
    const comparison = await compareRuns(store, a.id, b.id);
    const js =
      comparison.metrics[JSON.stringify(['bundle', 'All exported assets', 'JS emittedBytes'])];
    assert.equal(js.baseline, null);
    assert.equal(js.absolute, null);
    const added =
      comparison.metrics[JSON.stringify(['bundle', 'new.html · initial', 'JS emittedBytes'])];
    assert.equal(added.baseline, null);
    assert.equal(added.candidate, 50);
    assert.equal((await store.readComparisonReport(comparison.id)).baselineComplete, false);
  }));

test('zero baselines retain absolute differences without percentage claims', async () =>
  withTemporaryDirectory(async (directory) => {
    const store = new RunStore(directory);
    const a = await syntheticRun(store, 0);
    const b = await syntheticRun(store, 10);
    const comparison = await compareRuns(store, a.id, b.id);
    const metric = Object.values(comparison.metrics)[0];
    assert.equal(metric.absolute, 10);
    assert.equal(metric.percent, null);
    const report = await store.readComparisonReport(comparison.id);
    assert.equal(report.rows[0].baselineSamples.validSamples, 3);
  }));

test('report data is escaped and stored readers refuse symlinks or unlisted artifacts', async () =>
  withTemporaryDirectory(async (directory) => {
    const store = new RunStore(join(directory, 'history'));
    const a = await bundleRun(store, 100, {
      metadata: { label: '</script><script>alert(1)</script>' },
    });
    const b = await bundleRun(store, 100);
    const comparison = await compareRuns(store, a.id, b.id);
    const html = await readFile(
      await exportComparisonReport(store, comparison.id, join(directory, 'safe.html')),
      'utf8',
    );
    assert(!html.includes(a.label));
    await assert.rejects(store.readRunArtifact(a.id, '../outside.json'), /Invalid/);
    await assert.rejects(store.readRunArtifact(a.id, 'unlisted.json'), /not listed/);
    const runDirectory = join(store.directory, 'runs', a.id);
    await symlink('normalized', join(runDirectory, 'link'));
    await assert.rejects(store.readRunArtifact(a.id, 'link/bundle.json'), /not listed/);
    await rm(join(runDirectory, 'normalized/bundle.json'));
    await symlink(
      join(store.directory, 'runs', b.id, 'normalized/bundle.json'),
      join(runDirectory, 'normalized/bundle.json'),
    );
    await assert.rejects(store.readRunArtifact(a.id, 'normalized/bundle.json'), /ordinary/);
    await assert.rejects(compareRuns(store, a.id, a.id), /distinct/);
  }));
