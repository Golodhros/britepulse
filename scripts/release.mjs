import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { realpathSync } from 'node:fs';
import {
  betaReleasePlan,
  verifyReleaseReceipt,
  classifyRegistryResult,
} from './lib/release-policy.mjs';

const args = process.argv.slice(2);
assert(
  args.length === 0 || (args.length === 1 && args[0] === '--publish'),
  'Unknown release option',
);
const root = resolve(import.meta.dirname, '..');
const readJSON = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const plan = betaReleasePlan(
  await readJSON('packages/britepulse/package.json'),
  await readJSON('.changeset/pre.json'),
);
const receipt = await readJSON('.artifacts/release/receipt.json');
const tarball = join(root, '.artifacts/release', plan.filename);
const integrity = `sha512-${createHash('sha512')
  .update(await readFile(tarball))
  .digest('base64')}`;
const git = (...command) =>
  execFileSync('/usr/bin/git', command, { cwd: root, encoding: 'utf8' }).trim();
verifyReleaseReceipt(plan, receipt, integrity, git('rev-parse', 'HEAD'), args.length > 0);
const publishArgs = [
  'publish',
  tarball,
  '--access',
  'public',
  '--tag',
  'beta',
  '--registry',
  'https://registry.npmjs.org/',
  '--ignore-scripts',
  '--provenance',
];
if (!args.length) {
  console.log(
    JSON.stringify(
      {
        ...plan,
        integrity,
        command: ['npm', ...publishArgs],
        dryRun: true,
        sourceDirty: receipt.sourceDirty || Boolean(git('status', '--porcelain')),
        limitations: receipt.limitations,
      },
      null,
      2,
    ),
  );
} else {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    'true',
    'Publish through the reviewed GitHub release workflow',
  );
  assert.equal(git('status', '--porcelain'), '', 'Publishing requires a clean checkout');
  const npmCLI = realpathSync(join(dirname(process.execPath), 'npm'));
  const registry = spawnSync(
    process.execPath,
    [
      npmCLI,
      'view',
      `${plan.name}@${plan.version}`,
      'dist.integrity',
      '--json',
      '--registry',
      'https://registry.npmjs.org/',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  const state = classifyRegistryResult(registry, integrity);
  if (state === 'unpublished') {
    const published = spawnSync(process.execPath, [npmCLI, ...publishArgs], {
      cwd: root,
      stdio: 'inherit',
    });
    if (published.error) throw published.error;
    assert.equal(published.status, 0, 'npm publication failed');
  }
  const tag = `${plan.name}@${plan.version}`;
  if (!git('tag', '--list', tag)) {
    execFileSync('/usr/bin/git', ['tag', tag], { cwd: root });
    if (process.env.CHANGESETS_OUTPUT)
      await appendFile(
        process.env.CHANGESETS_OUTPUT,
        JSON.stringify({ type: 'git-tag', tag, packageName: plan.name }) + '\n',
      );
  }
  console.log(
    `${plan.name}@${plan.version}: ${state === 'already-published' ? 'verified existing artifact' : 'published'} on beta`,
  );
}
