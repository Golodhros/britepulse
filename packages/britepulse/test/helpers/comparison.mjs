import { randomUUID } from 'node:crypto';
export const metadata = {
  label: 'test',
  framework: 'vite',
  environment: 'local',
  configFingerprint: 'a'.repeat(64),
  toolVersions: { vite: '8.3.5' },
  git: null,
};

export function bundle(runId, bytes, overrides = {}) {
  return {
    schemaVersion: 1,
    runId,
    adapter: 'vite',
    target: 'client',
    toolVersions: { vite: '8.3.5' },
    capabilities: { modules: 'partial', routes: 'unavailable', compression: 'unavailable' },
    completeness: { status: 'complete', diagnostics: [] },
    assets: [
      {
        id: 'shared.js',
        kind: 'js',
        modules: [],
        sizes: {
          emittedBytes: bytes,
          parsedBytes: null,
          gzipBytes: null,
          brotliBytes: null,
          transferBytes: null,
        },
      },
    ],
    entrypoints: { 'index.html': { initial: ['shared.js'], asynchronous: [] } },
    compression: null,
    ...overrides,
  };
}

export async function bundleRun(store, bytes, options = {}) {
  const session = await store.create({ ...metadata, ...options.metadata });
  await session.writeJSON(
    'normalized/bundle.json',
    bundle(session.manifest.id, bytes, options.snapshot),
  );

  return session.finish(options.status ?? 'complete');
}

export async function syntheticRun(
  store,
  value,
  {
    samples = 3,
    status = 'complete',
    fingerprint = metadata.configFingerprint,
    score = false,
  } = {},
) {
  const session = await store.create({
    ...metadata,
    framework: 'generic',
    toolVersions: { lighthouse: '13.6.0' },
    configFingerprint: fingerprint,
  });
  await session.writeJSON('normalized/synthetic.json', {
    schemaVersion: 1,
    runId: session.manifest.id,
    results: [
      {
        url: 'https://example.test/',
        aggregate: {
          status,
          diagnostics: status === 'partial' ? ['Missing samples'] : [],
          metrics: {
            [score ? 'performance-score' : 'largest-contentful-paint']: {
              unit: score ? 'score' : 'ms',
              direction: score ? 'higher' : 'lower',
              median: value,
              medianAbsoluteDeviation: value === null ? null : 0,
              validSamples: value === null ? 0 : samples,
              attemptedSamples: 3,
            },
          },
        },
      },
    ],
  });

  return session.finish(status);
}

export const validId = () => randomUUID();
