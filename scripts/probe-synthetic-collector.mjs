import { run } from './lib/run.mjs';
await run('pnpm', ['--filter', 'britepulse', 'run', 'build']);
await run(process.execPath, ['fixtures/synthetic/collector-probe.mjs'], { timeout: 420_000 });
