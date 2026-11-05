import { z } from 'zod';
import { comparisonSchema, metricAggregateSchema, runManifestSchema } from './contracts.js';
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
