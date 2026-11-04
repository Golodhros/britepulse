import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import lighthouse from 'lighthouse';
import { createRequire } from 'node:module';
import { createFixtureServer } from './server.mjs';
const require = createRequire(import.meta.url);
const { launch } = await import(require.resolve('chrome-launcher', { paths: [dirname(require.resolve('lighthouse'))] }));
const root = dirname(fileURLToPath(import.meta.url));
await mkdir(resolve(root, '.artifacts'), { recursive: true });
const output = await mkdtemp(resolve(root, '.artifacts/probe-'));
const server = createFixtureServer();
let chrome;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${origin}/private`)).status, 401);
  const headers = { 'x-fixture-auth': 'britepulse-public-fixture' };
  assert.equal((await fetch(`${origin}/private`, { headers })).status, 200);
  chrome = await launch({ chromeFlags: ['--headless'], ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}) });
  const urls = [`${origin}/`, `${origin}/private`];
  for (const [page, url] of urls.entries()) {
    for (let run = 0; run < 3; run++) {
      const result = await lighthouse(url, { port: chrome.port, output: ['json', 'html'], onlyCategories: ['performance'], extraHeaders: headers });
      assert(!result.lhr.runtimeError, JSON.stringify(result.lhr.runtimeError));
      assert.equal(result.lhr.finalDisplayedUrl, url);
      await writeFile(resolve(output, `direct-${page}-${run}.json`), result.report[0]);
      await writeFile(resolve(output, `direct-${page}-${run}.html`), result.report[1]);
    }
  }
  await chrome.kill(); chrome = undefined;
  const configPath = resolve(output, 'lhci-config.json');
  await writeFile(configPath, JSON.stringify({ ci: { collect: { url: urls, numberOfRuns: 3, settings: { onlyCategories: ['performance'], extraHeaders: headers, chromeFlags: '--headless' } } } }));
  const cli = require.resolve('@lhci/cli/src/cli.js');
  const child = spawn(process.execPath, [cli, 'collect', `--config=${configPath}`], { cwd: output, stdio: 'inherit', timeout: 180_000 });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, 'LHCI collection must succeed');
  const reports = (await readdir(resolve(output, '.lighthouseci'))).filter(name => name.startsWith('lhr-') && name.endsWith('.json'));
  assert.equal(reports.length, 6, 'LHCI must retain each repeated report');
  for (const filename of reports) {
    const report = JSON.parse(await readFile(resolve(output, '.lighthouseci', filename), 'utf8'));
    assert(!report.runtimeError, JSON.stringify(report.runtimeError));
    assert(urls.includes(report.finalDisplayedUrl));
  }
  console.log('Both engines retained six original reports across public and authenticated URLs.');
} finally {
  await chrome?.kill();
  await new Promise(resolve => server.close(resolve));
}
