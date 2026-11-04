import { z } from 'zod';
import {
  httpUrl,
  nonempty,
  parseValidated,
  relativeArtifactPath,
  schemaVersion,
} from './validation.js';

export const unitSchema = z.enum(['ms', 'bytes', 'score', 'unitless']);
export const directionSchema = z.enum(['lower', 'higher']);
const nonnegative = z.number().finite().nonnegative();
const unknownNumber = nonnegative.nullable();
const bytes = z.number().int().nonnegative().nullable();
const id = z.uuid();
const timestamp = z.iso.datetime();
const capability = z.enum(['available', 'partial', 'unavailable']);
export const capabilitiesSchema = z.strictObject({
  modules: capability,
  routes: capability,
  compression: capability,
});
export const completenessSchema = z
  .strictObject({
    status: z.enum(['complete', 'partial', 'unavailable']),
    diagnostics: z.array(nonempty),
  })
  .refine(
    (value) => value.status === 'complete' || value.diagnostics.length > 0,
    'Incomplete data requires a diagnostic',
  );

export const runManifestSchema = z
  .strictObject({
    schemaVersion,
    id,
    label: nonempty,
    createdAt: timestamp,
    finishedAt: timestamp.nullable(),
    status: z.enum(['running', 'complete', 'partial', 'failed', 'cancelled']),
    environment: nonempty,
    framework: z.enum(['vite', 'nextjs']),
    configFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    toolVersions: z.record(nonempty, nonempty),
    git: z
      .strictObject({
        commit: nonempty.nullable(),
        branch: nonempty.nullable(),
        dirty: z.boolean(),
      })
      .nullable(),
    identity: z
      .strictObject({ deployment: nonempty.optional(), build: nonempty.optional() })
      .optional(),
    artifacts: z.array(relativeArtifactPath),
    diagnostics: z.array(nonempty),
  })
  .refine(
    (run) => (run.status === 'running' ? run.finishedAt === null : run.finishedAt !== null),
    'Only running runs have a null finishedAt',
  )
  .refine(
    (run) => run.finishedAt === null || Date.parse(run.finishedAt) >= Date.parse(run.createdAt),
    'finishedAt cannot precede createdAt',
  );

export const syntheticSampleSchema = z
  .strictObject({
    schemaVersion,
    id,
    url: httpUrl,
    attempt: z.number().int().positive(),
    warmup: z.boolean(),
    status: z.enum(['success', 'failed']),
    metrics: z.record(nonempty, z.strictObject({ value: unknownNumber, unit: unitSchema })),
    error: nonempty.nullable(),
    reports: z.strictObject({
      json: relativeArtifactPath.nullable(),
      html: relativeArtifactPath.nullable(),
    }),
  })
  .refine(
    (sample) => (sample.status === 'failed' ? sample.error !== null : sample.error === null),
    'Failed attempts require an error; successful attempts must not have one',
  );

export const metricAggregateSchema = z
  .strictObject({
    unit: unitSchema,
    direction: directionSchema,
    median: unknownNumber,
    medianAbsoluteDeviation: unknownNumber,
    validSamples: z.number().int().nonnegative(),
    attemptedSamples: z.number().int().nonnegative(),
  })
  .refine(
    (metric) => metric.validSamples <= metric.attemptedSamples,
    'Valid samples cannot exceed attempted samples',
  )
  .refine(
    (metric) =>
      metric.validSamples === 0
        ? metric.median === null && metric.medianAbsoluteDeviation === null
        : metric.median !== null && metric.medianAbsoluteDeviation !== null,
    'Unknown aggregates require zero valid samples',
  );

