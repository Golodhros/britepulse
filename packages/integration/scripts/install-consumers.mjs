import './prepare-consumers.mjs';
import { run } from '../../../scripts/lib/run.mjs';
import { consumerNames, consumerPath } from './paths.mjs';
for (const name of consumerNames)
  await run('pnpm', ['install', '--ignore-scripts'], { cwd: consumerPath(name) });
