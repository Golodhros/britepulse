import { relative } from 'node:path';
import { promisify } from 'node:util';
import { gzip, brotliCompress, constants } from 'node:zlib';
import { version, type Rolldown, type ResolvedConfig } from 'vite';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assetKind, resolveBundleGraph, type GraphAsset } from './bundle-graph.js';
import { parseValidated } from './validation.js';
import type { BundleSnapshot } from './contracts.js';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
type OutputItem = Rolldown.OutputBundle[string];
const manifestSchema = z.record(
  z.string(),
  z.object({
    file: z.string(),
    isEntry: z.boolean().optional(),
    css: z.array(z.string()).default([]),
    assets: z.array(z.string()).default([]),
  }),
);

async function emittedSizes(item: OutputItem, compression: boolean): Promise<GraphAsset['sizes']> {
  const source = item.type === 'chunk' ? Buffer.from(item.code) : Buffer.from(item.source);
  const sizes: GraphAsset['sizes'] = {
    emittedBytes: source.byteLength,
    parsedBytes: null,
    gzipBytes: null,
    brotliBytes: null,
    transferBytes: null,
  };
  if (!compression) return sizes;
  const [compressedGzip, compressedBrotli] = await Promise.all([
    gzipAsync(source, { level: 9 }),
    brotliAsync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  ]);
  return {
    ...sizes,
    gzipBytes: compressedGzip.byteLength,
    brotliBytes: compressedBrotli.byteLength,
  };
}

function emittedImports(
  item: OutputItem,
  bundle: Rolldown.OutputBundle,
  diagnostics: string[],
): string[] {
  if (item.type !== 'chunk') return [];
  return item.imports.filter((id) => {
    if (Object.hasOwn(bundle, id)) return true;
    diagnostics.push(`External import excluded from emitted totals: ${id}`);
    return false;
  });
}

async function collectAsset(
  item: OutputItem,
  bundle: Rolldown.OutputBundle,
  root: string,
  compression: boolean,
  diagnostics: string[],
): Promise<GraphAsset> {
  return {
    id: item.fileName,
    kind: assetKind(item.fileName),
    sizes: await emittedSizes(item, compression),
    imports: emittedImports(item, bundle, diagnostics),
    dynamicImports: item.type === 'chunk' ? item.dynamicImports : [],
    modules:
      item.type === 'chunk'
        ? Object.keys(item.modules).map((id) => relative(root, id).replaceAll('\\', '/'))
        : [],
  };
}

function includeEntrypoint(item: OutputItem, root: string, entries: Record<string, string>): void {
  if (item.type !== 'chunk' || !item.isEntry) return;
  const name = item.facadeModuleId
    ? relative(root, item.facadeModuleId).replaceAll('\\', '/')
    : item.name;
  if (Object.hasOwn(entries, name)) throw new Error(`Duplicate entrypoint identity: ${name}`);
  entries[name] = item.fileName;
}

function includeManifestRelationships(
  config: ResolvedConfig,
  bundle: Rolldown.OutputBundle,
  assets: GraphAsset[],
  diagnostics: string[],
): void {
  const manifestName =
    typeof config.build.manifest === 'string' ? config.build.manifest : '.vite/manifest.json';
  const manifestAsset = config.build.manifest ? bundle[manifestName] : undefined;
  if (!manifestAsset || manifestAsset.type !== 'asset') {
    diagnostics.push(
      'Build manifest unavailable; entrypoint CSS and static asset relationships are incomplete',
    );
    return;
  }
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

function includeCssDiagnostics(assets: GraphAsset[], diagnostics: string[]): void {
  for (const css of assets.filter((asset) => asset.kind === 'css')) {
    if (!assets.some((asset) => asset.imports.includes(css.id)))
      diagnostics.push(`Emitted CSS has no entrypoint attribution: ${css.id}`);
  }
}

export async function collectViteBundle(
  config: ResolvedConfig,
  bundle: Rolldown.OutputBundle,
  compression: boolean,
): Promise<BundleSnapshot> {
  const diagnostics: string[] = [];
  const assets: GraphAsset[] = [];
  const entries: Record<string, string> = {};
  for (const item of Object.values(bundle)) {
    assets.push(await collectAsset(item, bundle, config.root, compression, diagnostics));
    includeEntrypoint(item, config.root, entries);
  }
  includeManifestRelationships(config, bundle, assets, diagnostics);
  includeCssDiagnostics(assets, diagnostics);
  return resolveBundleGraph(
    assets,
    entries,
    {
      runId: randomUUID(),
      target: config.build.ssr ? 'ssr' : 'client',
      toolVersions: { vite: version, backend: 'rolldown' },
      compression: compression ? { gzipLevel: 9, brotliQuality: 11 } : null,
    },
    diagnostics,
  );
}
