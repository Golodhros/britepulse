# Configuration and stored contracts

BritePulse reads a JSON configuration file through `loadConfig`, exported from `britepulse/config`. No application code or authentication hook is executed while loading settings. Use `britepulse init --url <URL>` to create settings without overwriting a file, `britepulse doctor` to validate the resolved profile, and `britepulse history` to list local runs. Run `britepulse` in a terminal for guided setup. Direct commands emit JSON and never prompt for missing inputs.

```json
{
  "schemaVersion": 1,
  "appRoot": ".",
  "environment": "local",
  "environments": {
    "local": { "urls": ["http://localhost:3000/", "http://localhost:3000/checkout"] }
  },
  "synthetic": {
    "runs": 3,
    "warmups": 0,
    "retries": 1,
    "timeoutMs": 60000,
    "device": "mobile",
    "cache": "cold"
  },
  "bundle": {
    "adapter": "vite",
    "buildCommand": ["npm", "run", "build"],
    "outputDir": "dist"
  },
  "outputDir": ".britepulse"
}
```

Overrides take precedence over project settings and then defaults. Nested overrides preserve unspecified siblings. A project is validated independently so an override cannot hide an unsupported schema version or misspelled option. URLs require HTTP or HTTPS, including localhost. Numeric inputs are validated without string coercion. The selected environment must exist and contain at least one URL.

`appRoot` and an optional `synthetic.authHook` resolve relative to the configuration file directory. Storage `outputDir`, bundle `outputDir`, and an optional bundle `statsFile` resolve relative to the application root. Without a file path, resolution uses the caller's working directory. Build commands are argument arrays; they will not be passed through a shell by the future orchestrator.

The configuration fingerprint includes selected environment URLs, synthetic settings and bundle settings before absolute path resolution. It ignores storage location and checkout location and uses stable object-key ordering. It records the configured profile, not proof that two measurements ran under identical machine conditions.

## Version 1 result contracts

Runtime Zod schemas and inferred TypeScript types share one definition in `contracts.ts`. Unsupported schema versions fail with a version-specific diagnostic; there are no implicit migrations yet.

- `RunManifest` records a UUID, metadata label, lifecycle timestamps/state, environment, framework, configuration fingerprint, tool versions, Git metadata, artifact paths, diagnostics and optional deployment/build identity.
- `SyntheticSample` retains per-attempt status, warmup marker, metric units and nullable values, diagnostics and original JSON/HTML paths.
- `MetricAggregate` retains per-metric valid and attempted sample counts, median and median absolute deviation. No valid samples means unknown aggregates. Performance scores use the Lighthouse fractional scale; navigation metrics remain distinct from field measurements.
- `BundleSnapshot` identifies the client or SSR target and separates emitted, parsed, gzip, Brotli and measured transfer bytes. Unknown sizes are null. Capabilities and completeness are explicit. Missing references require an asset record with unknown sizes. Entrypoint initial and asynchronous asset sets are deduplicated and disjoint. Module identifiers do not imply module sizes. Compressed sizes require the compression settings used.
- `Comparison` preserves nullable measurements and signed differences. Missing measurements cannot acquire deltas; zero baselines cannot acquire percentages; incompatible profiles cannot acquire numeric deltas.
- `BudgetResult` cannot report a pass or violation for an unknown measurement. It records an error with a reason instead.

These contracts validate serialization boundaries. Per-metric aggregation is available through `aggregateSyntheticSamples`; runner-independent scheduling is available through `scheduleSyntheticSamples`; live collection, comparison calculations and budget evaluation remain separate implementation steps. All report artifact references are relative paths without traversal; local history storage will validate them again at the filesystem boundary.

## Synthetic aggregation API

`aggregateSyntheticSamples({ url, expectedSamples, metrics, samples })` aggregates one URL and measurement profile. The metric definitions specify each unit and improvement direction. Callers must keep profiles separate; sample records alone do not contain the profile fingerprint.

The function excludes warmups and failed attempts from values, retains failed measured attempts in `attemptedSamples`, and computes unrounded per-metric medians and median absolute deviation. Missing or null metrics stay unknown; missing values never become zero. All requested successful samples and all requested per-metric values are required for `complete` status. Partial aggregates retain available values and diagnostics for inspection. Duplicate IDs/attempt numbers, mixed URLs, excess successful samples and incompatible metric units are rejected.

Attempts are numbered uniquely across warmups and measurements for this URL. Retry scheduling must replace failed measured attempts only; the aggregation API does not schedule or validate slot ownership. A complete one- or two-sample aggregate is still insufficient to pass a budget: budget evaluation must require at least three valid samples per metric as well as completeness. This API does not implement budget evaluation or live Lighthouse collection.

## Synthetic scheduling API

`scheduleSyntheticSamples({ url, runs, warmups, retries }, runner, options)` runs one URL sequentially, using the same defaults and bounds as the synthetic configuration. `retries` is the maximum number of replacements per measured slot, not a pool of extra successful measurements. Exhausting a slot's retries leaves it missing and proceeds to the next slot. Failed warmups stop scheduling without retries. Scores and missing metric values never cause retries of a successful attempt.

The runner receives `{ url, attempt, warmup, signal }` and returns `{ status, metrics, error, reports }`. The scheduler assigns sample IDs and monotonically increasing attempt numbers across warmups and measurements, validates returned samples, and retains all settled attempts. Thrown runner errors become failed attempts with unknown reports; return a failed result explicitly when artifacts are available. Invalid results stop scheduling rather than consuming retries.

An optional async `onSample` callback runs after each validated sample and before another attempt starts. Use it to persist samples and their artifact references. A callback failure stops scheduling. The callback receives a copy, so it cannot change aggregation inputs. `SyntheticScheduleError.samples` retains validated samples collected before an error, including a sample whose persistence callback failed; callers must not assume those samples were all persisted.

An optional `signal` prevents new attempts after cancellation and is passed to the runner. The scheduler awaits the active runner and persistence callback so cleanup can finish; runners must honor cancellation, enforce their configured attempt timeout, and clean up browser/process resources before settling. It does not forcibly interrupt an uncooperative runner. Cache policy, authentication, profile isolation and original report persistence remain adapter/caller responsibilities. This API adds no Lighthouse dependency or CLI measurement command.

## Lighthouse report normalization

`normalizeLighthouseReport(report, { url, reports })` converts a Lighthouse 13.6.0 navigation report into a scheduler-compatible `outcome`, with diagnostics, engine version, fetch time and final URL. It does not launch Lighthouse, write artifacts or establish that authentication/cache settings match a configured profile. The caller must preserve original JSON/HTML and supply their relative artifact references, or null when unavailable.

`lighthouseMetricDefinitions` supplies the matching aggregation definitions: first contentful paint, largest contentful paint, speed index and total blocking time in milliseconds; cumulative layout shift as unitless; performance score on Lighthouse's fractional 0–1 scale. Display strings and audit scores are never substituted for numeric measurement values. Missing, nonfinite, negative, error-mode or incompatible-unit values stay null with diagnostics. Missing metrics leave an otherwise successful attempt successful so the scheduler cannot retry it for better data; aggregation reports the resulting partial metric coverage.

Runtime errors produce failed outcomes and discard stale values while retaining report references. The requested URL must match the scheduled URL. An unexpected final URL also produces a failed outcome to avoid silently measuring a login page or another destination. URL checks use canonical URL serialization; configure the expected destination explicitly for redirects. Unsupported versions and non-navigation modes are rejected. Original warnings are retained in diagnostics. These checks cannot establish that the rendered page is authenticated; a same-URL login page requires independent authentication validation.
