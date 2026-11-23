import { z } from 'zod';
import {
  directionSchema,
  metricAggregateSchema,
  syntheticSampleSchema,
  unitSchema,
  type MetricAggregate,
  type SyntheticSample,
} from './contracts.js';
import { httpUrl, nonempty, parseValidated } from './validation.js';

const aggregationInput = z.strictObject({
  url: httpUrl,
  expectedSamples: z.number().int().positive(),
  metrics: z
    .record(nonempty, z.strictObject({ unit: unitSchema, direction: directionSchema }))
    .refine((metrics) => Object.keys(metrics).length > 0, 'At least one metric is required'),
  samples: z.array(syntheticSampleSchema),
});

export type SyntheticAggregationInput = z.infer<typeof aggregationInput>;
export interface SyntheticAggregation {
  status: 'complete' | 'partial';
  diagnostics: string[];
  metrics: Record<string, MetricAggregate>;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle]!;

  // Avoid overflow when both central values are large finite numbers.
  const lower = sorted[middle - 1]!;

  return lower + (sorted[middle]! - lower) / 2;
}

/** Aggregate one URL/profile. Failed measured retries count as attempts, never as values. */
export function aggregateSyntheticSamples(input: SyntheticAggregationInput): SyntheticAggregation {
  const { url, expectedSamples, metrics, samples } = parseValidated(
    aggregationInput,
    input,
    'Invalid synthetic aggregation',
  );
  validateSampleIdentity(samples, url);
  const measured = samples.filter((sample) => !sample.warmup);
  const successful = measured.filter((sample) => sample.status === 'success');
  if (successful.length > expectedSamples)
    throw new Error('Successful measured samples exceed the requested count');
  const diagnostics: string[] = [];
  if (successful.length !== expectedSamples)
    diagnostics.push(
      `Collected ${successful.length} of ${expectedSamples} successful measured samples`,
    );
  const aggregates: Record<string, MetricAggregate> = Object.create(null);
  for (const [name, definition] of Object.entries(metrics)) {
    const aggregate = aggregateMetric(name, definition, successful, measured.length);
    aggregates[name] = aggregate;
    const count = aggregate.validSamples;
    if (count !== expectedSamples)
      diagnostics.push(`Metric ${name} has ${count} of ${expectedSamples} valid samples`);
  }

  return { status: diagnostics.length ? 'partial' : 'complete', diagnostics, metrics: aggregates };
}

function validateSampleIdentity(samples: SyntheticSample[], url: string): void {
  const ids = new Set<string>();
  const attempts = new Set<number>();
  for (const sample of samples) {
    if (sample.url !== url) throw new Error('Cannot aggregate samples from different URLs');
    if (ids.has(sample.id) || attempts.has(sample.attempt))
      throw new Error('Sample IDs and attempt numbers must be unique');
    ids.add(sample.id);
    attempts.add(sample.attempt);
  }
}

function aggregateMetric(
  name: string,
  definition: SyntheticAggregationInput['metrics'][string],
  successful: SyntheticSample[],
  attemptedSamples: number,
): MetricAggregate {
  const values: number[] = [];
  for (const sample of successful) {
    const metric = sample.metrics[name];
    if (!metric) continue;
    if (metric.unit !== definition.unit) throw new Error(`Incompatible unit for metric ${name}`);
    if (metric.value !== null) values.push(metric.value);
  }
  const center = median(values);

  return metricAggregateSchema.parse({
    ...definition,
    median: center,
    medianAbsoluteDeviation:
      center === null ? null : median(values.map((value) => Math.abs(value - center))),
    validSamples: values.length,
    attemptedSamples,
  });
}
