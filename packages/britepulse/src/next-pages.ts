import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { assetKind } from './bundle-graph.js';
import { parseBundleSnapshot, type BundleSnapshot } from './contracts.js';
import { nonempty, relativeArtifactPath, parseValidated } from './validation.js';
import type { ResolvedConfig } from './config.js';
import { RunStore } from './store.js';
import { collectRun } from './orchestration.js';

const statsSchema = z.object({
  name: z.literal('client'),
  version: z.literal('5.98.0'),
  assets: z.array(z.object({ name: relativeArtifactPath, size: z.number().int().nonnegative() })),
});
const manifestSchema = z
  .object({
    polyfillFiles: z.array(relativeArtifactPath),
    lowPriorityFiles: z.array(relativeArtifactPath),
    rootMainFiles: z.array(relativeArtifactPath).default([]),
    pages: z.record(nonempty, z.array(relativeArtifactPath)),
  })
  .refine(
    (manifest) => Object.hasOwn(manifest.pages, '/_app'),
    'Pages Router manifest requires /_app',
  );
const frameworkSchema = z.object({ name: z.literal('Next.js'), version: z.literal('16.4.5') });
const metadataSchema = z.strictObject({ runId: z.uuid(), nextVersion: z.literal('16.4.5') });

/** Initial Pages Router assets only. Async route and module attribution stay explicitly partial. */
export function normalizeNextPagesBundle(
  statsInput: unknown,
  manifestInput: unknown,
  metadata: { runId: string; nextVersion: string },
): BundleSnapshot {
  const stats = parseValidated(statsSchema, statsInput, 'Invalid Next.js client Webpack stats');
  const manifest = parseValidated(
    manifestSchema,
    manifestInput,
    'Invalid Next.js Pages build manifest',
  );
  const { runId, nextVersion } = metadataSchema.parse(metadata);
  if (manifest.rootMainFiles.length)
    throw new Error('App Router or mixed-router attribution is unsupported');
  const diagnostics = [
    'Asynchronous route attribution is unavailable; entrypoints contain manifest-backed initial assets only',
  ];
  const assets = new Map<string, BundleSnapshot['assets'][number]>();
  for (const asset of stats.assets) {
    if (assets.has(asset.name)) throw new Error(`Duplicate Webpack asset ${asset.name}`);
    assets.set(asset.name, {
      id: asset.name,
      kind: assetKind(asset.name),
      modules: [],
      sizes: {
        emittedBytes: asset.size,
        parsedBytes: null,
        gzipBytes: null,
        brotliBytes: null,
        transferBytes: null,
      },
    });
  }
  const include = (id: string): void => {
    if (assets.has(id)) return;
    diagnostics.push(`Manifest asset absent from client stats; emitted size unknown: ${id}`);
    assets.set(id, {
      id,
      kind: assetKind(id),
      modules: [],
      sizes: {
        emittedBytes: null,
        parsedBytes: null,
        gzipBytes: null,
        brotliBytes: null,
        transferBytes: null,
      },
    });
  };
  const entrypoints = Object.fromEntries(
    Object.entries(manifest.pages)
      .filter(([route]) => !['/_app', '/_document', '/_error'].includes(route))
      .map(([route, files]) => {
        if (!route.startsWith('/')) throw new Error(`Invalid route template ${route}`);
        const initial = [
          ...new Set([...manifest.polyfillFiles, ...manifest.pages['/_app']!, ...files]),
        ].sort();
        initial.forEach(include);

        return [route, { initial, asynchronous: [] }];
      }),
  );
  if (!Object.keys(entrypoints).length) throw new Error('No Pages Router page entries found');
  manifest.lowPriorityFiles.forEach(include);
  if (manifest.lowPriorityFiles.length)
    diagnostics.push(
      'Low-priority framework files are retained as assets without inferred route timing',
    );

  return parseBundleSnapshot({
    schemaVersion: 1,
    runId,
    adapter: 'next-webpack',
    target: 'client',
    toolVersions: { next: nextVersion, webpack: stats.version },
    capabilities: { modules: 'unavailable', routes: 'partial', compression: 'unavailable' },
    completeness: { status: 'partial', diagnostics },
    assets: [...assets.values()],
    entrypoints,
    compression: null,
  });
}

async function rejectAppRouter(directory: string): Promise<void> {
  let original;
  try {
    original = await readFile(join(directory, 'server/app-paths-manifest.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const routes = z.record(z.string(), z.string()).parse(JSON.parse(original));
  if (Object.keys(routes).length)
    throw new Error('App Router or mixed-router builds are unsupported');
}

export async function importNextPagesBundle(
  config: ResolvedConfig,
  directory: string,
  label: string,
) {
  if (config.bundle.adapter !== 'next-webpack')
    throw new Error('Next.js import requires bundle.adapter next-webpack');
  await rejectAppRouter(directory);
  const [stats, manifest, framework, buildId] = await Promise.all([
    readFile(config.bundle.statsFile ?? join(directory, 'client-stats.json'), 'utf8'),
    readFile(join(directory, 'build-manifest.json'), 'utf8'),
    readFile(join(directory, 'diagnostics/framework.json'), 'utf8'),
    readFile(join(directory, 'BUILD_ID'), 'utf8'),
  ]);
  const version = frameworkSchema.parse(JSON.parse(framework)).version;
  const identity = nonempty.parse(buildId.trim());
  const source = normalizeNextPagesBundle(JSON.parse(stats), JSON.parse(manifest), {
    runId: randomUUID(),
    nextVersion: version,
  });
  const result = await collectRun(
    new RunStore(config.outputDir),
    {
      label,
      environment: config.environment,
      framework: 'nextjs',
      configFingerprint: config.fingerprint,
      toolVersions: source.toolVersions,
      git: null,
      identity: { build: identity },
    },
    async (session) => {
      await session.writeArtifact('original/client-stats.json', stats);
      await session.writeArtifact('original/build-manifest.json', manifest);
      await session.writeArtifact('original/framework.json', framework);
      await session.writeArtifact('original/BUILD_ID', buildId);
      await session.writeJSON(
        'normalized/bundle.json',
        parseBundleSnapshot({ ...source, runId: session.manifest.id }),
      );
    },
    { status: 'partial', diagnostics: source.completeness.diagnostics },
  );

  return result.manifest;
}
