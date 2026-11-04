import { fileURLToPath } from 'node:url';
import { run } from '../../../scripts/lib/run.mjs';
import { integrationRoot } from './paths.mjs';
const packageOnly = process.argv.includes('--package-only');
if (process.argv.slice(2).some((arg) => arg !== '--package-only'))
  throw new Error('Unknown integration test option');
for (const script of ['pack.mjs', 'install-consumers.mjs']) {
  await run(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
    cwd: integrationRoot,
  });
}
const tests = packageOnly
  ? ['tests/tarball.test.mjs']
  : ['tests/tarball.test.mjs', 'tests/types.test.mjs', 'tests/workflow.test.mjs'];
await run(process.execPath, ['--test', ...tests], { cwd: integrationRoot });
