import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { verifyFixture } from './verify-compatibility.mjs';
const targets = process.argv.slice(2);
const fixtures = targets.length ? targets : ['vite-react', 'next-pages', 'next-app'];
for (const fixture of fixtures) {
  if (!['vite-react', 'next-pages', 'next-app'].includes(fixture)) throw new Error(`Unknown fixture: ${fixture}`);
  for (const variant of ['baseline', 'candidate']) {
    const cwd = resolve('fixtures', fixture);
    const isVite = fixture === 'vite-react';
    const executable = resolve(cwd, 'node_modules', isVite ? 'vite/bin/vite.js' : 'next/dist/bin/next');
    const args = isVite ? ['build'] : ['build', '--webpack'];
    console.log(`\nBuilding ${fixture} ${variant}`);
    const child = spawn(process.execPath, [executable, ...args], { cwd, stdio: 'inherit', timeout: 120_000, env: { ...process.env, BRITEPULSE_VARIANT: variant, NEXT_TELEMETRY_DISABLED: '1' } });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    if (code !== 0) throw new Error(`${fixture} ${variant} failed (${code})`);
  }
  await verifyFixture(fixture);
}
