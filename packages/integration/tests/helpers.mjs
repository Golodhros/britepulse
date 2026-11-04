import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { consumerPath } from '../scripts/paths.mjs';
export function command(name, executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: consumerPath(name),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}
export function success(result) {
  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result.stdout;
}
export function cli(name, args, options) {
  const directory = consumerPath(name);
  return process.platform === 'win32'
    ? command(
        name,
        process.execPath,
        [join(directory, 'node_modules/britepulse/dist/cli.js'), ...args],
        options,
      )
    : command(name, join(directory, 'node_modules/.bin/britepulse'), args, options);
}
export function vite(args = [], env = {}) {
  return command(
    'vite-react',
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', ...args],
    { env: { ...process.env, ...env } },
  );
}
export function json(result) {
  return JSON.parse(success(result));
}
