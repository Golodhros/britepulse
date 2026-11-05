import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixtureServer } from './server.mjs';
import { measureProject, resolveConfig } from '../../packages/britepulse/dist/index.js';

const root = dirname(fileURLToPath(import.meta.url));
await mkdir(join(root, '.artifacts'), { recursive: true });
const output = await mkdtemp(join(root, '.artifacts/collector-'));
const server = createFixtureServer();
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/`;
  const config = resolveConfig({
    schemaVersion: 1,
    appRoot: root,
    outputDir: output,
    environments: { local: { urls: [url] } },
    synthetic: { runs: 3, retries: 0, timeoutMs: 120_000 },
  });
  const manifest = await measureProject(config, 'live-collector-probe');
  assert.equal(manifest.status, 'complete', JSON.stringify(manifest.diagnostics));
  const directory = join(output, 'runs', manifest.id);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const sample = JSON.parse(
      await readFile(
        join(directory, `normalized/synthetic/page-0/attempt-${attempt}.json`),
        'utf8',
      ),
    );
    assert.equal(sample.status, 'success');
    const original = JSON.parse(await readFile(join(directory, sample.reports.json), 'utf8'));
    assert.equal(original.finalDisplayedUrl, url);
    assert(!original.runtimeError);
    assert.match(await readFile(join(directory, sample.reports.html), 'utf8'), /<html/i);
  }
  const aggregates = JSON.parse(
    await readFile(join(directory, 'normalized/synthetic.json'), 'utf8'),
  );
  assert.equal(aggregates.results[0].aggregate.metrics['largest-contentful-paint'].validSamples, 3);
  console.log(
    `Live collector retained three JSON/HTML reports and complete aggregates: ${directory}`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
