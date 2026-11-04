import { resolve } from 'node:path';
import { run } from './lib/run.mjs';
await run(process.execPath, [
  resolve('packages/britepulse/node_modules/typescript/bin/tsc'),
  '-p',
  'packages/britepulse/tsconfig.build.json',
]);
await run(process.execPath, [
  '--test',
  'packages/britepulse/test/*.test.mjs',
  'fixtures/synthetic/server.test.mjs',
]);
