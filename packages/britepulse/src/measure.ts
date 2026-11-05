import type { ResolvedConfig } from './config.js';
import { RunStore } from './store.js';
import { RunExecutionError } from './orchestration.js';
import { CommandInterruptedError } from './process.js';
import { scheduleSyntheticSamples } from './synthetic-scheduler.js';
import { aggregateSyntheticSamples } from './synthetic-aggregation.js';
import { lighthouseMetricDefinitions } from './lighthouse-report.js';
import { resolveLighthouse, createLighthouseRunner } from './lighthouse-runner.js';

/** Experimental cold-cache collection. Original reports and each sample stay in immutable history. */
export async function measureProject(
  config: ResolvedConfig,
  label: string,
  options: { signal?: AbortSignal } = {},
) {
  if (config.synthetic.cache !== 'cold' || config.synthetic.authHook)
    throw new Error(
      'Experimental measurement supports cold cache without authentication hooks only',
    );
  if (options.signal?.aborted) throw new CommandInterruptedError('cancelled');
  const engine = resolveLighthouse(config.appRoot);
  const session = await new RunStore(config.outputDir).create({
    label,
    environment: config.environment,
    framework: config.bundle.adapter === 'vite' ? 'vite' : 'nextjs',
    configFingerprint: config.fingerprint,
    toolVersions: { lighthouse: '13.6.0', 'chrome-launcher': '1.2.2', node: process.version },
    git: null,
  });
  const diagnostics: string[] = [];
  const results = [];
  try {
    const urls = config.environments[config.environment]!.urls;
    for (const [page, url] of urls.entries()) {
      const samples = await scheduleSyntheticSamples(
        {
          url,
          runs: config.synthetic.runs,
          warmups: config.synthetic.warmups,
          retries: config.synthetic.retries,
        },
        createLighthouseRunner(config, engine, session, page, diagnostics),
        {
          signal: options.signal,
          onSample: async (sample) => {
            if (sample.error) diagnostics.push(`${url} attempt ${sample.attempt}: ${sample.error}`);
            await session.writeJSON(
              `normalized/synthetic/page-${page}/attempt-${sample.attempt}.json`,
              sample,
            );
          },
        },
      );
      const aggregate = aggregateSyntheticSamples({
        url,
        expectedSamples: config.synthetic.runs,
        metrics: lighthouseMetricDefinitions,
        samples,
      });
      diagnostics.push(...aggregate.diagnostics.map((message) => `${url}: ${message}`));
      results.push({ url, aggregate });
    }
    if (options.signal?.aborted) throw new CommandInterruptedError('cancelled');
    await session.writeJSON('normalized/synthetic.json', {
      schemaVersion: 1,
      runId: session.manifest.id,
      results,
    });
    if (options.signal?.aborted) throw new CommandInterruptedError('cancelled');

    return await session.finish(
      results.every((result) => result.aggregate.status === 'complete') ? 'complete' : 'partial',
      diagnostics,
    );
  } catch (error) {
    const failureStatus = session.manifest.artifacts.length ? 'partial' : 'failed';
    const status = options.signal?.aborted ? 'cancelled' : failureStatus;
    const manifest = await session.finish(status, [
      ...diagnostics,
      error instanceof Error ? error.message : String(error),
    ]);
    throw new RunExecutionError(manifest, error);
  }
}
