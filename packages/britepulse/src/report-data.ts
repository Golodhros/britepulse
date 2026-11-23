import { z } from 'zod';
import { comparisonSchema, metricAggregateSchema, runManifestSchema } from './contracts.js';
import { budgetEvaluationSchema } from './budget-data.js';
import { nonempty, schemaVersion } from './validation.js';

export const reportRowSchema = z.strictObject({
  key: nonempty,
  group: z.enum(['synthetic', 'bundle']),
  subject: nonempty,
  label: nonempty,
  baselineSamples: metricAggregateSchema.nullable(),
  candidateSamples: metricAggregateSchema.nullable(),
});
export const reportDocumentSchema = z
  .strictObject({
    schemaVersion,
    baseline: runManifestSchema,
    candidate: runManifestSchema,
    baselineComplete: z.boolean(),
    candidateComplete: z.boolean(),
    comparison: comparisonSchema,
    rows: z.array(reportRowSchema),
    budgets: budgetEvaluationSchema.optional(),
  })
  .superRefine((report, context) => {
    if (
      report.baseline.id !== report.comparison.baselineId ||
      report.candidate.id !== report.comparison.candidateId
    )
      context.addIssue({
        code: 'custom',
        message: 'Report run identities must match the comparison',
      });
    if (report.budgets && report.budgets.comparisonId !== report.comparison.id)
      context.addIssue({
        code: 'custom',
        message: 'Budget evaluation must match the report comparison',
      });
    for (const row of report.rows) {
      const metric = report.comparison.metrics[row.key];
      if (row.key !== JSON.stringify([row.group, row.subject, row.label]))
        context.addIssue({ code: 'custom', message: 'Report selector must match its metric key' });
      if (!metric) continue;
      for (const [sample, median] of [
        [row.baselineSamples, metric.baseline],
        [row.candidateSamples, metric.candidate],
      ] as const) {
        if (
          sample &&
          (sample.median !== median ||
            sample.unit !== metric.unit ||
            sample.direction !== metric.direction)
        )
          context.addIssue({
            code: 'custom',
            message: 'Sample metadata must match its comparison measurement',
          });
      }
    }
    const keys = report.rows.map((row) => row.key);
    if (
      new Set(keys).size !== keys.length ||
      keys.length !== Object.keys(report.comparison.metrics).length ||
      keys.some((key) => !Object.hasOwn(report.comparison.metrics, key))
    )
      context.addIssue({
        code: 'custom',
        message: 'Report rows must match comparison metric keys exactly',
      });
  });
export type ReportDocument = z.infer<typeof reportDocumentSchema>;
export type ReportRow = z.infer<typeof reportRowSchema>;
