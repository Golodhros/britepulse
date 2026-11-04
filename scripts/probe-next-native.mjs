import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
const cwd = resolve('fixtures/next-app');
const cli = resolve(cwd, 'node_modules/next/dist/bin/next');
const evidence = {};
for (const variant of ['baseline', 'candidate']) {
  await rm(resolve(cwd, `.artifacts/turbopack-${variant}`), { recursive: true, force: true });
  const env = {
    ...process.env,
    BRITEPULSE_VARIANT: variant,
    BRITEPULSE_BACKEND: 'turbopack',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const analysis = spawn(process.execPath, [cli, 'experimental-analyze', '--output'], {
    cwd,
    env,
    stdio: 'inherit',
    timeout: 120_000,
  });
  assert.equal((await once(analysis, 'exit'))[0], 0, 'Native analysis must succeed');
  const destination = resolve(cwd, `.artifacts/turbopack-${variant}/graph.jsonl`);
  const output = createWriteStream(destination);
  const exported = spawn(
    process.execPath,
    [cli, 'experimental-analyze', 'export', '--dist-dir', `.artifacts/turbopack-${variant}`],
    { cwd, env, stdio: ['ignore', 'pipe', 'inherit'], timeout: 30_000 },
  );
  exported.stdout.pipe(output);
  const finished = once(output, 'finish');
  assert.equal((await once(exported, 'exit'))[0], 0, 'Native export must succeed');
  await finished;
  const records = (await readFile(destination, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(records[0].schema_version, 1);
  assert(records.some((r) => r.type === 'route' && r.route === '/'));
  assert(records.some((r) => r.type === 'output'));
  const lodashModules = records.filter(
    (r) => r.type === 'module' && r.path?.includes('/lodash/'),
  ).length;
  assert.equal(lodashModules > 0, variant === 'candidate');
  evidence[variant] = {
    schemaVersion: records[0].schema_version,
    lodashModules,
    recordTypes: [...new Set(records.map((r) => r.type))],
  };
}
await writeFile(
  resolve(cwd, '.artifacts/turbopack-evidence.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log(
  'Native graph export verified; production byte and route attribution semantics still need validation.',
);
