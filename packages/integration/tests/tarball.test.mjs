import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { cli, command, success } from './helpers.mjs';
import { consumerPath, consumerNames } from '../scripts/paths.mjs';

test('consumers contain an extracted tarball instead of a workspace package link', async () => {
  for (const name of consumerNames) {
    const directory = await realpath(consumerPath(name));
    const installed = await realpath(join(directory, 'node_modules/britepulse'));
    const path = relative(directory, installed);
    assert(
      !path.startsWith('..') && !isAbsolute(path),
      `${name} resolves outside its isolated consumer: ${installed}`,
    );
    const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
    for (const entry of Object.values(manifest.exports))
      for (const target of [entry.types, entry.import]) await access(join(installed, target));
    assert.equal(manifest.peerDependenciesMeta.vite.optional, true);
    for (const dependency of [
      'react',
      'react-dom',
      '@britecharts/react',
      'vite',
      'lighthouse',
      '@lhci/cli',
    ])
      assert(!Object.hasOwn(manifest.dependencies, dependency));
    const files = await readdir(installed);
    for (const excluded of ['src', 'test', 'fixtures', '.britepulse', '.artifacts'])
      assert(!files.includes(excluded));
    await access(join(installed, 'LICENSE'));
    await access(join(installed, 'README.md'));
    const html = await readFile(join(installed, 'dist/report/index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)].map(
      (match) => match[1],
    );
    assert(assets.some((path) => path.endsWith('.js')));
    assert(assets.some((path) => path.endsWith('.css')));
    for (const asset of assets) await access(join(installed, 'dist/report', asset));
  }
});
test('installed CLI works without Vite, React or browser tooling in the consumer', async () => {
  const directory = consumerPath('cli');
  for (const dependency of ['vite', 'react', 'lighthouse'])
    await assert.rejects(access(join(directory, 'node_modules', dependency)));
  const manifest = JSON.parse(
    await readFile(join(directory, 'node_modules/britepulse/package.json'), 'utf8'),
  );
  assert.equal(success(cli('cli', ['--version'])).trim(), manifest.version);
  assert.match(success(cli('cli', ['--help'])), /analyze/);
  assert.equal(cli('cli', []).status, 2);
  assert.equal(cli('cli', ['unknown-command']).status, 2);
});
test('CLI startup and root/config exports do not load UI or optional integration dependencies', async () => {
  const directory = consumerPath('cli');
  const loader = join(directory, 'block-optional-dependencies.mjs');
  await writeFile(
    loader,
    `const blocked = ['react', 'react-dom', 'vite', 'lighthouse', '@britecharts', '@clack'];
export async function resolve(specifier, context, next) {
  if (blocked.some(name => specifier === name || specifier.startsWith(name + '/'))) throw new Error('Unexpected startup dependency: ' + specifier);
  return next(specifier, context);
}`,
  );
  for (const flag of ['--help', '--version'])
    success(
      command('cli', process.execPath, [
        '--experimental-loader',
        loader,
        'node_modules/britepulse/dist/cli.js',
        flag,
      ]),
    );
  const exportedTypes = success(
    command('cli', process.execPath, [
      '--experimental-loader',
      loader,
      '--input-type=module',
      '--eval',
      "import {RunStore,resolveConfig} from 'britepulse';import {loadConfig} from 'britepulse/config';console.log(JSON.stringify({store:typeof RunStore,resolve:typeof resolveConfig,load:typeof loadConfig}));",
    ]),
  );
  assert.deepEqual(JSON.parse(exportedTypes), {
    store: 'function',
    resolve: 'function',
    load: 'function',
  });
});

test('installed aggregation API retains unknown values without browser tooling', () => {
  const result = JSON.parse(
    success(
      command('cli', process.execPath, [
        '--input-type=module',
        '--eval',
        `import { aggregateSyntheticSamples } from 'britepulse';
console.log(JSON.stringify(aggregateSyntheticSamples({
  url: 'https://example.com/', expectedSamples: 3,
  metrics: { lcp: { unit: 'ms', direction: 'lower' } }, samples: [],
})));`,
      ]),
    ),
  );
  assert.equal(result.status, 'partial');
  assert.equal(result.metrics.lcp.median, null);
  assert.equal(result.metrics.lcp.validSamples, 0);
});
