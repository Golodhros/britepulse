import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { installFakeLighthouse } from '../../../fixtures/synthetic/fakes/install.mjs';
import {
  measureProject,
  resolveConfig,
  RunStore,
  withTemporaryDirectory,
  RunExecutionError,
} from '../dist/index.js';

function config(directory, urls, synthetic = {}) {
  return resolveConfig({
    schemaVersion: 1,
    appRoot: directory,
    environments: { local: { urls } },
    synthetic: { runs: 2, retries: 0, ...synthetic },
  });
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const supported = process.platform !== 'win32';
test(
  'collects immutable original reports, samples and per-URL aggregates through an isolated worker',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await installFakeLighthouse(directory);
      const settings = config(directory, ['https://example.test/', 'https://example.test/second'], {
        warmups: 1,
        device: 'desktop',
      });
      const manifest = await measureProject(settings, 'baseline');
      assert.equal(manifest.status, 'complete');
      assert.equal(manifest.toolVersions.lighthouse, '13.6.0');
      const run = join(settings.outputDir, 'runs', manifest.id);
      assert.equal(manifest.artifacts.length, 19);
      const aggregate = await json(join(run, 'normalized/synthetic.json'));
      assert.equal(aggregate.results.length, 2);
      assert.equal(aggregate.results[0].aggregate.metrics['largest-contentful-paint'].median, 200);
      assert.equal(
        aggregate.results[0].aggregate.metrics['largest-contentful-paint'].attemptedSamples,
        2,
      );
      const sample = await json(join(run, 'normalized/synthetic/page-0/attempt-1.json'));
      assert.equal(sample.warmup, true);
      assert.equal((await json(join(run, sample.reports.json))).lighthouseVersion, '13.6.0');
      assert.match(await readFile(join(run, sample.reports.html), 'utf8'), /Public fake/);
      const launches = (await readFile(join(directory, 'fake-launches.ndjson'), 'utf8'))
        .trim()
        .split('\n')
        .map(JSON.parse);
      assert.equal(new Set(launches.map((launch) => launch.userDataDir)).size, 6);
      for (const launch of launches) await assert.rejects(access(launch.userDataDir));
      const engine = JSON.parse(
        (await readFile(join(directory, 'fake-engine.ndjson'), 'utf8')).split('\n')[0],
      );
      assert.equal(engine.flags.disableStorageReset, false);
      assert.equal(engine.config.settings.formFactor, 'desktop');
      const next = await measureProject(
        config(directory, ['https://example.test/'], { runs: 1 }),
        'baseline',
      );
      assert.notEqual(next.id, manifest.id);
    }),
);

test(
  'partial metrics and failed retries remain inspectable and cannot produce a complete run',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await installFakeLighthouse(directory);
      const settings = config(
        directory,
        ['https://example.test/partial', 'https://example.test/error'],
        { runs: 1, retries: 1 },
      );
      const manifest = await measureProject(settings, 'partial');
      assert.equal(manifest.status, 'partial');
      const run = join(settings.outputDir, 'runs', manifest.id);
      const data = await json(join(run, 'normalized/synthetic.json'));
      assert.equal(data.results[0].aggregate.metrics['largest-contentful-paint'].median, null);
      assert.equal(data.results[1].aggregate.metrics['performance-score'].attemptedSamples, 2);
      assert.equal(data.results[1].aggregate.metrics['performance-score'].validSamples, 0);
      assert.equal(
        (await json(join(run, 'normalized/synthetic/page-1/attempt-2.json'))).status,
        'failed',
      );
    }),
);

test(
  'rejects missing/wrong engines and unsupported profiles before creating a run',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await assert.rejects(
        measureProject(config(directory, ['https://example.test/']), 'missing'),
        /Install lighthouse/,
      );
      await installFakeLighthouse(directory);
      for (const synthetic of [{ cache: 'warm' }, { authHook: 'login.js' }])
        await assert.rejects(
          measureProject(config(directory, ['https://example.test/'], synthetic), 'unsupported'),
          /cold cache/,
        );
      await writeFile(
        join(directory, 'node_modules/lighthouse/package.json'),
        JSON.stringify({ version: '14.0.0', main: 'core/index.js', type: 'module' }),
      );
      await assert.rejects(
        measureProject(config(directory, ['https://example.test/']), 'version'),
        /Install lighthouse/,
      );
      assert.deepEqual((await new RunStore(join(directory, '.britepulse')).discover()).runs, []);
    }),
);

