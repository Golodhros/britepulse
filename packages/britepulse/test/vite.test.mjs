import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';
import { britepulse } from '../dist/vite.js';
import { withTemporaryDirectory } from '../dist/orchestration.js';
import { parseBundleSnapshot } from '../dist/contracts.js';
import { resolveBundleGraph } from '../dist/bundle-graph.js';
import { importBundle } from '../dist/analyze.js';
import { resolveConfig } from '../dist/config.js';
import { RunStore } from '../dist/store.js';
const id = '48d36f03-5dfc-4b2a-80e9-d3f52efa4c27';
const sizes = {
  emittedBytes: 10,
  parsedBytes: null,
  gzipBytes: null,
  brotliBytes: null,
  transferBytes: null,
};
const asset = (id, imports = [], dynamicImports = []) => ({
  id,
  imports,
  dynamicImports,
  kind: 'js',
  sizes,
  modules: [],
});
const metadata = {
  runId: id,
  target: 'client',
  toolVersions: { vite: '8.3.5' },
  compression: null,
};
test('graph closure handles shared chunks, cycles and static/async overlap', () => {
  const graph = [
    asset('main.js', ['shared.js'], ['lazy.js']),
    asset('other.js', ['shared.js']),
    asset('shared.js', ['main.js']),
    asset('lazy.js', ['shared.js']),
  ];
  const snapshot = resolveBundleGraph(graph, { main: 'main.js', other: 'other.js' }, metadata);
  assert.deepEqual(snapshot.entrypoints.main.initial, ['main.js', 'shared.js']);
  assert.deepEqual(snapshot.entrypoints.main.asynchronous, ['lazy.js']);
  assert.equal(snapshot.entrypoints.other.initial.filter((id) => id === 'shared.js').length, 1);
});
test('unresolved emitted references remain explicit unknowns', () => {
  const snapshot = resolveBundleGraph(
    [asset('main.js', ['missing.js', 'missing.mjs'])],
    { main: 'main.js' },
    metadata,
  );
  assert.equal(snapshot.assets.find((asset) => asset.id === 'missing.js').sizes.emittedBytes, null);
  assert.equal(snapshot.assets.find((asset) => asset.id === 'missing.mjs').kind, 'js');
  assert.equal(snapshot.completeness.status, 'partial');
});

async function fixture(directory) {
  await writeFile(
    join(directory, 'index.html'),
    '<html><body><script type="module" src="/main.js"></script></body></html>',
  );
  await writeFile(
    join(directory, 'other.html'),
    '<html><body><script type="module" src="/other.js"></script></body></html>',
  );
  await writeFile(join(directory, 'shared.js'), 'export const shared = "shared dependency";');
  await writeFile(
    join(directory, 'main.js'),
    'import {shared} from "./shared.js";import "./style.css";console.log(shared);import("./lazy.js").then(module=>console.log(module.value));',
  );
  await writeFile(
    join(directory, 'other.js'),
    'import {shared} from "./shared.js";console.log(shared);',
  );
  await writeFile(join(directory, 'style.css'), 'body { color: #123456; }');
  await writeFile(join(directory, 'lazy.css'), '.lazy { padding: 5px; }');
  await writeFile(
    join(directory, 'lazy.js'),
    'import "./lazy.css";import {shared} from "./shared.js";export const value=shared+"baseline";',
  );
}

