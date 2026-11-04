import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig, loadConfig } from '../dist/config.js';
const project = { schemaVersion: 1, environments: { local: { urls: ['http://localhost:3000/'] } } };
test('flags override individual settings while preserving project siblings and defaults', () => {
  const config = resolveConfig(
    { ...project, synthetic: { runs: 7, retries: 4 }, bundle: { adapter: 'next-webpack' } },
    { synthetic: { runs: 5 } },
    '/project/britepulse.config.json',
  );
  assert.equal(config.synthetic.runs, 5);
  assert.equal(config.synthetic.retries, 4);
  assert.equal(config.synthetic.warmups, 0);
  assert.equal(config.bundle.adapter, 'next-webpack');
  assert.equal(config.outputDir, '/project/.britepulse');
});
test('rejects invalid settings, unsupported versions and unknown keys', () => {
  for (const patch of [
    { schemaVersion: 0 },
    { synthetic: { runs: 0 } },
    { synthetic: { runs: 1.5 } },
    { synthetic: { timeoutMs: 0 } },
    { synthetic: { retries: -1 } },
    { synthetic: { retry: 2 } },
    { environments: { local: { urls: ['file:///tmp/test'] } } },
    { outputDir: '' },
    { bundle: { buildCommand: [] } },
  ]) {
    assert.throws(() => resolveConfig({ ...project, ...patch }), /Invalid project configuration/);
  }
  assert.throws(() => resolveConfig(project, { environment: 'missing' }), /Selected environment/);
  assert.throws(
    () => resolveConfig({ schemaVersion: 1, environment: 'toString', environments: {} }),
    /Selected environment/,
  );
  assert.throws(
    () => resolveConfig(project, { synthetic: { runs: '3' } }),
    /Invalid configuration overrides/,
  );
});
test('config paths resolve from the file location; app output paths resolve from application root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'britepulse-config-'));
  try {
    const path = join(directory, 'config.json');
    await writeFile(
      path,
      JSON.stringify({
        ...project,
        appRoot: 'app',
        synthetic: { authHook: './auth.mjs' },
        bundle: { statsFile: 'stats.json' },
      }),
    );
    const config = await loadConfig(path);
    assert.equal(config.appRoot, join(directory, 'app'));
    assert.equal(config.outputDir, join(directory, 'app/.britepulse'));
    assert.equal(config.synthetic.authHook, join(directory, 'auth.mjs'));
    assert.equal(config.bundle.statsFile, join(directory, 'app/stats.json'));
    await writeFile(path, '{broken');
    await assert.rejects(loadConfig(path), /Cannot read configuration/);
    await assert.rejects(loadConfig(join(directory, 'missing.json')), /Cannot read configuration/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('fingerprints ignore storage location, checkout root and object key order', () => {
  const first = resolveConfig(project, {}, '/one/config.json');
  const second = resolveConfig(
    { environments: project.environments, schemaVersion: 1, outputDir: '/history' },
    {},
    '/two/config.json',
  );
  assert.equal(first.fingerprint, second.fingerprint);
  assert.notEqual(
    first.fingerprint,
    resolveConfig(project, { synthetic: { runs: 5 } }).fingerprint,
  );
});
