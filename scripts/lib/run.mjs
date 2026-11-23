import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', timeout: 120_000, ...options });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw new Error(`${command} failed (${signal ?? code})`);
}
