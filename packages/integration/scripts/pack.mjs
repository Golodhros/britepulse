import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../../scripts/lib/run.mjs';
import { repoRoot, tarballs } from './paths.mjs';
await rm(tarballs, { recursive: true, force: true });
await mkdir(tarballs, { recursive: true });
// prepack runs the production build and copies prebuilt report assets.
await run('pnpm', ['pack', '--pack-destination', tarballs], {
  cwd: join(repoRoot, 'packages/britepulse'),
});
