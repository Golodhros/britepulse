import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cli, success } from './helpers.mjs';
import { installFakeLighthouse } from '../../../fixtures/synthetic/fakes/install.mjs';

test(
  'installed experimental measure command persists worker reports and partial outcomes',
  { skip: process.platform === 'win32' },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'britepulse-installed-measure-'));
    try {
      const configPath = join(directory, 'britepulse.config.json');
      const settings = {
        schemaVersion: 1,
        appRoot: '.',
        environments: { local: { urls: ['https://example.test/'] } },
        synthetic: { runs: 1, retries: 0 },
      };
      await writeFile(configPath, JSON.stringify(settings));
      assert.equal(cli('cli', ['measure', '--config', configPath]).status, 2);
      assert.match(success(cli('cli', ['measure', '--help'])), /--experimental/);
      const missing = cli('cli', ['measure', '--experimental', '--config', configPath]);
      assert.equal(missing.status, 2);
      assert.match(missing.stderr, /Install lighthouse/);
      await installFakeLighthouse(directory);
      const args = [
        'measure',
        '--experimental',
        '--config',
        configPath,
        '--label',
        'fixture',
        '--json',
      ];
      const manifest = JSON.parse(success(cli('cli', args)));
      assert.equal(manifest.status, 'complete');
      const run = join(directory, '.britepulse/runs', manifest.id);
      const sample = JSON.parse(
        await readFile(join(run, 'normalized/synthetic/page-0/attempt-1.json'), 'utf8'),
      );
      assert.equal(sample.metrics['largest-contentful-paint'].value, 200);
      assert.match(await readFile(join(run, sample.reports.html), 'utf8'), /Public fake/);
      settings.environments.local.urls = ['https://example.test/partial'];
      await writeFile(configPath, JSON.stringify(settings));
      const partial = cli('cli', args);
      assert.equal(partial.status, 1);
      assert.equal(JSON.parse(partial.stdout).status, 'partial');
      const history = JSON.parse(success(cli('cli', ['history', '--config', configPath])));
      assert.equal(history.runs.length, 2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
