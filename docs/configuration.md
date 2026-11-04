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

These contracts validate serialization boundaries. Runner scheduling, median calculation, comparison calculations and budget evaluation remain separate implementation steps. All report artifact references are relative paths without traversal; local history storage will validate them again at the filesystem boundary.
