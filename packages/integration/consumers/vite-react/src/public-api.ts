import {
  aggregateSyntheticSamples,
  type SyntheticAggregationInput,
  resolveConfig,
  type BundleSnapshot,
  type MetricAggregate,
} from 'britepulse';
import { loadConfig } from 'britepulse/config';
import { britepulse } from 'britepulse/vite';
const config = resolveConfig({
  schemaVersion: 1,
  environments: { local: { urls: ['http://localhost:3000/'] } },
});
const count: number = config.synthetic.runs;
const target: BundleSnapshot['target'] = 'client';
const unit: MetricAggregate['unit'] = 'ms';
// @ts-expect-error Snapshot targets cannot be arbitrary framework names.
const invalidTarget: BundleSnapshot['target'] = 'react';
// @ts-expect-error Units cannot silently change to arbitrary display labels.
const invalidUnit: MetricAggregate['unit'] = 'kilobytes';
// @ts-expect-error Integration options must match the published declaration.
britepulse({ missingOption: true });
export { count, target, unit, invalidTarget, invalidUnit, loadConfig };

const aggregationInput: SyntheticAggregationInput = {
  url: 'https://example.com/',
  expectedSamples: 3,
  metrics: { lcp: { unit: 'ms', direction: 'lower' } },
  samples: [],
};
const aggregationStatus: 'complete' | 'partial' =
  aggregateSyntheticSamples(aggregationInput).status;
// @ts-expect-error Metric directions must use the public measurement vocabulary.
const invalidDirection: SyntheticAggregationInput['metrics'][string]['direction'] = 'faster';
export { aggregationStatus, invalidDirection };

import { scheduleSyntheticSamples, type SyntheticRunner, type SyntheticSchedule } from 'britepulse';
const schedule: SyntheticSchedule = { url: 'https://example.com/', runs: 1 };
const runner: SyntheticRunner = async () => ({
  status: 'success',
  metrics: {},
  error: null,
  reports: { json: null, html: null },
});
const scheduledSamples = scheduleSyntheticSamples(schedule, runner);
// @ts-expect-error Runner results must include the artifact/error contract.
const invalidRunner: SyntheticRunner = async () => ({ status: 'success', metrics: {} });
export { scheduledSamples, invalidRunner };

import {
  normalizeLighthouseReport,
  lighthouseMetricDefinitions,
  type LighthouseReportContext,
} from 'britepulse';
const reportContext: LighthouseReportContext = {
  url: 'https://example.com/',
  reports: { json: null, html: null },
};
const layoutShiftUnit: 'unitless' = lighthouseMetricDefinitions['cumulative-layout-shift'].unit;
const lighthouseNormalizer: typeof normalizeLighthouseReport = normalizeLighthouseReport;
// @ts-expect-error Artifact references cannot be numeric paths.
const invalidReportContext: LighthouseReportContext['reports']['json'] = 1;
export { reportContext, layoutShiftUnit, lighthouseNormalizer, invalidReportContext };

import { measureProject } from 'britepulse';
const experimentalCollector: typeof measureProject = measureProject;
export { experimentalCollector };

import { normalizeNextPagesBundle, importNextPagesBundle } from 'britepulse';
export { normalizeNextPagesBundle, importNextPagesBundle };

import { compareRuns, exportComparisonReport, type ReportDocument } from 'britepulse';
const reportSchemaVersion: ReportDocument['schemaVersion'] = 1;
export { compareRuns, exportComparisonReport, reportSchemaVersion };

import {
  evaluateBudgets,
  budgetFileSchema,
  budgetEvaluationSchema,
  type BudgetRule,
  type BudgetEvaluation,
} from 'britepulse';
const budgetRule: BudgetRule = {
  group: 'bundle',
  subject: 'All exported assets',
  metric: 'JS emittedBytes',
  unit: 'bytes',
  mode: 'absolute',
  limit: 250000,
};
const budgetStatus: BudgetEvaluation['status'] = 'error';
export { evaluateBudgets, budgetFileSchema, budgetEvaluationSchema, budgetRule, budgetStatus };
