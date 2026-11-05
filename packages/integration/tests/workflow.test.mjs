import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, vite, json, success } from './helpers.mjs';
import { consumerPath } from '../scripts/paths.mjs';
const readJSON = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('installed Vite integration and CLI preserve a real baseline/candidate history', async (t) => {
  const directory = consumerPath('vite-react');
  for (const path of ['britepulse.config.json', '.britepulse', 'dist', 'invalid-artifact.json'])
    await rm(join(directory, path), { recursive: true, force: true });
  await t.test('initialize and inspect the real consumer without prompts', () => {
    const initialized = json(
      cli('vite-react', ['init', '--url', 'http://localhost:3000/', '--runs', '3', '--json']),
    );
    assert.equal(initialized.config.bundle.adapter, 'vite');
    assert.equal(cli('vite-react', ['init', '--url', 'http://localhost:3000/']).status, 2);
    const doctor = json(cli('vite-react', ['doctor', '--runs', '5', '--json']));
    assert.equal(doctor.ok, true);
    assert.equal(doctor.config.synthetic.runs, 5);
    assert(
      doctor.checks.some(
        (check) => check.name === 'installed-tool' && check.detail === 'vite 8.3.5',
      ),
    );
    assert.deepEqual(json(cli('vite-react', ['history', '--json'])), { runs: [], diagnostics: [] });
  });
  const snapshots = [];
  const manifests = [];
  for (const variant of ['baseline', 'candidate'])
    await t.test(`build and import ${variant} through installed public entrypoints`, async () => {
      success(vite([], { BRITEPULSE_VARIANT: variant }));
      const output = join(directory, 'dist', variant);
      const artifact = join(output, 'britepulse-bundle.json');
      const source = await readFile(artifact, 'utf8');
      const snapshot = JSON.parse(source);
      assert.equal(
        snapshot.completeness.status,
        'complete',
        snapshot.completeness.diagnostics.join('; '),
      );
      assert.equal(snapshot.target, 'client');
      assert.equal(snapshot.toolVersions.vite, '8.3.5');
      const entry = snapshot.entrypoints['index.html'];
      assert(entry.initial.some((id) => id.endsWith('.css')));
      assert(entry.asynchronous.some((id) => id.endsWith('.css')));
      assert(entry.asynchronous.some((id) => id.endsWith('.js')));
      assert.equal(
        new Set([...entry.initial, ...entry.asynchronous]).size,
        entry.initial.length + entry.asynchronous.length,
      );
      for (const asset of snapshot.assets) {
        assert.equal(asset.sizes.emittedBytes, (await stat(join(output, asset.id))).size);
        assert(asset.sizes.gzipBytes > 0);
        assert(asset.sizes.brotliBytes > 0);
        assert.equal(asset.sizes.transferBytes, null);
      }
      const manifest = json(
        cli('vite-react', [
          'analyze',
          '--artifact',
          artifact,
          '--label',
          'same-release-label',
          '--json',
        ]),
      );
      assert.equal(manifest.status, 'complete');
      assert.equal(manifest.identity.build, snapshot.runId);
      const runDirectory = join(directory, '.britepulse/runs', manifest.id);
      assert.equal(await readFile(join(runDirectory, 'original/bundle.json'), 'utf8'), source);
      const normalized = await readJSON(join(runDirectory, 'normalized/bundle.json'));
      assert.deepEqual(normalized, { ...snapshot, runId: manifest.id });
      snapshots.push(snapshot);
      manifests.push(manifest);
    });
  await t.test('candidate growth is visible and labels cannot overwrite history', () => {
    assert.equal(snapshots.length, 2);
    const jsBytes = (snapshot) =>
      snapshot.assets
        .filter((asset) => asset.kind === 'js')
        .reduce((sum, asset) => sum + asset.sizes.emittedBytes, 0);
    assert(
      jsBytes(snapshots[1]) - jsBytes(snapshots[0]) > 50_000,
      'Added lodash dependency must produce a meaningful emitted JS delta',
    );
    const history = json(cli('vite-react', ['history', '--json']));
    assert.equal(history.runs.length, 2);
    assert.deepEqual(
      new Set(history.runs.map((run) => run.id)),
      new Set(manifests.map((run) => run.id)),
    );
    assert.notEqual(manifests[0].id, manifests[1].id);
    assert(history.runs.every((run) => run.label === 'same-release-label'));
  });
  await t.test('compare and report use the installed package and real bundle changes', async () => {
    const comparison = json(
      cli('vite-react', ['compare', '--baseline', manifests[0].id, '--candidate', manifests[1].id]),
    );
    assert.equal(comparison.compatible, true);
    const key = JSON.stringify(['bundle', 'All exported assets', 'JS emittedBytes']);
    assert(comparison.metrics[key].absolute > 50_000);
    const exported = json(
      cli('vite-react', [
        'report',
        '--comparison',
        comparison.id,
        '--output',
        'comparison-report.html',
      ]),
    );
    const html = await readFile(exported.path, 'utf8');
    const embedded = JSON.parse(
      html.match(
        /<script id="britepulse-report-data" type="application\/json">(.*?)<\/script>/s,
      )[1],
    );
    assert.equal(embedded.comparison.id, comparison.id);
    assert.equal(embedded.comparison.metrics[key].absolute, comparison.metrics[key].absolute);
    assert(embedded.rows.length > 0);
    assert.equal(
      cli('vite-react', [
        'report',
        '--comparison',
        comparison.id,
        '--output',
        'comparison-report.html',
      ]).status,
      2,
    );
  });
  await t.test('invalid artifacts fail before creating misleading history entries', async () => {
    const invalid = { ...snapshots[0], schemaVersion: 999 };
    await writeFile(join(directory, 'invalid-artifact.json'), JSON.stringify(invalid));
    const result = cli('vite-react', ['analyze', '--artifact', 'invalid-artifact.json']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /schemaVersion/);
    assert.equal(json(cli('vite-react', ['history', '--json'])).runs.length, 2);
  });
  await t.test(
    'SSR builds require explicit selection and cannot masquerade as client artifacts',
    async () => {
      success(vite(['--ssr', 'src/server.ts', '--outDir', 'dist/ssr']));
      const artifact = join(directory, 'dist/ssr/britepulse-bundle.json');
      const snapshot = await readJSON(artifact);
      assert.equal(snapshot.target, 'ssr');
      const rejected = cli('vite-react', ['analyze', '--artifact', artifact]);
      assert.equal(rejected.status, 2);
      assert.match(rejected.stderr, /select --target ssr/);
      assert.equal(json(cli('vite-react', ['history', '--json'])).runs.length, 2);
      const imported = json(
        cli('vite-react', [
          'analyze',
          '--artifact',
          artifact,
          '--target',
          'ssr',
          '--label',
          'server-build',
        ]),
      );
      const normalized = await readJSON(
        join(directory, '.britepulse/runs', imported.id, 'normalized/bundle.json'),
      );
      assert.equal(normalized.target, 'ssr');
      assert.equal(json(cli('vite-react', ['history', '--json'])).runs.length, 3);
    },
  );
});
