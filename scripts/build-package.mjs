import { cp, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/run.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = resolve(root, 'packages/britepulse');
const report = resolve(root, 'packages/report');
await rm(resolve(core, 'dist'), { recursive: true, force: true });
await run(process.execPath, [resolve(report, 'node_modules/typescript/bin/tsc'), '--noEmit'], {
  cwd: report,
});
await run(process.execPath, [resolve(report, 'node_modules/vite/bin/vite.js'), 'build'], {
  cwd: report,
});
await run(
  process.execPath,
  [resolve(core, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
  { cwd: core },
);
await cp(resolve(report, 'dist'), resolve(core, 'dist/report'), { recursive: true });
await cp(resolve(root, 'LICENSE'), resolve(core, 'LICENSE'));
await cp(resolve(root, 'README.md'), resolve(core, 'README.md'));
