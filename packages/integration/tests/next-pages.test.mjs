import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cli, success } from './helpers.mjs';

test('installed Next Pages import retains initial route assets and explicit partial status', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'britepulse-next-import-'));
  try {
    await mkdir(join(directory, 'diagnostics'));
    const config = join(directory, 'britepulse.config.json');
    await writeFile(
      config,
      JSON.stringify({
        schemaVersion: 1,
        bundle: { adapter: 'next-webpack' },
        environments: { local: { urls: ['https://example.test/'] } },
      }),
    );
    await writeFile(
      join(directory, 'client-stats.json'),
      JSON.stringify({
        name: 'client',
        version: '5.98.0',
        assets: [
          { name: 'home.js', size: 123 },
          { name: 'shared.css', size: 45 },
        ],
      }),
    );
    await writeFile(
      join(directory, 'build-manifest.json'),
      JSON.stringify({
        polyfillFiles: [],
        lowPriorityFiles: [],
        pages: { '/_app': ['shared.css'], '/': ['home.js'] },
      }),
    );
    await writeFile(
      join(directory, 'diagnostics/framework.json'),
      JSON.stringify({ name: 'Next.js', version: '16.4.5' }),
    );
    await writeFile(join(directory, 'BUILD_ID'), 'installed-build');
    const manifest = JSON.parse(
      success(cli('cli', ['analyze', '--next-build', directory, '--config', config])),
    );
    assert.equal(manifest.status, 'partial');
    assert.equal(manifest.identity.build, 'installed-build');
    const snapshot = JSON.parse(
      await readFile(
        join(directory, '.britepulse/runs', manifest.id, 'normalized/bundle.json'),
        'utf8',
      ),
    );
    assert.deepEqual(snapshot.entrypoints['/'].initial, ['home.js', 'shared.css']);
    assert.equal(snapshot.capabilities.routes, 'partial');
    assert.equal(
      cli('cli', [
        'analyze',
        '--next-build',
        directory,
        '--artifact',
        'conflict',
        '--config',
        config,
      ]).status,
      2,
    );
    assert.equal(
      cli('cli', ['analyze', '--next-build', directory, '--target', 'ssr', '--config', config])
        .status,
      2,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
