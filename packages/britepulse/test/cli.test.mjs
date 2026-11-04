import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 });
test('help works without a terminal', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /not implemented yet/);
});
test('unknown commands use the configuration error exit code', () => {
  const result = run('collect');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown command/);
});
test('redirected input cannot enter the interactive prompt', () => {
  const result = run();
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires a terminal/);
});

test('version works without a terminal', () => {
  const result = run('--version');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^0\.0\.0\s*$/);
});
