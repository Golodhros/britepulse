import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { verifyPackage } from './lib/verify-package.mjs';
import { run } from './lib/run.mjs';
const temporary = await mkdtemp(join(tmpdir(), 'britepulse-package-'));
try {
  await run('pnpm', ['pack', '--pack-destination', temporary], {
    cwd: resolve('packages/britepulse'),
  });
  const tarball = (await readdir(temporary)).find((name) => name.endsWith('.tgz'));
  assert(tarball, 'Tarball must exist');
  const consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await run('pnpm', ['add', '--ignore-scripts', join(temporary, tarball)], {
    cwd: consumer,
  });
  await verifyPackage(consumer);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
