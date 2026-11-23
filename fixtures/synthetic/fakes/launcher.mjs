import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { appendFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export async function launch(options) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true,
    stdio: 'ignore',
  });
  await once(child, 'spawn');
  await writeFile(join(options.userDataDir, 'chrome.pid'), String(child.pid));
  await writeFile('fake-browser.pid', String(child.pid));
  await appendFile('fake-launches.ndjson', JSON.stringify(options) + '\n');

  return {
    port: 9222,
    kill: async () => {
      let hang = false;
      try {
        await access('fake-hang-cleanup');
        hang = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (hang) await new Promise(() => {});
      const exit = once(child, 'exit');
      process.kill(-child.pid, 'SIGKILL');
      await exit;
    },
  };
}