test('production builds preserve multiple entries, dynamic CSS, exact bytes, compression and history imports', async () =>
  withTemporaryDirectory(async (directory) => {
    await fixture(directory);
    const snapshots = [];
    for (const variant of ['baseline', 'candidate']) {
      if (variant === 'candidate')
        await writeFile(
          join(directory, 'lazy.js'),
          `import "./lazy.css";import {shared} from "./shared.js";export const value=shared+${JSON.stringify('candidate payload '.repeat(3000))};`,
        );
      const output = join(directory, 'custom-output', variant);
      await build({
        root: directory,
        configFile: false,
        logLevel: 'silent',
        plugins: [britepulse({ compression: true })],
        build: {
          outDir: output,
          rolldownOptions: {
            input: { main: join(directory, 'index.html'), other: join(directory, 'other.html') },
          },
        },
      });
      const artifact = join(output, 'britepulse-bundle.json');
      const snapshot = parseBundleSnapshot(JSON.parse(await readFile(artifact, 'utf8')));
      assert.equal(Object.keys(snapshot.entrypoints).length, 2);
      assert.equal(
        snapshot.completeness.status,
        'complete',
        snapshot.completeness.diagnostics.join(';'),
      );
      const main = snapshot.entrypoints['index.html'];
      assert(main.initial.some((id) => id.endsWith('.css')));
      assert(main.asynchronous.some((id) => id.endsWith('.css')));
      assert(main.asynchronous.some((id) => id.endsWith('.js')));
      assert.equal(main.initial.filter((id) => main.asynchronous.includes(id)).length, 0);
      for (const asset of snapshot.assets) {
        assert.equal(asset.sizes.emittedBytes, (await stat(join(output, asset.id))).size);
        assert.notEqual(asset.sizes.gzipBytes, null);
        assert.equal(asset.sizes.transferBytes, null);
      }
      const config = resolveConfig({
        schemaVersion: 1,
        appRoot: directory,
        environments: { local: { urls: ['http://localhost:3000/'] } },
      });
      const run = await importBundle(config, artifact, 'same-label');
      assert.equal(run.status, 'complete');
      assert.equal(run.identity.build, snapshot.runId);
      const normalized = JSON.parse(
        await readFile(join(config.outputDir, 'runs', run.id, 'normalized/bundle.json'), 'utf8'),
      );
      assert.equal(normalized.runId, run.id);
      assert.equal(normalized.target, 'client');
      snapshots.push(snapshot);
    }
    const js = (snapshot) =>
      snapshot.assets
        .filter((asset) => asset.kind === 'js')
        .reduce((sum, asset) => sum + asset.sizes.emittedBytes, 0);
    assert(js(snapshots[1]) - js(snapshots[0]) > 40_000);
    const history = await new RunStore(join(directory, '.britepulse')).discover();
    assert.equal(history.runs.length, 2);
    assert.notEqual(history.runs[0].id, history.runs[1].id);
  }));
test('SSR targets remain separate and require explicit selection during import', async () =>
  withTemporaryDirectory(async (directory) => {
    await writeFile(
      join(directory, 'server.js'),
      'import {readFile} from "node:fs/promises";export const loader = readFile;',
    );
    const output = join(directory, 'ssr');
    await build({
      root: directory,
      configFile: false,
      logLevel: 'silent',
      plugins: [britepulse()],
      build: { ssr: join(directory, 'server.js'), outDir: output },
    });
    const artifact = join(output, 'britepulse-bundle.json');
    const snapshot = parseBundleSnapshot(JSON.parse(await readFile(artifact, 'utf8')));
    assert.equal(snapshot.target, 'ssr');
    assert.equal(snapshot.completeness.status, 'partial');
    const config = resolveConfig({
      schemaVersion: 1,
      appRoot: directory,
      environments: { local: { urls: ['http://localhost:3000/'] } },
    });
    await assert.rejects(importBundle(config, artifact, 'SSR'), /select --target ssr/);
    const run = await importBundle(config, artifact, 'SSR', 'ssr');
    assert.equal(run.status, 'partial');
  }));
test('disabled manifests produce diagnostics and metadata collisions fail builds', async () =>
  withTemporaryDirectory(async (directory) => {
    await fixture(directory);
    const output = join(directory, 'disabled');
    await build({
      root: directory,
      configFile: false,
      logLevel: 'silent',
      plugins: [britepulse()],
      build: { manifest: false, outDir: output },
    });
    const snapshot = parseBundleSnapshot(
      JSON.parse(await readFile(join(output, 'britepulse-bundle.json'), 'utf8')),
    );
    assert.equal(snapshot.completeness.status, 'partial');
    await assert.rejects(
      build({
        root: directory,
        configFile: false,
        logLevel: 'silent',
        plugins: [britepulse({ fileName: 'manifest.json' })],
        build: { manifest: 'manifest.json', outDir: join(directory, 'collision') },
      }),
      /collides/,
    );
    assert.throws(() => britepulse({ fileName: '../outside.json' }), /artifact filename/);
  }));
