import { reportDocumentSchema, type ReportDocument, type ReportRow } from './report-data.js';
import { budgetResultSchema, type BudgetResult } from './contracts.js';
import {
  budgetFileSchema,
  budgetEvaluationSchema,
  type BudgetRule,
  type BudgetEvaluation,
} from './budget-data.js';

function eligibility(
  report: ReportDocument,
  rule: BudgetRule,
  row: ReportRow | undefined,
): string | null {
  if (!report.comparison.compatible) return 'Comparison profiles are incompatible';
  if (
    !report.baselineComplete ||
    !report.candidateComplete ||
    report.baseline.status !== 'complete' ||
    report.candidate.status !== 'complete'
  )
    return 'Both runs must contain complete measurements';
  if (!row) return 'No measurement matches the budget selector';
  const metric = report.comparison.metrics[row.key]!;
  if (metric.unit !== rule.unit) return 'Budget unit differs from the measurement unit';
  if (metric.baseline === null || metric.candidate === null)
    return 'Baseline or candidate measurement is unknown';
  if (
    rule.group === 'synthetic' &&
    (!row.baselineSamples ||
      !row.candidateSamples ||
      row.baselineSamples.validSamples < 3 ||
      row.candidateSamples.validSamples < 3)
  )
    return 'Synthetic budgets require at least three valid samples per metric on both runs';

  return null;
}

type ComparisonMetric = ReportDocument['comparison']['metrics'][string];

/** Regression in the metric's worsening direction; improvements clamp to zero. */
function regression(change: number, metric: ComparisonMetric): number {
  return Math.max(0, metric.direction === 'lower' ? change : -change);
}

function judge(
  rule: BudgetRule,
  metric: ComparisonMetric,
): { observed: number; pass: boolean; reason: string | null } | { error: string } {
  if (rule.mode === 'absolute') {
    const observed = metric.candidate!;
    const pass = metric.direction === 'lower' ? observed <= rule.limit : observed >= rule.limit;

    return { observed, pass, reason: null };
  }
  if (rule.mode === 'regression-absolute') {
    const observed = regression(metric.absolute!, metric);

    return { observed, pass: observed <= rule.limit, reason: null };
  }
  if (metric.percent === null)
    return { error: 'Percentage regression is unavailable for a zero or unknown baseline' };
  const observed = regression(metric.percent, metric);
  if (observed <= rule.limit) return { observed, pass: true, reason: null };
  const floor = rule.minimumChange;
  if (floor !== undefined && regression(metric.absolute!, metric) <= floor)
    return {
      observed,
      pass: true,
      reason: `Percentage limit exceeded, but the absolute regression is within minimumChange ${floor} ${rule.unit}`,
    };

  return { observed, pass: false, reason: null };
}

function evaluateRule(report: ReportDocument, rule: BudgetRule): BudgetResult {
  const row = report.rows.find(
    (item) =>
      item.group === rule.group && item.subject === rule.subject && item.label === rule.metric,
  );
  const metric = row ? report.comparison.metrics[row.key]! : null;
  const percentMode = rule.mode === 'regression-percent';
  const direction = rule.mode === 'absolute' ? (metric?.direction ?? 'lower') : 'lower';
  const base = {
    schemaVersion: 1 as const,
    metric: JSON.stringify([rule.group, rule.subject, rule.metric]),
    unit: percentMode ? ('unitless' as const) : rule.unit,
    direction,
    limit: rule.limit,
  };
  const reason = eligibility(report, rule, row);
  if (reason) return budgetResultSchema.parse({ ...base, observed: null, status: 'error', reason });
  const verdict = judge(rule, metric!);
  if ('error' in verdict)
    return budgetResultSchema.parse({
      ...base,
      observed: null,
      status: 'error',
      reason: verdict.error,
    });

  return budgetResultSchema.parse({
    ...base,
    observed: verdict.observed,
    status: verdict.pass ? 'pass' : 'fail',
    reason: verdict.pass ? verdict.reason : 'Observed value violates the configured limit',
  });
}

/** Same stored comparison model as the report. Errors dominate violations; unknowns never pass. */
export function evaluateBudgets(reportInput: unknown, fileInput: unknown): BudgetEvaluation {
  const report = reportDocumentSchema.parse(reportInput);
  const file = budgetFileSchema.parse(fileInput);
  const results = file.budgets.map((rule) => ({ rule, result: evaluateRule(report, rule) }));
  let status: BudgetEvaluation['status'] = 'pass';
  if (results.some((entry) => entry.result.status === 'fail')) status = 'fail';
  if (results.some((entry) => entry.result.status === 'error')) status = 'error';

  return budgetEvaluationSchema.parse({
    schemaVersion: 1,
    comparisonId: report.comparison.id,
    status,
    results,
  });
}
