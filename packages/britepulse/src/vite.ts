import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { relative, resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { gzip, brotliCompress, constants } from 'node:zlib';
import { version, type Plugin, type ResolvedConfig } from 'vite';
import { z } from 'zod';
import { resolveBundleGraph, type GraphAsset } from './bundle-graph.js';
import { parseValidated, relativeArtifactPath } from './validation.js';
const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const manifestSchema = z.record(
  z.string(),
  z.object({
    file: z.string(),
    isEntry: z.boolean().optional(),
    css: z.array(z.string()).default([]),
    assets: z.array(z.string()).default([]),
  }),
);
export interface BritePulseViteOptions {
  fileName?: string;
  compression?: boolean;
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
        const diagnostics: string[] = [];
        const assets: GraphAsset[] = [];
        const entries: Record<string, string> = {};
        for (const item of Object.values(bundle)) {
          const source = item.type === 'chunk' ? Buffer.from(item.code) : Buffer.from(item.source);
          const sizes = {
            emittedBytes: source.byteLength,
            parsedBytes: null,
            gzipBytes: options.compression
              ? (await gzipAsync(source, { level: 9 })).byteLength
              : null,
            brotliBytes: options.compression
              ? (await brotliAsync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }))
                  .byteLength
              : null,
            transferBytes: null,
          };
          const imports =
            item.type === 'chunk'
              ? item.imports.filter((id) => {
                  if (Object.hasOwn(bundle, id)) return true;
                  diagnostics.push(`External import excluded from emitted totals: ${id}`);
                  return false;
                })
              : [];
          const asset: GraphAsset = {
            id: item.fileName,
            kind:
              item.fileName.endsWith('.js') || item.fileName.endsWith('.mjs')
                ? 'js'
                : item.fileName.endsWith('.css')
                  ? 'css'
                  : 'other',
            sizes,
            imports,
            dynamicImports: item.type === 'chunk' ? item.dynamicImports : [],
            modules:
              item.type === 'chunk'
                ? Object.keys(item.modules).map((id) =>
                    relative(config.root, id).replaceAll('\\', '/'),
                  )
                : [],
          };
          assets.push(asset);
          if (item.type === 'chunk' && item.isEntry) {
            const name = item.facadeModuleId
              ? relative(config.root, item.facadeModuleId).replaceAll('\\', '/')
              : item.name;
            if (Object.hasOwn(entries, name))
              throw new Error(`Duplicate entrypoint identity: ${name}`);
            entries[name] = item.fileName;
          }
        }
        const manifestName =
          typeof config.build.manifest === 'string' ? config.build.manifest : '.vite/manifest.json';
        const manifestAsset = config.build.manifest ? bundle[manifestName] : undefined;
        if (!manifestAsset || manifestAsset.type !== 'asset')
          diagnostics.push(
            'Build manifest unavailable; entrypoint CSS and static asset relationships are incomplete',
          );
        else {
          const manifest = parseValidated(
            manifestSchema,
            JSON.parse(Buffer.from(manifestAsset.source).toString('utf8')),
            'Invalid Vite build manifest',
          );
          for (const entry of Object.values(manifest)) {
            const asset = assets.find((asset) => asset.id === entry.file);
            if (asset) asset.imports.push(...entry.css, ...entry.assets);
          }
        }
        for (const css of assets.filter((asset) => asset.kind === 'css')) {
          if (!assets.some((asset) => asset.imports.includes(css.id)))
            diagnostics.push(`Emitted CSS has no entrypoint attribution: ${css.id}`);
        }
        const snapshot = resolveBundleGraph(
          assets,
          entries,
          {
            runId: randomUUID(),
            target: config.build.ssr ? 'ssr' : 'client',
            toolVersions: { vite: version, backend: 'rolldown' },
            compression: options.compression ? { gzipLevel: 9, brotliQuality: 11 } : null,
          },
          diagnostics,
        );
        const temporary = join(directory, `.britepulse-${randomUUID()}.tmp`);
        try {
          await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
          await rename(temporary, join(directory, fileName));
        } finally {
          await rm(temporary, { force: true });
        }
      },
    },
  };
}
export default britepulse;
