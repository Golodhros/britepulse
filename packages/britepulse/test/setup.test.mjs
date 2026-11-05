import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { initializeProject, detectProject, inspectProject, loadConfig } from '../dist/setup.js';
import { withTemporaryDirectory } from '../dist/orchestration.js';
const project = async (directory, dependencies) => {
  const root = join(directory, 'app');
  await mkdir(root);
  await writeFile(join(root, 'package.json'), JSON.stringify({ devDependencies: dependencies }));

  return root;
};
test('Vite and Next.js detection is explicit about ambiguous projects', async () =>
  withTemporaryDirectory(async (directory) => {
    const root = await project(directory, { vite: '8.3.5', next: '16.4.5' });
    assert.deepEqual((await detectProject(root)).adapters, ['vite', 'next-webpack']);
    await assert.rejects(
      initializeProject({
        appRoot: root,
        configPath: join(directory, 'config.json'),
        urls: ['http://localhost:3000/'],
      }),
      /Both Vite and Next/,
    );
  }));
test('setup preserves paths and creates valid defaults without requiring Webpack for Vite', async () =>
  withTemporaryDirectory(async (directory) => {
    const root = await project(directory, { vite: '8.3.5' });
    const configPath = join(directory, 'settings/config.json');
    await initializeProject({
      appRoot: root,
      configPath,
      urls: ['http://localhost:3000/'],
      runs: 5,
    });
    const config = await loadConfig(configPath);
    assert.equal(config.appRoot, root);
    assert.equal(config.bundle.adapter, 'vite');
    assert.equal(config.synthetic.runs, 5);
    await assert.rejects(
      initializeProject({ appRoot: root, configPath, urls: ['http://localhost:3000/'] }),
      /EEXIST/,
    );
    assert.equal((await loadConfig(configPath)).synthetic.runs, 5);
  }));
test('invalid setup inputs fail before creating configuration', async () =>
  withTemporaryDirectory(async (directory) => {
    const root = await project(directory, { vite: '8.3.5' });
    const configPath = join(directory, 'config.json');
    await assert.rejects(
      initializeProject({ appRoot: root, configPath, urls: ['file:///tmp/private'] }),
    );
    await assert.rejects(access(configPath));
  }));
test('concurrent initialization cannot overwrite settings', async () =>
  withTemporaryDirectory(async (directory) => {
    const root = await project(directory, { vite: '8.3.5' });
    const options = {
      appRoot: root,
      configPath: join(directory, 'config.json'),
      urls: ['http://localhost:3000/'],
    };
    const results = await Promise.allSettled([
      initializeProject({ ...options, runs: 3 }),
      initializeProject({ ...options, runs: 7 }),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert([3, 7].includes(JSON.parse(await readFile(options.configPath, 'utf8')).synthetic.runs));
  }));
test('doctor reports actual installed versions and missing authentication hooks without executing them', async () =>
  withTemporaryDirectory(async (directory) => {
    const root = await project(directory, { vite: '8.3.5' });
    await mkdir(join(root, 'node_modules/vite'), { recursive: true });
    await writeFile(
      join(root, 'node_modules/vite/package.json'),
      JSON.stringify({ version: '8.3.5' }),
    );
    const configPath = join(directory, 'config.json');
    await initializeProject({ appRoot: root, configPath, urls: ['http://localhost:3000/'] });
    let config = await loadConfig(configPath);
    assert.equal((await inspectProject(config)).ok, true);
    config = await loadConfig(configPath, { synthetic: { authHook: 'missing.mjs' } });
    const result = await inspectProject(config);
    assert.equal(result.ok, false);
    assert(result.checks.some((check) => check.name === 'auth-hook' && check.status === 'error'));
  }));

test('synthetic-only setup accepts Expo projects without claiming a Vite or Next adapter', async () =>
  withTemporaryDirectory(async (directory) => {
    const root = await project(directory, { expo: '58.0.14' });
    assert.deepEqual((await detectProject(root)).adapters, ['none']);
    const configPath = join(directory, 'synthetic.json');
    await initializeProject({
      appRoot: root,
      configPath,
      urls: ['https://example.test/'],
      adapter: 'none',
    });
    const settings = await loadConfig(configPath);
    assert.equal(settings.bundle.adapter, 'none');
    const checks = await inspectProject(settings);
    assert.equal(checks.checks.find((check) => check.name === 'framework').status, 'pass');
    assert.equal(checks.checks.find((check) => check.name === 'installed-tool').status, 'error');
  }));
