import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  RunStore,
  withTemporaryDirectory,
  compareRuns,
  evaluateBudgets,
  budgetFileSchema,
} from '../dist/index.js';
import { bundleRun, syntheticRun } from './helpers/comparison.mjs';

const bundleRule = {
  group: 'bundle',
  subject: 'All exported assets',
  metric: 'JS emittedBytes',
  unit: 'bytes',
  limit: 150,
};
const file = (...budgets) => ({ schemaVersion: 1, budgets });

async function reportFor(directory, baseline, candidate, options = {}) {
  const store = new RunStore(join(directory, 'history'));
  const create = options.synthetic ? syntheticRun : bundleRun;
  const a = await create(store, baseline, options.baseline);
  const b = await create(store, candidate, options.candidate);
  const comparison = await compareRuns(store, a.id, b.id);

  return store.readComparisonReport(comparison.id);
}

test('absolute ceilings and percentage regression limits use unrounded values and include equality', async () =>
  withTemporaryDirectory(async (directory) => {
    const report = await reportFor(directory, 100, 150);
    assert.equal(evaluateBudgets(report, file(bundleRule)).status, 'pass');
    assert.equal(evaluateBudgets(report, file({ ...bundleRule, limit: 149 })).status, 'fail');
    const percent = { ...bundleRule, mode: 'regression-percent', limit: 50 };
    assert.equal(evaluateBudgets(report, file(percent)).results[0].result.observed, 50);
    assert.equal(evaluateBudgets(report, file({ ...percent, limit: 49.999 })).status, 'fail');
    assert.equal(evaluateBudgets(report, file(percent)).status, 'pass');
  }));

test('higher-is-better score floors and regressions preserve the fractional scale', async () =>
  withTemporaryDirectory(async (directory) => {
    const report = await reportFor(directory, 0.8, 0.6, {
      synthetic: true,
      baseline: { score: true },
      candidate: { score: true },
    });
    const rule = {
      group: 'synthetic',
      subject: 'https://example.test/',
      metric: 'performance-score',
      unit: 'score',
      limit: 0.6,
    };
    assert.equal(evaluateBudgets(report, file(rule)).status, 'pass');
    assert.equal(evaluateBudgets(report, file({ ...rule, limit: 0.7 })).status, 'fail');
    const result = evaluateBudgets(report, file({ ...rule, mode: 'regression-percent', limit: 24 }))
      .results[0].result;
    assert.equal(result.status, 'fail');
    assert(Math.abs(result.observed - 25) < 1e-10);
  }));

test('improvements consume no regression allowance and zero baselines cannot pass percentage budgets', async () =>
  withTemporaryDirectory(async (directory) => {
    const improved = await reportFor(directory, 150, 100);
    const percent = { ...bundleRule, mode: 'regression-percent', limit: 0 };
    assert.equal(evaluateBudgets(improved, file(percent)).results[0].result.observed, 0);
    const zero = await reportFor(join(directory, 'zero'), 0, 10);
    assert.equal(evaluateBudgets(zero, file(bundleRule)).status, 'pass');
    assert.equal(evaluateBudgets(zero, file(percent)).status, 'error');
  }));

test('absolute regression limits use source units, clamp improvements and accept zero baselines', async () =>
  withTemporaryDirectory(async (directory) => {
    const delta = { ...bundleRule, mode: 'regression-absolute', limit: 50 };
    const grown = await reportFor(directory, 100, 150);
    const result = evaluateBudgets(grown, file(delta)).results[0].result;
    assert.deepEqual([result.status, result.observed, result.unit], ['pass', 50, 'bytes']);
    assert.equal(evaluateBudgets(grown, file({ ...delta, limit: 49 })).status, 'fail');
    const improved = await reportFor(join(directory, 'improved'), 150, 100);
    assert.equal(
      evaluateBudgets(improved, file({ ...delta, limit: 0 })).results[0].result.observed,
      0,
    );
    const zero = await reportFor(join(directory, 'zero'), 0, 10);
    assert.equal(evaluateBudgets(zero, file({ ...delta, limit: 10 })).status, 'pass');
  }));

test('higher-is-better absolute regressions reverse the score direction', async () =>
  withTemporaryDirectory(async (directory) => {
    const report = await reportFor(directory, 0.8, 0.6, {
      synthetic: true,
      baseline: { score: true },
      candidate: { score: true },
    });
    const rule = {
      group: 'synthetic',
      subject: 'https://example.test/',
      metric: 'performance-score',
      unit: 'score',
      mode: 'regression-absolute',
      limit: 0.1,
    };
    const result = evaluateBudgets(report, file(rule)).results[0].result;
    assert.equal(result.status, 'fail');
    assert(Math.abs(result.observed - 0.2) < 1e-10);
    assert.equal(evaluateBudgets(report, file({ ...rule, limit: 0.25 })).status, 'pass');
  }));

