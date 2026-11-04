import assert from 'node:assert/strict';
import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { integrationRoot, tarballs, consumerNames, consumerPath } from './paths.mjs';
const files = (await readdir(tarballs)).filter((name) => name.endsWith('.tgz'));
assert.equal(
  files.length,
  1,
  'Pack exactly one fresh BritePulse tarball before installing consumers',
);
for (const name of consumerNames) {
  const directory = consumerPath(name);
  await rm(directory, { recursive: true, force: true });
  await cp(join(integrationRoot, 'consumers', name), directory, { recursive: true });
  const path = join(directory, 'package.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.dependencies.britepulse = `file:${relative(directory, join(tarballs, files[0])).replaceAll('\\', '/')}`;
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
  // An independent workspace prevents pnpm from linking the source package.
  await writeFile(join(directory, 'pnpm-workspace.yaml'), 'packages: []\n');
}
