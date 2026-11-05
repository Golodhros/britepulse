import assert from 'node:assert/strict';
import { readFile, stat, mkdir, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { run } from './lib/run.mjs';
await run(process.execPath, ['scripts/compatibility.mjs', 'next-pages'], { timeout: 300_000 });
await run('pnpm', ['--filter', 'britepulse', 'run', 'build']);
const { importNextPagesBundle, resolveConfig } =
  await import('../packages/britepulse/dist/index.js');
const root = resolve('fixtures/next-pages');
await mkdir(join(root, '.artifacts'), { recursive: true });
const output = await mkdtemp(join(root, '.artifacts/import-'));
const config = resolveConfig({
  schemaVersion: 1,
  appRoot: root,
  outputDir: output,
  bundle: { adapter: 'next-webpack' },
  environments: { local: { urls: ['https://example.test/'] } },
});
const totals = [];
for (const variant of ['baseline', 'candidate']) {
  const directory = join(root, '.artifacts', `webpack-${variant}`);
  const manifest = await importNextPagesBundle(config, directory, variant);
  const snapshot = JSON.parse(
    await readFile(join(output, 'runs', manifest.id, 'normalized/bundle.json'), 'utf8'),
  );
  assert.equal(manifest.status, 'partial');
  assert(snapshot.entrypoints['/'].initial.some((id) => id.endsWith('.css')));
  assert(snapshot.entrypoints['/other']);
  for (const entry of Object.values(snapshot.entrypoints))
    assert.equal(new Set(entry.initial).size, entry.initial.length);
  let total = 0;
  for (const asset of snapshot.assets) {
    if (asset.sizes.emittedBytes === null) continue;
    assert.equal((await stat(join(directory, asset.id))).size, asset.sizes.emittedBytes);
    if (asset.kind === 'js') total += asset.sizes.emittedBytes;
  }
  totals.push(total);
}
assert(totals[1] - totals[0] > 50_000, 'Known candidate dependency growth must survive import');
console.log(
  `Pages import verified against real builds: +${totals[1] - totals[0]} emitted JS bytes; async attribution remains unavailable`,
);
