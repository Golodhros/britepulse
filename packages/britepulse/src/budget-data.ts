import { z } from 'zod';
import { budgetResultSchema, unitSchema } from './contracts.js';
import { nonempty, schemaVersion } from './validation.js';

export const budgetRuleSchema = z
  .strictObject({
    group: z.enum(['bundle', 'synthetic']),
    subject: nonempty,
    metric: nonempty,
    unit: unitSchema,
    mode: z.enum(['absolute', 'regression-percent', 'regression-absolute']).default('absolute'),
    limit: z.number().finite().nonnegative(),
    /** Source-unit noise floor: a percentage violation within this absolute regression passes. */
    minimumChange: z.number().finite().nonnegative().optional(),
  })
  .refine(
    (rule) => rule.mode === 'regression-percent' || rule.unit !== 'score' || rule.limit <= 1,
    'Score limits outside percentage rules use the fractional 0–1 scale',
  )
  .refine(
    (rule) => rule.minimumChange === undefined || rule.mode === 'regression-percent',
    'minimumChange applies only to regression-percent rules',
  )
  .refine(
    (rule) => rule.unit !== 'score' || (rule.minimumChange ?? 0) <= 1,
    'Score minimumChange uses the fractional 0–1 scale',
  );
export const budgetFileSchema = z
  .strictObject({ schemaVersion, budgets: z.array(budgetRuleSchema).min(1) })
  .refine(
    (file) =>
      new Set(
        file.budgets.map((rule) =>
          JSON.stringify([rule.group, rule.subject, rule.metric, rule.mode]),
        ),
      ).size === file.budgets.length,
    'Budget selectors and modes must be unique',
  );
const entrySchema = z.strictObject({ rule: budgetRuleSchema, result: budgetResultSchema });
export const budgetEvaluationSchema = z
  .strictObject({
    schemaVersion,
    comparisonId: z.uuid(),
    status: z.enum(['pass', 'fail', 'error']),
    results: z.array(entrySchema).min(1),
  })
  .superRefine((evaluation, context) => {
    const statuses = evaluation.results.map((entry) => entry.result.status);
    let expected = 'pass';
    if (statuses.includes('fail')) expected = 'fail';
    if (statuses.includes('error')) expected = 'error';
    if (evaluation.status !== expected)
      context.addIssue({ code: 'custom', message: 'Evaluation status must reflect every result' });
    for (const { rule, result } of evaluation.results) {
      if (
        result.limit !== rule.limit ||
        result.metric !== JSON.stringify([rule.group, rule.subject, rule.metric])
      )
        context.addIssue({ code: 'custom', message: 'Budget result must match its rule' });
      const unit = rule.mode === 'regression-percent' ? 'unitless' : rule.unit;
      if (result.unit !== unit)
        context.addIssue({
          code: 'custom',
          message: 'Budget result unit differs from its rule mode',
        });
    }
  });
export type BudgetRule = z.infer<typeof budgetRuleSchema>;
export type BudgetEvaluation = z.infer<typeof budgetEvaluationSchema>;
