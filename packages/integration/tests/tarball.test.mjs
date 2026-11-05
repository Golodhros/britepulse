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

test('installed scheduler retries failures and preserves measured attempt history', () => {
  const result = JSON.parse(
    success(
      command('cli', process.execPath, [
        '--input-type=module',
        '--eval',
        `import { scheduleSyntheticSamples } from 'britepulse';
const samples = await scheduleSyntheticSamples({url:'https://example.com/',runs:1,retries:1}, async ({attempt}) => ({
  status: attempt === 1 ? 'failed' : 'success', metrics: {}, error: attempt === 1 ? 'Crash' : null,
  reports: {json:null,html:null},
}));
console.log(JSON.stringify(samples.map(({attempt,status,warmup})=>({attempt,status,warmup}))));`,
      ]),
    ),
  );
  assert.deepEqual(result, [
    { attempt: 1, status: 'failed', warmup: false },
    { attempt: 2, status: 'success', warmup: false },
  ]);
});

test('installed Lighthouse normalizer preserves unknowns and fractional scores without Lighthouse', () => {
  const result = JSON.parse(
    success(
      command('cli', process.execPath, [
        '--input-type=module',
        '--eval',
        `import { normalizeLighthouseReport } from 'britepulse';
console.log(JSON.stringify(normalizeLighthouseReport({
  lighthouseVersion:'13.6.0', gatherMode:'navigation', requestedUrl:'https://example.com/',
  finalDisplayedUrl:'https://example.com/', fetchTime:'2026-11-05T12:00:00.000Z',
  audits:{'cumulative-layout-shift':{numericValue:0.25,numericUnit:'unitless',scoreDisplayMode:'numeric'}},
  categories:{performance:{score:0.85}},
}, {url:'https://example.com/',reports:{json:null,html:null}})));`,
      ]),
    ),
  );
  assert.equal(result.outcome.status, 'success');
  assert.deepEqual(result.outcome.metrics['cumulative-layout-shift'], {
    value: 0.25,
    unit: 'unitless',
  });
  assert.deepEqual(result.outcome.metrics['performance-score'], { value: 0.85, unit: 'score' });
  assert.equal(result.outcome.metrics['largest-contentful-paint'].value, null);
});
