import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
export async function verifyPackage(consumer) {
  const installed = join(consumer, 'node_modules/britepulse');
  const loader = join(consumer, 'block-ui-loader.mjs');
  await writeFile(
    loader,
    `export async function resolve(specifier, context, next) { if (/^(react|react-dom|@britecharts\\/|@clack\\/|lighthouse)/.test(specifier)) throw new Error('Unexpected heavy dependency: ' + specifier); return next(specifier, context); }`,
  );
  for (const flag of ['--help', '--version']) {
    const result = spawnSync(
      process.execPath,
      ['--experimental-loader', loader, join(installed, 'dist/cli.js'), flag],
      {
        encoding: 'utf8',
        cwd: consumer,
        timeout: 5000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert(result.stdout.trim());
  }
  const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert(!manifest.dependencies.react && !manifest.dependencies['@britecharts/react']);
  assert((await readFile(join(installed, 'dist/report/index.html'), 'utf8')).includes('assets/'));
  assert(
    !(await readdir(installed)).some((name) => ['src', 'fixtures', '.britepulse'].includes(name)),
  );
  console.log('Clean tarball install, CLI help/version and packaged report assets passed.');
}