test(
  'malformed reports stop collection, preserve raw evidence and finalize partial history',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await installFakeLighthouse(directory);
      const settings = config(directory, ['https://example.test/malformed'], { retries: 2 });
      await assert.rejects(measureProject(settings, 'malformed'), (error) => {
        assert(error instanceof RunExecutionError);
        assert.equal(error.manifest.status, 'partial');
        assert.equal(error.manifest.artifacts.length, 2);

        return true;
      });
      assert.equal(
        (await readFile(join(directory, 'fake-engine.ndjson'), 'utf8')).trim().split('\n').length,
        1,
      );
    }),
);

test(
  'timeouts terminate the detached browser and retain a failed measured attempt',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await installFakeLighthouse(directory);
      const settings = config(directory, ['https://example.test/hang'], {
        runs: 1,
        timeoutMs: 1000,
      });
      const manifest = await measureProject(settings, 'timeout');
      assert.equal(manifest.status, 'partial');
      const pid = Number(await readFile(join(directory, 'fake-browser.pid'), 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      const sample = await json(
        join(settings.outputDir, 'runs', manifest.id, 'normalized/synthetic/page-0/attempt-1.json'),
      );
      assert.match(sample.error, /timeout/);
    }),
);

test(
  'cancellation terminates active browser work and finalizes cancelled history',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await installFakeLighthouse(directory);
      const settings = config(directory, ['https://example.test/hang'], { runs: 1 });
      const controller = new AbortController();
      const pending = measureProject(settings, 'cancelled', { signal: controller.signal });
      // Attach the rejection handler before aborting so cancellation cannot become unhandled.
      const rejected = assert.rejects(
        pending,
        (error) => error instanceof RunExecutionError && error.manifest.status === 'cancelled',
      );
      let pid;
      for (let count = 0; count < 200; count++) {
        try {
          pid = Number(await readFile(join(directory, 'fake-browser.pid'), 'utf8'));
          break;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      controller.abort();
      await rejected;
      assert(pid, 'Browser stub must start before cancellation');
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      const { runs } = await new RunStore(settings.outputDir).discover();
      assert.equal(runs[0].status, 'cancelled');
      assert(runs[0].finishedAt);
    }),
);

test(
  'retains completed reports when browser cleanup exceeds the attempt timeout',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      await installFakeLighthouse(directory);
      const settings = config(directory, ['https://example.test/cleanup-hang'], {
        runs: 1,
        timeoutMs: 1000,
      });
      const manifest = await measureProject(settings, 'cleanup-timeout');
      assert.equal(manifest.status, 'partial');
      const run = join(settings.outputDir, 'runs', manifest.id);
      const sample = await json(join(run, 'normalized/synthetic/page-0/attempt-1.json'));
      assert.match(sample.error, /timeout/);
      assert(sample.reports.json);
      await access(join(run, sample.reports.html));
      assert.equal((await json(join(run, sample.reports.json))).lighthouseVersion, '13.6.0');
      const pid = Number(await readFile(join(directory, 'fake-browser.pid'), 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }),
);

test(
  'raw report persistence errors stop the adapter without consuming navigation retries',
  { skip: !supported },
  async () =>
    withTemporaryDirectory(async (directory) => {
      const { resolveLighthouse, createLighthouseRunner } =
        await import('../dist/lighthouse-runner.js');
      const { scheduleSyntheticSamples, SyntheticRunnerFatalError } =
        await import('../dist/index.js');
      await installFakeLighthouse(directory);
      const settings = config(directory, ['https://example.test/']);
      const runner = createLighthouseRunner(
        settings,
        resolveLighthouse(directory),
        {
          writeArtifact: async () => {
            throw new Error('Disk full');
          },
        },
        0,
        [],
      );
      await assert.rejects(
        scheduleSyntheticSamples({ url: 'https://example.test/', runs: 1, retries: 2 }, runner),
        (error) => {
          assert(error.cause instanceof SyntheticRunnerFatalError);
          assert.equal(error.cause.cause.message, 'Disk full');

          return true;
        },
      );
      assert.equal(
        (await readFile(join(directory, 'fake-engine.ndjson'), 'utf8')).trim().split('\n').length,
        1,
      );
    }),
);
