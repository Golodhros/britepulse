import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const flattenAssets = (assets) =>
  assets.flatMap((asset) => (asset.children ? flattenAssets(asset.children) : [asset]));

export async function verifyFixture(fixture) {
  const root = resolve('fixtures', fixture);
  const isVite = fixture === 'vite-react';
  const variants = {};
  for (const variant of ['baseline', 'candidate']) {
    const directory = resolve(root, '.artifacts', isVite ? variant : `webpack-${variant}`);
    const stats = await read(resolve(directory, isVite ? 'probe.json' : 'client-stats.json'));
    const assets = isVite ? stats.assets : flattenAssets(stats.assets);
    const filename = (asset) => (isVite ? asset.fileName : asset.name);
    const bytes = (asset) => (isVite ? asset.emittedBytes : asset.size);
    const jsBytes = assets
      .filter((a) => filename(a)?.endsWith('.js'))
      .reduce((sum, a) => sum + bytes(a), 0);
    const cssBytes = assets
      .filter((a) => filename(a)?.endsWith('.css'))
      .reduce((sum, a) => sum + bytes(a), 0);
    assert(jsBytes > 0 && cssBytes > 0, `${fixture}: JS and CSS must both be measured`);
    if (isVite) {
      const entry = assets.find((a) => a.isEntry);
      assert(entry?.dynamicImports.length, 'Vite dynamic import must remain visible');
      const manifest = await read(resolve(directory, '.vite/manifest.json'));
      assert(manifest['index.html'].css.length, 'Vite manifest must preserve initial CSS');
      const report = await read(resolve(directory, 'bundle-stats.json'));
      const initialCss = report.stats.find((s) => s.key === 'webpack.totalInitialSizeCSS')?.runs[0]
        .value;
      variants[variant] = { jsBytes, cssBytes, bundleStatsInitialCssBytes: initialCss };
    } else {
      assert(Object.keys(stats.entrypoints).length > 1, 'Webpack entrypoints must remain visible');
      if (fixture === 'next-pages') {
        const manifest = await read(resolve(directory, 'build-manifest.json'));
        assert(manifest.pages['/'] && manifest.pages['/other'] && manifest.pages['/_app']);
        assert(
          new Set([...manifest.pages['/'], ...manifest.pages['/_app']]).size <
            manifest.pages['/'].length + manifest.pages['/_app'].length,
          'Shared assets require deduplication',
        );
      }
      variants[variant] = { jsBytes, cssBytes };
    }
  }
  assert(
    variants.candidate.jsBytes - variants.baseline.jsBytes > 50_000,
    `${fixture}: candidate dependency must produce a measurable delta`,
  );
  const packageJson = await read(resolve(root, 'package.json'));
  const evidence = {
    fixture,
    runtime: process.version,
    dependencies: packageJson.dependencies,
    devDependencies: packageJson.devDependencies,
    variants,
  };
  await writeFile(
    resolve(root, '.artifacts/evidence.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    `${fixture}: verified baseline/candidate pair (+${variants.candidate.jsBytes - variants.baseline.jsBytes} emitted JS bytes)`,
  );

  return evidence;
}
