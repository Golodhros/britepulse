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

Selectors match the report row's group, subject and label exactly. Use the saved `report.json` to discover selectors. Bundle selectors include `All exported assets` and entrypoint subjects; synthetic subjects are collected URLs. Units must match the measurement. A file must contain at least one rule; duplicate selectors with the same mode are rejected.

`mode` defaults to `absolute`. Absolute rules compare the candidate to an inclusive maximum for lower-is-better metrics, or an inclusive minimum for higher-is-better metrics. Performance scores use the fractional 0–1 scale. Limits are finite and nonnegative.

`regression-percent` uses the unrounded percentage change from baseline, reverses it for higher-is-better metrics, and clamps improvements to zero. The limit is the allowed regression percentage, so `5` means 5%, including score rules. Its result uses `unitless`; the rule still identifies the source unit. A zero baseline produces an error for percentage rules; absolute rules can still evaluate it.

Both runs must be complete and compatible. Missing measurements, missing selectors and mismatched units produce errors. Synthetic rules require at least three valid samples for that metric on each side. Partial Next.js imports therefore cannot pass budgets. Budgets are deterministic limits, not statistical significance tests.

`report --comparison <UUID> --output report.html --budgets budgets.json` embeds the evaluation beside the measurements. Report export succeeds even when the embedded verdict fails; use `budget` as the CI gate.

Public APIs: `evaluateBudgets(reportDocument, budgetFile)`, `budgetFileSchema`, `budgetEvaluationSchema`, `BudgetRule` and `BudgetEvaluation`. Evaluation contains a comparison ID, aggregate status and each parsed rule/result. Saved comparisons are unchanged.
