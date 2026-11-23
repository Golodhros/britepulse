# CI budget reference

Reference · [Documentation home](README.md)

`britepulse budget --comparison <UUID> --budgets <JSON file> [--output <new JSON file>] [--config <path>] [--json]` evaluates the saved comparison. It prints JSON and optionally writes the same evaluation outside immutable history, refusing to overwrite an existing file. Paths supplied on the command line are relative to the working directory.

Exit codes: **0** all rules pass; **1** at least one violation; **2** any measurement/configuration error. Errors take precedence over violations. Malformed configuration reports an error on stderr; evaluated rules include individual reasons in JSON. The command does not collect or build an application.

```json
{
  "schemaVersion": 1,
  "budgets": [
    {
      "group": "bundle",
      "subject": "All exported assets",
      "metric": "JS emittedBytes",
      "unit": "bytes",
      "mode": "absolute",
      "limit": 250000
    },
    {
      "group": "synthetic",
      "subject": "https://example.com/",
      "metric": "largest-contentful-paint",
      "unit": "ms",
      "mode": "regression-percent",
      "limit": 5
    }
  ]
}
```

Selectors match the report row's group, subject and label exactly. Use the saved `report.json` to discover selectors. Bundle selectors include `All exported assets` and entrypoint subjects; synthetic subjects are collected URLs. Units must match the measurement. A file must contain at least one rule; duplicate selectors with the same mode are rejected. Use separate rules to combine modes: every rule must pass.

`mode` defaults to `absolute`. Absolute rules compare the candidate to an inclusive maximum for lower-is-better metrics, or an inclusive minimum for higher-is-better metrics. Performance scores use the fractional 0–1 scale. Limits are finite and nonnegative.

`regression-absolute` uses the unrounded change in the source unit, reversed for higher-is-better metrics and clamped so improvements report zero. The limit is the allowed regression in that unit, for example `10240` bytes or `0.05` score. Score limits use the fractional 0–1 scale. A zero baseline can be evaluated.

`regression-percent` uses the unrounded percentage change from baseline, reverses it for higher-is-better metrics, and clamps improvements to zero. The limit is the allowed regression percentage, so `5` means 5%, including score rules. Its result uses `unitless`; the rule still identifies the source unit. A zero baseline produces an error for percentage rules; absolute rules can still evaluate it.

Percentage rules accept an optional `minimumChange` noise floor in the source unit. When the percentage limit is exceeded but the absolute regression is at most `minimumChange`, the rule passes and its `reason` explains why. For example, `{ "mode": "regression-percent", "limit": 5, "minimumChange": 2048 }` fails only when JS grows by more than 5% and more than 2048 bytes. `minimumChange` is rejected on other modes and does not rescue a zero baseline.

Both runs must be complete and compatible. Missing measurements, missing selectors and mismatched units produce errors. Synthetic rules require at least three valid samples for that metric on each side. Partial Next.js imports therefore cannot pass budgets. Budgets are deterministic limits, not statistical significance tests.

`report --comparison <UUID> --output report.html --budgets budgets.json` embeds the evaluation beside the measurements. Report export succeeds even when the embedded verdict fails; use `budget` as the CI gate.

Public APIs: `evaluateBudgets(reportDocument, budgetFile)`, `budgetFileSchema`, `budgetEvaluationSchema`, `BudgetRule` and `BudgetEvaluation`. Evaluation contains a comparison ID, aggregate status and each parsed rule/result. Saved comparisons are unchanged.
