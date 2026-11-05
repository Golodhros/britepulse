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

## Iteration 4 Local history and process lifecycle

Implemented UUID run directories, atomic metadata and artifact writes, immutable artifact names, serialized per-run writes, explicit final states, robust discovery, unique comparison directories, temporary workspaces, collection lifecycle handling, and asynchronous shell-free child processes.

Review findings and cleanup:

- Prevented a queued write/finalization race from dropping artifact references.
- Made failed writes incompatible with a complete run; callers can finalize a partial or failed state instead.
- Restricted session construction to the store boundary and return cloned manifests to avoid external mutation.
- Reused one atomic JSON writer for manifests and comparisons.
- Rejected traversal, symlinked artifact directories and manifest ID mismatches.
- Kept storage independent of process policy; a separate orchestration module maps collection errors to terminal states.
- Added forced process-group cleanup after interruption, including when the immediate child exits before its descendants.

Validation: 35 tests pass, including concurrent same-label runs, artifact races and duplicate writes, malformed history, timestamp sorting, terminal state persistence, temporary cleanup, comparison identity, literal shell metacharacters, timeouts, cancellation, spawn errors and output callback failures.

## Iteration 5 Project setup and command shell

Implemented Clack guided setup, automatic Vite/Next.js detection with explicit ambiguous-case handling, noninteractive init, doctor and history commands, per-setting overrides, command-specific parsing and JSON output.

Review findings and cleanup:

- Shared initialization and inspection logic between the terminal menu and direct commands.
- Kept human presentation in Clack and made direct commands emit structured JSON; redirected input cannot accidentally enter prompts.
- Used exclusive configuration creation and tested concurrent initialization to preserve existing settings.
- Kept doctor read-only: it checks installed metadata, paths and optional authentication hook existence without executing application code, builds or browser launches.
- Reported unvalidated tool versions as compatibility warnings rather than claiming support.
- Kept comparison/baseline selection pending until the comparison feature has real stored data to use.

Validation: 41 tests pass. End-to-end CLI tests exercise setup, overrides, missing required inputs, unknown options and empty history. A manual CLI smoke check against the actual Vite fixture detects Vite 8.3.5, preserves an overridden run count and lists empty local history without creating a run.

## Iteration 6 Production Vite artifacts and history import

Implemented the optional `britepulse/vite` production plugin, exact emitted sizes, manifest CSS relationships, graph closure, multiple entrypoints, explicit client/SSR targets, optional compression estimates and `analyze --artifact` history import.

Review findings and cleanup:

- Kept graph traversal pure and independent of Vite, filesystem storage and presentation.
- Used the same snapshot contract at production collection and import boundaries; source build identity is retained separately from the local run ID.
- Preserved static/async deduplication, unknown references and missing CSS attribution.
- Kept Vite an optional peer loaded only through its integration subpath.
- Refused artifact filename collisions and multiple output formats sharing a directory.
- Preserved partial snapshot status when finalizing a local run.

Validation: 46 tests pass, including actual production builds with multiple HTML entrypoints, static/shared/lazy JS, initial and lazy CSS, compression, custom output directories, SSR separation, disabled manifests and filename collisions. Each emitted size is checked against the corresponding file on disk; candidate changes are imported into distinct local history entries.

## Iteration 7 Consumer integration package

Added private `@britepulse/integration`, following Britecharts' consumer-package pattern. Fresh CLI-only and Vite React consumers install the production tarball and test installed binaries, public runtime/type exports, report assets and real client/SSR workflows. The root `test:integration` command owns the complete pipeline; `test:package` delegates to its packaging subset.

Review findings and cleanup:

- Staged consumers into ignored artifacts with independent pnpm workspaces. Tests assert installed package paths stay inside the consumer, so workspace links cannot hide packaging errors.
- Recreated installations on every full run to prevent stale tarballs with unchanged version numbers from passing.
- Exercised public CLI output and files on disk without importing workspace implementation modules or using implementation parsers to validate their own output.
- Tested same-label baseline/candidate imports, exact byte sizes, lazy CSS, compression estimates, expected dependency growth, invalid schema rejection and explicit SSR target selection.
- Consolidated the old standalone package smoke test into the integration package while preserving its root command alias.
- Added the dependency-free integration workspace importer explicitly after pnpm's normal and lockfile-only installs omitted it; frozen-lockfile installation now passes.
- Added a separate CI integration job for Node 22.19.0 and Node 26. Local execution uses Node 26.9.0; the CI matrix itself has not been run here.

Validation: the complete fresh pack/install/test pipeline and its 11 integration checks pass locally. Strict consumer TypeScript compilation includes root, config and Vite exports. Browser dashboard interaction and live Lighthouse collection remain outside this suite until those runtime features are available.

## Iteration 8 SonarJS linting and architecture cleanup

Added ESLint-compatible `eslint-plugin-sonarjs` 4.2.2 and enabled its recommended rules across source, scripts, tests and consumer templates. The initial run reported 17 findings.

Review findings and cleanup:

- Split CLI dispatch into focused command handlers and separated terminal presentation for doctor and history.
- Extracted Vite collection from plugin lifecycle and artifact writing, with focused helpers for emitted sizes, imports, entrypoints and manifest relationships.
- Shared asset-kind classification between emitted and unresolved graph assets, including `.mjs` regression coverage.
- Removed nested conditionals/templates while preserving deterministic fingerprint ordering, failure status handling and sample dashboard values.
- Made invalid-path tests use ordinary absolute paths or their owned temporary directory; no publicly writable directory literal is needed to exercise rejection.
- Changed the startup integration test to assert the imported public API directly in addition to subprocess success.
- Scoped one documented rule exception to the four deliberately bloated candidate fixtures. Their whole-Lodash imports are regression inputs; replacing them with subpath imports would remove the bundle-growth behavior being tested. No production SonarJS rule is disabled.

Validation: zero ESLint findings, 46 core/fixture tests, 11 clean-tarball consumer integration checks, strict typechecks, formatting, production builds through prepack, peer dependency checks and frozen-lockfile installation pass.

## Iteration 9 Repository development skills

Added a repository-local `.agents/skills` catalog and an `AGENTS.md` entrypoint, adapted from Britecharts to BritePulse's actual tooling and boundaries. The familiar audit, code, architecture, style and quality workflows are joined by Node unit-test, installed-consumer integration-test and report-view skills.

Review findings and cleanup:

- Centralized review scoping so staged, unstaged, untracked and task-committed changes are accounted for, including work performed directly on main.
- Replaced Vitest/source-alias and Storybook assumptions with Node tests against compiled output, isolated tarball consumers, and the existing Vite/Shadcn/Britecharts report application.
- Preserved the implement-review-cleanup loop without adding approval gates, mandatory delegation, invented scripts or unrelated full-suite checks for documentation-only work.
- Linked maintained manifests and domain documents rather than copying version pins, test counts or the whole implementation plan into every skill.
- Distinguished schemas, experiments and sample views from shipping measurement/comparison/report capabilities. Updated stale README next-work wording to match the actual implementation.

Validation: all eight skills pass the skill-creator frontmatter/scaffold validator; all local instruction links resolve; the new Markdown passes Prettier and the diff has no whitespace errors. Reviewed routing for core tests, installed Vite consumers, committed changes on main and documentation-only audits. Runtime code and dependencies are unchanged, so unit and integration suites were not rerun for this documentation-only change.
