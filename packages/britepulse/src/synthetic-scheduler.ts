import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { configSchema } from './config.js';
import { syntheticSampleSchema, type SyntheticSample } from './contracts.js';
import { httpUrl, parseValidated } from './validation.js';

const scheduleSchema = z.strictObject({
  url: httpUrl,
  ...configSchema.shape.synthetic.unwrap().pick({ runs: true, warmups: true, retries: true }).shape,
});
const outcomeSchema = z.strictObject({
  status: syntheticSampleSchema.shape.status,
  metrics: syntheticSampleSchema.shape.metrics,
  error: syntheticSampleSchema.shape.error,
  reports: syntheticSampleSchema.shape.reports,
});

export interface SyntheticAttempt {
  url: string;
  attempt: number;
  warmup: boolean;
  signal: AbortSignal;
}
export type SyntheticRunner = (attempt: SyntheticAttempt) => Promise<z.infer<typeof outcomeSchema>>;
export type SyntheticSchedule = z.input<typeof scheduleSchema>;
export interface SyntheticScheduleOptions {
  signal?: AbortSignal;
  onSample?: (sample: SyntheticSample) => Promise<void>;
}

/** Adapter contract, persistence or cleanup failure: stop rather than retry navigation. */
export class SyntheticRunnerFatalError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'SyntheticRunnerFatalError';
  }
}

export class SyntheticScheduleError extends Error {
  readonly samples: SyntheticSample[];

  constructor(message: string, samples: SyntheticSample[], cause?: unknown) {
    super(message, { cause });
    this.name = 'SyntheticScheduleError';
    this.samples = structuredClone(samples);
  }
}

function checkCancellation(signal: AbortSignal, samples: SyntheticSample[]): void {
  if (signal.aborted)
    throw new SyntheticScheduleError('Synthetic scheduling cancelled', samples, signal.reason);
}

/** Sequential slots; only failed measured attempts can consume a retry. */
export async function scheduleSyntheticSamples(
  input: SyntheticSchedule,
  runner: SyntheticRunner,
  options: SyntheticScheduleOptions = {},
): Promise<SyntheticSample[]> {
  const settings = parseValidated(scheduleSchema, input, 'Invalid synthetic schedule');
  const signal = options.signal ?? new AbortController().signal;
  const samples: SyntheticSample[] = [];
  const execute = async (warmup: boolean): Promise<SyntheticSample> => {
    checkCancellation(signal, samples);
    let outcome: unknown;
    try {
      outcome = await runner({ url: settings.url, attempt: samples.length + 1, warmup, signal });
    } catch (error) {
      if (error instanceof SyntheticRunnerFatalError) throw error;
      checkCancellation(signal, samples);
      outcome = {
        status: 'failed',
        metrics: {},
        error:
          error instanceof Error ? error.message || error.name : String(error) || 'Runner failed',
        reports: { json: null, html: null },
      };
    }
    const sample = syntheticSampleSchema.parse({
      ...outcomeSchema.parse(outcome),
      schemaVersion: 1,
      id: randomUUID(),
      url: settings.url,
      attempt: samples.length + 1,
      warmup,
    });
    samples.push(sample);
    await options.onSample?.(structuredClone(sample));
    checkCancellation(signal, samples);

    return sample;
  };
  try {
    for (let index = 0; index < settings.warmups; index++) {
      const sample = await execute(true);
      if (sample.status === 'failed') throw new Error('Synthetic warmup failed');
    }
    for (let slot = 0; slot < settings.runs; slot++) {
      for (let retry = 0; retry <= settings.retries; retry++) {
        const sample = await execute(false);
        if (sample.status === 'success') break;
      }
    }
  } catch (error) {
    if (error instanceof SyntheticScheduleError) throw error;
    throw new SyntheticScheduleError(
      `Synthetic scheduling stopped: ${error instanceof Error ? error.message : String(error)}`,
      samples,
      error,
    );
  }

  return samples;
}