export const assetSizesSchema = z.strictObject({
  emittedBytes: bytes,
  parsedBytes: bytes,
  gzipBytes: bytes,
  brotliBytes: bytes,
  transferBytes: bytes,
});
export const bundleSnapshotSchema = z
  .strictObject({
    schemaVersion,
    runId: id,
    adapter: z.enum(['vite', 'next-webpack', 'next-turbopack']),
    target: z.enum(['client', 'ssr']),
    toolVersions: z.record(nonempty, nonempty),
    capabilities: capabilitiesSchema,
    completeness: completenessSchema,
    assets: z.array(
      z.strictObject({
        id: relativeArtifactPath,
        kind: z.enum(['js', 'css', 'other']),
        sizes: assetSizesSchema,
        modules: z.array(nonempty),
      }),
    ),
    entrypoints: z.record(
      nonempty,
      z.strictObject({
        initial: z.array(relativeArtifactPath),
        asynchronous: z.array(relativeArtifactPath),
      }),
    ),
    compression: z
      .strictObject({
        gzipLevel: z.number().int().min(0).max(9),
        brotliQuality: z.number().int().min(0).max(11),
      })
      .nullable(),
  })
  .superRefine((snapshot, context) => {
    const assetIds = new Set(snapshot.assets.map((asset) => asset.id));
    if (assetIds.size !== snapshot.assets.length)
      context.addIssue({
        code: 'custom',
        message: 'Asset identifiers must be unique',
        path: ['assets'],
      });
    for (const [name, entry] of Object.entries(snapshot.entrypoints)) {
      const all = [...entry.initial, ...entry.asynchronous];
      if (new Set(all).size !== all.length)
        context.addIssue({
          code: 'custom',
          message: 'Entrypoint assets must be deduplicated across initial and asynchronous sets',
          path: ['entrypoints', name],
        });
      if (all.some((assetId) => !assetIds.has(assetId)))
        context.addIssue({
          code: 'custom',
          message: 'Missing assets must have an explicit unknown-size asset record',
          path: ['entrypoints', name],
        });
    }
    if (
      snapshot.compression === null &&
      snapshot.assets.some(
        (asset) => asset.sizes.gzipBytes !== null || asset.sizes.brotliBytes !== null,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Compressed sizes require a named compression configuration',
        path: ['compression'],
      });
  });

const deltaSchema = z
  .strictObject({
    unit: unitSchema,
    direction: directionSchema,
    baseline: unknownNumber,
    candidate: unknownNumber,
    absolute: z.number().finite().nullable(),
    percent: z.number().finite().nullable(),
  })
  .refine((delta) => {
    if (delta.baseline === null || delta.candidate === null)
      return delta.absolute === null && delta.percent === null;
    return delta.baseline !== 0 || delta.percent === null;
  }, 'Missing measurements and zero baselines must not create fabricated deltas');
export const comparisonSchema = z
  .strictObject({
    schemaVersion,
    id,
    baselineId: id,
    candidateId: id,
    compatible: z.boolean(),
    diagnostics: z.array(nonempty),
    metrics: z.record(nonempty, deltaSchema),
  })
  .refine(
    (comparison) =>
      comparison.compatible ||
      Object.values(comparison.metrics).every(
        (delta) => delta.absolute === null && delta.percent === null,
      ),
    'Incompatible runs cannot have numeric deltas',
  );
export const budgetResultSchema = z
  .strictObject({
    schemaVersion,
    metric: nonempty,
    unit: unitSchema,
    direction: directionSchema,
    status: z.enum(['pass', 'fail', 'error']),
    limit: nonnegative,
    observed: unknownNumber,
    reason: nonempty.nullable(),
  })
  .refine(
    (budget) => budget.observed !== null || budget.status === 'error',
    'Missing measurements cannot pass or fail a budget',
  )
  .refine(
    (budget) => budget.status !== 'error' || budget.reason !== null,
    'Budget errors require a reason',
  );

export type RunManifest = z.infer<typeof runManifestSchema>;
export type SyntheticSample = z.infer<typeof syntheticSampleSchema>;
export type MetricAggregate = z.infer<typeof metricAggregateSchema>;
export type BundleSnapshot = z.infer<typeof bundleSnapshotSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type BudgetResult = z.infer<typeof budgetResultSchema>;
export function parseRunManifest(input: unknown): RunManifest {
  return parseValidated(runManifestSchema, input, 'Invalid run manifest');
}
export function parseBundleSnapshot(input: unknown): BundleSnapshot {
  return parseValidated(bundleSnapshotSchema, input, 'Invalid bundle snapshot');
}
