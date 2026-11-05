import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

function requireOutside(history: string, output: string): void {
  const path = relative(history, output);
  const outside = path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
  if (!outside) throw new Error('Exports must be written outside immutable history');
}

/** Exclusive output creation, including canonical-parent checks for aliases into history. */
export async function writeExportFile(
  history: string,
  output: string,
  contents: string,
): Promise<string> {
  const destination = resolve(output);
  requireOutside(history, destination);
  await mkdir(dirname(destination), { recursive: true });
  const canonical = resolve(await realpath(dirname(destination)), basename(destination));
  requireOutside(await realpath(history), canonical);
  await writeFile(canonical, contents, { flag: 'wx' });

  return canonical;
}
