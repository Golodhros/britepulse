import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

test('direct setup, doctor and history work without prompts and preserve flag precedence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'britepulse-cli-'));
  try {
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ devDependencies: { vite: '8.3.5' } }),
    );
    await mkdir(join(directory, 'node_modules/vite'), { recursive: true });
    await writeFile(
      join(directory, 'node_modules/vite/package.json'),
      JSON.stringify({ version: '8.3.5' }),
    );
    const path = join(directory, 'britepulse.config.json');
    const init = run(
      'init',
      '--app-root',
      directory,
      '--url',
      'http://localhost:3000/',
      '--runs',
      '7',
      '--config',
      path,
    );
    assert.equal(init.status, 0, init.stderr);
    assert.equal(JSON.parse(init.stdout).config.bundle.adapter, 'vite');
    const project = JSON.parse(await readFile(path, 'utf8'));
    project.synthetic.retries = 4;
    await writeFile(path, JSON.stringify(project));
    const doctor = run('doctor', '--config', path, '--runs', '5', '--json');
    assert.equal(doctor.status, 0, doctor.stderr);
    const result = JSON.parse(doctor.stdout);
    assert.equal(result.config.synthetic.runs, 5);
    assert.equal(result.config.synthetic.retries, 4);
    const history = run('history', '--config', path);
    assert.equal(history.status, 0, history.stderr);
    assert.deepEqual(JSON.parse(history.stdout), { runs: [], diagnostics: [] });
    assert.equal(run('doctor', '--config', path, '--runs', '0').status, 2);
    assert.equal(run('doctor', '--config', path, '--unknown').status, 2);
    assert.equal(run('init', '--app-root', directory).status, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
