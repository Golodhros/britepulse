# Implementation progress

## Scaffold

Committed as `5280984`. Vite React dashboard, Shadcn Card, Britecharts sample charts, Clack shell and pnpm workspace. Dashboard production build, strict TypeScript checks and three CLI tests passed.

## Iteration 1 Compatibility fixtures

Implemented baseline/candidate Vite, Next.js Pages Router and App Router fixtures, a BundleStats/thin-plugin comparison, native Turbopack graph probe, and a public/authenticated synthetic server and paired Lighthouse probe.

Review findings and cleanup:

- Kept every fixture private and raw output ignored; only public fixture source is tracked.
- Extracted duplicated Next.js stats configuration into one fixture helper.
- Validated candidate deltas and shared asset overlap rather than merely checking build success.
- Preserved emitted CSS evidence after finding an incomplete BundleStats initial-CSS summary.
- Pinned Vite to 8.3.5 to satisfy BundleStats' peer requirement.
- Isolated each synthetic run and cleaned generated native analysis directories to avoid stale artifacts.
- Kept native analysis and App Router route capabilities partial; successful export is not proof of correct production size attribution.

Validation: all six production fixture builds passed. Artifact checks detect +70,957 JS bytes for Vite and +70,017 for each Next.js Webpack fixture. Native baseline/candidate graph exports detect the added lodash dependency. The synthetic server has three request-handler tests; live paired collection remains blocked by loopback permissions. Broader framework and runner support remains open.

## Iteration 2 Installable package boundary

Implemented compiled strict TypeScript ESM, lazy interactive imports, package exports, help/version, prebuilt report packaging, ESLint, Prettier, and CI. All fixture packages remain private; the CLI also remains private while its release API is under development.

Review findings and cleanup:

- Moved Clack behind the interactive branch so noninteractive commands have no UI dependency startup cost.
- Removed the source-only executable and made the installed bin target compiled output.
- Made one build script own report compilation, core compilation, report asset copying and package metadata files.
- Limited tarball contents to compiled output, license and README. Kept browser dependencies in the report package.
- Raised the documented Node floor to 22.19 based on Lighthouse's fixture engine requirement.
- Added a clean consumer verification that blocks UI and measurement imports during help/version execution.
- Kept the Vite subpath deferred until an actual adapter exists, rather than publishing a placeholder export.

Validation: strict TypeScript checks, lint, seven tests and production dashboard/core builds pass. A tarball was installed into a clean consumer; installed executable version/help and packaged report checks passed, including with UI imports blocked. Network-restricted shell installs use a separate approved install step with the same package verifier. CI runs the full package smoke test in one command.

## Iteration 3 Configuration and result contracts

Implemented a versioned JSON configuration loader, precedence and path resolution, stable configuration fingerprints, runtime schemas and inferred types for manifests, samples, aggregates, bundles, comparisons and budgets.

Review findings and cleanup:

- Removed schema defaults from the override layer after tests exposed sibling settings being reset. Defaults now apply only to project/resolved settings.
- Kept checkout and storage paths out of the measurement fingerprint; canonical object ordering makes equivalent settings stable.
- Kept unknown values nullable, required diagnostic reasons for incomplete data, and rejected duplicate/overlapping entrypoint assets.
- Added timestamp lifecycle checks and traversal-free artifact references at the contract boundary.
- Kept measurement computation and filesystem operations outside the schema module.

Validation: tests cover precedence, invalid values and schema versions, file/path resolution, fingerprint stability, nullable snapshot round trips, sample counts, nonfinite and negative values, entrypoint accounting, failed samples, lifecycle timestamps, comparison null/zero cases and unknown-budget outcomes.
