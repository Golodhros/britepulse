import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function installFakeLighthouse(directory) {
  const engine = join(directory, 'node_modules/lighthouse');
  const launcher = join(directory, 'node_modules/chrome-launcher');
  await mkdir(join(engine, 'core/config'), { recursive: true });
  await mkdir(launcher, { recursive: true });
  await writeFile(
    join(engine, 'package.json'),
    JSON.stringify({
      name: 'lighthouse',
      version: '13.6.0',
      type: 'module',
      main: 'core/index.js',
    }),
  );
  await writeFile(
    join(launcher, 'package.json'),
    JSON.stringify({ name: 'chrome-launcher', version: '1.2.2', type: 'module', main: 'index.js' }),
  );
  await copyFile(new URL('./engine.mjs', import.meta.url), join(engine, 'core/index.js'));
  await copyFile(new URL('./launcher.mjs', import.meta.url), join(launcher, 'index.js'));
  await writeFile(
    join(engine, 'core/config/desktop-config.js'),
    "export default {extends:'lighthouse:default',settings:{formFactor:'desktop'}};\n",
  );
}
