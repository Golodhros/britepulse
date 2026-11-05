import { z } from 'zod';
import { syntheticSampleSchema, type SyntheticSample } from './contracts.js';
import { httpUrl, nonempty, parseValidated } from './validation.js';

const timingMetric = Object.freeze({ unit: 'ms', direction: 'lower' } as const);
export const lighthouseMetricDefinitions = Object.freeze({
  'first-contentful-paint': timingMetric,
  'largest-contentful-paint': timingMetric,
  'speed-index': timingMetric,
  'total-blocking-time': timingMetric,
  'cumulative-layout-shift': Object.freeze({ unit: 'unitless', direction: 'lower' } as const),
  'performance-score': Object.freeze({ unit: 'score', direction: 'higher' } as const),
});
const reportSchema = z.object({
  lighthouseVersion: z.literal('13.6.0'),
  gatherMode: z.literal('navigation'),
  requestedUrl: httpUrl,
  finalDisplayedUrl: nonempty,
  fetchTime: z.iso.datetime(),
  audits: z.record(z.string(), z.unknown()),
  categories: z.record(z.string(), z.unknown()),
  runtimeError: z.object({ code: nonempty, message: nonempty }).optional(),
  runWarnings: z.array(z.string()).optional(),
});
const contextSchema = z.strictObject({
  url: httpUrl,
  reports: syntheticSampleSchema.shape.reports,
});
const auditSchema = z.object({
  scoreDisplayMode: z.string().optional(),
  numericValue: z.unknown().optional(),
  numericUnit: z.string().optional(),
});
const scoreSchema = z.object({ score: z.number().finite().min(0).max(1).nullable() });
export interface LighthouseReportContext {
  url: string;
  reports: SyntheticSample['reports'];
}
export interface NormalizedLighthouseReport {
  lighthouseVersion: string;
  fetchTime: string;
  finalDisplayedUrl: string;
  diagnostics: string[];
  outcome: Pick<SyntheticSample, 'status' | 'metrics' | 'error' | 'reports'>;
}

function validValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function metricValue(audit: unknown, unit: string): number | null {
  const parsed = auditSchema.safeParse(audit);
  if (!parsed.success) return null;
  const value = parsed.data;
  if (value.scoreDisplayMode !== 'numeric' || !validValue(value.numericValue)) return null;
  if (value.numericUnit !== (unit === 'ms' ? 'millisecond' : unit)) return null;

  return value.numericValue;
}

function reportFailure(report: z.infer<typeof reportSchema>, url: string): string | null {
  if (report.runtimeError) return `${report.runtimeError.code}: ${report.runtimeError.message}`;
  if (!httpUrl.safeParse(report.finalDisplayedUrl).success)
    return 'Lighthouse did not finish on an HTTP(S) URL';
  if (new URL(report.finalDisplayedUrl).href !== new URL(url).href)
    return `Lighthouse finished on a different URL: ${report.finalDisplayedUrl}`;

  return null;
}

/** Normalize only the explicitly supported navigation report version; never parse display strings. */
export function normalizeLighthouseReport(
  input: unknown,
  context: LighthouseReportContext,
): NormalizedLighthouseReport {
  const report = parseValidated(reportSchema, input, 'Invalid Lighthouse report');
  const { url, reports } = parseValidated(
    contextSchema,
    context,
    'Invalid Lighthouse report context',
  );
  if (new URL(report.requestedUrl).href !== new URL(url).href)
    throw new Error('Lighthouse requested URL does not match the scheduled URL');
  const error = reportFailure(report, url);
  const diagnostics = [...(report.runWarnings ?? [])];
  if (error) diagnostics.push(error);
  const metrics: SyntheticSample['metrics'] = {};
  for (const [name, definition] of Object.entries(lighthouseMetricDefinitions)) {
    if (name === 'performance-score') continue;
    const { unit } = definition;
    const value = error ? null : metricValue(report.audits[name], unit);
    metrics[name] = { value, unit };
    if (value === null) diagnostics.push(`Metric ${name} is unavailable`);
  }
  const score = scoreSchema.safeParse(report.categories.performance);
  const value = !error && score.success ? score.data.score : null;
  metrics['performance-score'] = { value, unit: 'score' };
  if (value === null) diagnostics.push('Metric performance-score is unavailable');

  return {
    lighthouseVersion: report.lighthouseVersion,
    fetchTime: report.fetchTime,
    finalDisplayedUrl: report.finalDisplayedUrl,
    diagnostics,
    outcome: { status: error ? 'failed' : 'success', metrics, error, reports },
  };
}
