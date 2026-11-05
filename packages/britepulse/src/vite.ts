import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { version, type Plugin, type ResolvedConfig } from 'vite';
import { collectViteBundle } from './vite-collector.js';
import { parseValidated, relativeArtifactPath } from './validation.js';
import type { BundleSnapshot } from './contracts.js';

export interface BritePulseViteOptions {
  fileName?: string;
  compression?: boolean;
}

async function writeSnapshot(
  directory: string,
  fileName: string,
  snapshot: BundleSnapshot,
): Promise<void> {
  const temporary = join(directory, `.britepulse-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, join(directory, fileName));
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Collect production output only. Vite is an optional peer and is never loaded by the CLI. */
export function britepulse(options: BritePulseViteOptions = {}): Plugin {
  const fileName = parseValidated(
    relativeArtifactPath,
    options.fileName ?? 'britepulse-bundle.json',
    'Invalid BritePulse artifact filename',
  );
  if (fileName.includes('/') || !fileName.endsWith('.json'))
    throw new Error('BritePulse artifact filename must be a single JSON filename');
  let config: ResolvedConfig;
  const writtenDirectories = new Set<string>();
  return {
    name: 'britepulse',
    apply: 'build',
    enforce: 'post',
    config(user) {
      if (user.build?.manifest === undefined) return { build: { manifest: true } };
    },
    configResolved(resolved) {
      config = resolved;
      if (version !== '8.3.5')
        throw new Error(
          `Unsupported Vite version ${version}; BritePulse has validated Vite 8.3.5 only`,
        );
    },
    buildStart() {
      writtenDirectories.clear();
    },
    writeBundle: {
      order: 'post',
      async handler(output, bundle) {
        if (Object.hasOwn(bundle, fileName))
          throw new Error(`BritePulse artifact filename collides with emitted asset ${fileName}`);
        const directory = resolve(config.root, output.dir ?? config.build.outDir);
        if (writtenDirectories.has(directory))
          throw new Error(
            'BritePulse does not support multiple output formats in the same directory',
          );
        writtenDirectories.add(directory);
        const snapshot = await collectViteBundle(config, bundle, options.compression ?? false);
        await writeSnapshot(directory, fileName, snapshot);
      },
    },
  };
}
export default britepulse;
