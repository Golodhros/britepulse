import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  normalizeNextPagesBundle,
  importNextPagesBundle,
  resolveConfig,
  withTemporaryDirectory,
  RunStore,
} from '../dist/index.js';

const stats = {
  name: 'client',
  version: '5.98.0',
  assets: [
    { name: 'runtime.js', size: 10 },
    { name: 'shared.css', size: 20 },
    { name: 'home.js', size: 30 },
    { name: 'product.js', size: 40 },
    { name: 'lazy.js', size: 50 },
  ],
};
const manifest = {
  polyfillFiles: ['polyfill.js'],
  lowPriorityFiles: ['build.js'],
  pages: {
    '/_app': ['runtime.js', 'shared.css'],
    '/': ['runtime.js', 'home.js'],
    '/product/[id]': ['runtime.js', 'product.js'],
  },
};
const metadata = () => ({ runId: randomUUID(), nextVersion: '16.4.5' });

test('maps Pages route templates to deduplicated shared and page assets without guessing asynchronous attribution', () => {
  const snapshot = normalizeNextPagesBundle(stats, manifest, metadata());
  assert.deepEqual(snapshot.entrypoints['/'].initial, [
    'home.js',
    'polyfill.js',
    'runtime.js',
    'shared.css',
  ]);
  assert(!snapshot.entrypoints['/'].initial.includes('product.js'));
  assert(snapshot.entrypoints['/product/[id]'].initial.includes('product.js'));
  assert.deepEqual(snapshot.entrypoints['/'].asynchronous, []);
  assert.equal(snapshot.assets.find((asset) => asset.id === 'lazy.js').sizes.emittedBytes, 50);
  assert.equal(
    snapshot.assets.find((asset) => asset.id === 'polyfill.js').sizes.emittedBytes,
    null,
  );
  assert.equal(snapshot.assets.find((asset) => asset.id === 'build.js').sizes.emittedBytes, null);
  assert.equal(snapshot.capabilities.routes, 'partial');
  assert.equal(snapshot.capabilities.modules, 'unavailable');
  assert.equal(snapshot.completeness.status, 'partial');
});

test('rejects unsupported versions, SSR/mixed-router inputs, unsafe paths and duplicate assets', () => {
  for (const input of [
    { ...stats, name: 'server' },
    { ...stats, version: '6.0.0' },
    { ...stats, assets: [...stats.assets, stats.assets[0]] },
    { ...stats, assets: [{ name: '../unsafe', size: 1 }] },
  ])
    assert.throws(() => normalizeNextPagesBundle(input, manifest, metadata()));
  assert.throws(
    () => normalizeNextPagesBundle(stats, { ...manifest, rootMainFiles: ['app.js'] }, metadata()),
    /App Router/,
  );
  assert.throws(() =>
    normalizeNextPagesBundle(stats, manifest, { ...metadata(), nextVersion: '17.0.0' }),
  );
});

async function fixture(directory) {
  await mkdir(join(directory, 'diagnostics'), { recursive: true });
  await writeFile(join(directory, 'client-stats.json'), JSON.stringify(stats));
  await writeFile(join(directory, 'build-manifest.json'), JSON.stringify(manifest));
  await writeFile(
    join(directory, 'diagnostics/framework.json'),
    JSON.stringify({ name: 'Next.js', version: '16.4.5' }),
  );
  await writeFile(join(directory, 'BUILD_ID'), 'fixture-build\n');
}

function config(directory) {
  return resolveConfig({
    schemaVersion: 1,
    appRoot: directory,
    bundle: { adapter: 'next-webpack' },
    environments: { local: { urls: ['https://example.test/'] } },
  });
}

test('imports original artifacts and source identity into distinct partial local runs', async () =>
  withTemporaryDirectory(async (directory) => {
    await fixture(directory);
    const settings = config(directory);
    const first = await importNextPagesBundle(settings, directory, 'baseline');
    const second = await importNextPagesBundle(settings, directory, 'baseline');
    assert.notEqual(first.id, second.id);
    assert.equal(first.identity.build, 'fixture-build');
    assert.equal(first.framework, 'nextjs');
    assert.equal(first.status, 'partial');
    const run = join(settings.outputDir, 'runs', first.id);
    assert.deepEqual(
      JSON.parse(await readFile(join(run, 'original/client-stats.json'), 'utf8')),
      stats,
    );
    assert.equal(
      JSON.parse(await readFile(join(run, 'normalized/bundle.json'), 'utf8')).runId,
      first.id,
    );
  }));

test('rejects App Router builds and malformed inputs before creating history', async () =>
  withTemporaryDirectory(async (directory) => {
    await fixture(directory);
    const settings = config(directory);
    await writeFile(join(directory, 'client-stats.json'), '{invalid');
    await assert.rejects(importNextPagesBundle(settings, directory, 'bad'));
    await fixture(directory);
    await mkdir(join(directory, 'server'));
    await writeFile(
      join(directory, 'server/app-paths-manifest.json'),
      JSON.stringify({ '/page': 'app/page.js' }),
    );
    await assert.rejects(importNextPagesBundle(settings, directory, 'app'), /App Router/);
    assert.deepEqual((await new RunStore(settings.outputDir).discover()).runs, []);
  }));
