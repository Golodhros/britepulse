import assert from 'node:assert/strict';
import { readFile, mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { run } from './lib/run.mjs';
import { betaReleasePlan } from './lib/release-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const git = (...args) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8' }).trim();
const gitHead = git('rev-parse', 'HEAD');
const sourceDirty = Boolean(git('status', '--porcelain'));
const manifest = JSON.parse(await readFile(join(root, 'packages/britepulse/package.json'), 'utf8'));
const pre = JSON.parse(await readFile(join(root, '.changeset/pre.json'), 'utf8'));
const plan = betaReleasePlan(manifest, pre);
for (const parent of ['packages', 'fixtures']) {
  for (const name of await readdir(join(root, parent))) {
    let pkg;
    try {
      pkg = JSON.parse(await readFile(join(root, parent, name, 'package.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (pkg.name !== 'britepulse') assert.equal(pkg.private, true, `${pkg.name} must stay private`);
  }
}
const checks = [
  'lint',
  'typecheck',
  'test',
  'test:release',
  'format:check',
  'test:integration',
  'test:next-pages',
];
for (const check of checks) await run('pnpm', ['run', check], { cwd: root, timeout: 600_000 });
const source = join(root, 'packages/integration/.artifacts/tarballs', plan.filename);
const directory = join(root, '.artifacts/release');
await mkdir(directory, { recursive: true });
const destination = join(directory, plan.filename);
await copyFile(source, destination);
const data = await readFile(destination);
const receipt = {
  schemaVersion: 1,
  ...plan,
  integrity: `sha512-${createHash('sha512').update(data).digest('base64')}`,
  gitHead,
  sourceDirty: sourceDirty || Boolean(git('status', '--porcelain')),
  checks,
  limitations: [
    'Live Lighthouse probes remain blocked by loopback EPERM; browser collection stays experimental',
  ],
};
assert.equal(git('rev-parse', 'HEAD'), gitHead, 'Source commit changed during verification');
await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ ...receipt, tarball: destination }, null, 2));