test('percentage regressions within minimumChange pass with an explanation', async () =>
  withTemporaryDirectory(async (directory) => {
    const report = await reportFor(directory, 100, 150);
    const percent = { ...bundleRule, mode: 'regression-percent', limit: 10 };
    assert.equal(evaluateBudgets(report, file(percent)).status, 'fail');
    const floored = evaluateBudgets(report, file({ ...percent, minimumChange: 50 })).results[0]
      .result;
    assert.equal(floored.status, 'pass');
    assert.equal(floored.observed, 50);
    assert.match(floored.reason, /minimumChange/);
    assert.equal(evaluateBudgets(report, file({ ...percent, minimumChange: 49 })).status, 'fail');
    const zero = await reportFor(join(directory, 'zero'), 0, 10);
    assert.equal(evaluateBudgets(zero, file({ ...percent, minimumChange: 100 })).status, 'error');
  }));

test('partial, incompatible, unknown, unmatched and wrong-unit measurements cannot pass', async () =>
  withTemporaryDirectory(async (directory) => {
    for (const [index, options, baseline] of [
      [0, { candidate: { status: 'partial' } }, 100],
      [1, { candidate: { metadata: { configFingerprint: 'b'.repeat(64) } } }, 100],
      [2, {}, null],
    ]) {
      const report = await reportFor(join(directory, String(index)), baseline, 150, options);
      const evaluation = evaluateBudgets(report, file(bundleRule));
      assert.equal(evaluation.status, 'error');
      assert.equal(evaluation.results[0].result.observed, null);
    }
    const report = await reportFor(join(directory, 'valid'), 100, 150);
    assert.equal(evaluateBudgets(report, file({ ...bundleRule, unit: 'ms' })).status, 'error');
    assert.equal(
      evaluateBudgets(report, file({ ...bundleRule, metric: 'absent' })).status,
      'error',
    );
    assert.equal(
      evaluateBudgets(
        report,
        file({ ...bundleRule, limit: 1 }, { ...bundleRule, metric: 'absent' }),
      ).status,
      'error',
    );
  }));

test('synthetic budgets require three valid samples on each side', async () =>
  withTemporaryDirectory(async (directory) => {
    const report = await reportFor(directory, 100, 150, {
      synthetic: true,
      baseline: { samples: 2 },
    });
    const rule = {
      group: 'synthetic',
      subject: 'https://example.test/',
      metric: 'largest-contentful-paint',
      unit: 'ms',
      limit: 200,
    };
    const result = evaluateBudgets(report, file(rule));
    assert.equal(result.status, 'error');
    assert.match(result.results[0].result.reason, /three valid samples/);
  }));

test('budget files reject empty, duplicate, negative, out-of-scale and misplaced floor rules', () => {
  for (const input of [
    file(),
    file(bundleRule, bundleRule),
    file({ ...bundleRule, limit: -1 }),
    file({ ...bundleRule, unit: 'score', limit: 2 }),
    file({ ...bundleRule, unit: 'score', mode: 'regression-absolute', limit: 2 }),
    file({ ...bundleRule, minimumChange: 1 }),
    file({ ...bundleRule, mode: 'regression-absolute', minimumChange: 1 }),
    file({ ...bundleRule, unit: 'score', mode: 'regression-percent', minimumChange: 2 }),
    file({ ...bundleRule, mode: 'regression-percent', minimumChange: -1 }),
  ])
    assert.equal(budgetFileSchema.safeParse(input).success, false);
});

test('report selectors and sample metadata cannot disagree with comparison measurements', async () =>
  withTemporaryDirectory(async (directory) => {
    const report = await reportFor(directory, 100, 150, { synthetic: true });
    const rule = {
      group: 'synthetic',
      subject: 'https://example.test/',
      metric: 'largest-contentful-paint',
      unit: 'ms',
      limit: 200,
    };
    const renamed = structuredClone(report);
    renamed.rows[0].label = 'different';
    assert.throws(() => evaluateBudgets(renamed, file(rule)), /selector/);
    const changed = structuredClone(report);
    changed.rows[0].candidateSamples.median = 1;
    assert.throws(() => evaluateBudgets(changed, file(rule)), /Sample metadata/);
  }));
