import { readFile } from 'node:fs/promises';
import { parseBundleSnapshot } from './contracts.js';
import type { ResolvedConfig } from './config.js';
import { RunStore } from './store.js';
import { collectRun } from './orchestration.js';

export async function importBundle(
  config: ResolvedConfig,
  artifactPath: string,
  label: string,
  target: 'client' | 'ssr' = 'client',
) {
  const original = await readFile(artifactPath, 'utf8');
  const source = parseBundleSnapshot(JSON.parse(original));
  if (source.adapter !== 'vite' || config.bundle.adapter !== 'vite')
    throw new Error('Bundle import currently supports the Vite adapter only');
  if (source.toolVersions.vite !== '8.3.5')
    throw new Error('Unsupported Vite artifact version; expected Vite 8.3.5');
  if (source.target !== target)
    throw new Error(
      `Artifact target is ${source.target}; select --target ${source.target} explicitly`,
    );
  const { manifest } = await collectRun(
    new RunStore(config.outputDir),
    {
      label,
      environment: config.environment,
      framework: 'vite',
      configFingerprint: config.fingerprint,
      toolVersions: source.toolVersions,
      git: null,
      identity: { build: source.runId },
    },
    async (session) => {
      await session.writeArtifact('original/bundle.json', original);
      await session.writeJSON(
        'normalized/bundle.json',
        parseBundleSnapshot({ ...source, runId: session.manifest.id }),
      );
    },
    {
      status: source.completeness.status === 'complete' ? 'complete' : 'partial',
      diagnostics: source.completeness.diagnostics,
    },
  );

  return manifest;
}
