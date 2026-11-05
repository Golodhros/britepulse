import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  betaReleasePlan,
  verifyReleaseReceipt,
  classifyRegistryResult,
} from '../lib/release-policy.mjs';
const manifest = {
  name: 'britepulse',
  version: '0.1.0-beta.0',
  publishConfig: { access: 'public', tag: 'beta', registry: 'https://registry.npmjs.org/' },
  repository: { url: 'https://github.com/Golodhros/britepulse.git' },
};
const pre = { mode: 'pre', tag: 'beta' };
const checks = [
  'lint',
  'typecheck',
  'test',
  'test:release',
  'format:check',
  'test:integration',
  'test:next-pages',
];

test('beta plan refuses stable versions, private packages and latest tags', () => {
  assert.equal(betaReleasePlan(manifest, pre).tag, 'beta');
  for (const override of [
    { version: '0.1.0' },
    { private: true },
    { name: '@britepulse/report' },
    { publishConfig: { ...manifest.publishConfig, tag: 'latest' } },
  ])
    assert.throws(() => betaReleasePlan({ ...manifest, ...override }, pre));
  assert.throws(() => betaReleasePlan(manifest, { ...pre, mode: 'exit' }));
});

test('receipt refuses changed tarballs, versions, source commits and missing checks', () => {
  const plan = betaReleasePlan(manifest, pre);
  const receipt = {
    schemaVersion: 1,
    sourceDirty: false,
    ...plan,
    integrity: 'sha512-verified',
    gitHead: 'commit',
    checks,
  };
  verifyReleaseReceipt(plan, receipt, 'sha512-verified', 'commit');
  assert.throws(() =>
    verifyReleaseReceipt(
      plan,
      { ...receipt, sourceDirty: true },
      'sha512-verified',
      'commit',
      true,
    ),
  );
  for (const override of [
    { integrity: 'sha512-other' },
    { version: '0.1.0-beta.1' },
    { gitHead: 'other' },
    { filename: '../other.tgz' },
    { checks: [] },
  ])
    assert.throws(() =>
      verifyReleaseReceipt(plan, { ...receipt, ...override }, 'sha512-verified', 'commit'),
    );
});

test('registry recovery skips only identical artifacts and fails closed on non-404 errors', () => {
  assert.equal(
    classifyRegistryResult({ status: 0, stdout: JSON.stringify('sha512-same') }, 'sha512-same'),
    'already-published',
  );
  assert.equal(
    classifyRegistryResult(
      { status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) },
      'sha512-same',
    ),
    'unpublished',
  );
  assert.throws(() =>
    classifyRegistryResult({ status: 0, stdout: JSON.stringify('different') }, 'sha512-same'),
  );
  for (const stdout of [
    '',
    '{invalid',
    JSON.stringify({ error: { code: 'E401' } }),
    JSON.stringify({ error: { code: 'E500' } }),
  ])
    assert.throws(() => classifyRegistryResult({ status: 1, stdout }, 'sha512-same'));
});
