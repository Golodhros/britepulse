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

## Iteration 10 Oxfmt and function spacing

Replaced the direct Prettier dependency and configuration with Oxfmt. The existing format/format-check commands keep explicit write/check modes, previous quote/width/trailing-comma preferences, and generated-output/lockfile exclusions. ESLint and SonarJS remain the linting workflow.

Review findings and cleanup:

- Added the maintained ESLint Stylistic padding rule for blank lines around function declarations and exports, including exported arrow/function expressions, and before returns when another statement precedes them.
- Applied layout-only fixes and formatting across the repository; the application, fixture and test changes are whitespace-only.
- Kept export lists and unrelated declarations outside the function-specific selectors rather than padding every export indiscriminately.
- Updated agent guidance and active development documentation to Oxfmt, including its default write behavior and the layout-only lint fix command. Historical validation entries retain the formatter used at the time.
- Verified that spacing fixes and Oxfmt converge using function and arrow export examples; Oxfmt preserves the required blank lines and subsequent linting is clean.

Validation: lint, formatting, strict typechecks, 46 existing tests, frozen-lockfile installation and peer dependency checks pass. Production builds and all 11 fresh-tarball integration checks pass. The eight local skills and their instruction links remain valid.

## Iteration 11 Synthetic aggregation foundation

Added the public `aggregateSyntheticSamples` API for a single URL and measurement profile. It computes independent per-metric medians and median absolute deviation, excludes warmups and failed attempts from values, counts measured retries, and preserves missing values with partial diagnostics. It rejects mixed URLs, duplicate sample identities/attempt numbers, excess successes and incompatible units.

Quality review and cleanup:

- Kept aggregation math independent of browser engines, process scheduling, storage and presentation; reused existing input and aggregate validators without changing persisted schemas.
- Split sample identity validation and metric aggregation into focused functions after the initial implementation exceeded the SonarJS complexity limit.
- Used a non-mutating numeric sort compatible with the existing TypeScript target and an overflow-safe midpoint for nonnegative measurements.
- Added cases for independent metric sample counts, fractional scores, missing metrics, zero values, failed retries, warmups, invalid inputs and non-mutation. Installed consumers exercise runtime exports and compile the public input/output types.
- Documented the caller's responsibility to separate profiles and schedule retry slots. Aggregation completeness does not imply budget eligibility; fewer than three valid samples remain insufficient to pass budgets.

Validation: lint, strict typechecks, formatting, the existing core suite plus five aggregation cases, and all 12 fresh-tarball integration checks pass. Production report/core packaging runs through prepack. This milestone does not add live Lighthouse execution, scheduling or budget evaluation; the live browser probe remains unverified because of the previously observed loopback restriction.

## Iteration 12 Synthetic scheduling foundation

Added `scheduleSyntheticSamples`, a sequential runner-independent scheduler using existing configuration defaults and bounds. Warmups precede measured slots; failed measured attempts receive bounded replacements per slot. Exhausted slots remain missing, and successful measurements are never retried based on score or missing metrics. Every validated attempt has a unique ID and increasing attempt number and can be persisted through an awaited callback.

Quality review and cleanup:

- Kept browser ownership, authentication, cache policy and timeouts in the runner/caller boundary; cancellation propagates to the active runner and prevents new attempts while awaiting cleanup.
- Distinguished failed runner attempts from invalid adapter output and persistence failures. The latter stop scheduling rather than consuming retries.
- Retained settled samples on scheduling errors, including an unpersisted sample when its callback fails; documented that error history is not proof of persistence.
- Protected retained sample data from callback mutation and tested integration with per-metric aggregation after an exhausted slot.
- Added eight focused scheduling cases, including cancellation before startup, cancellation during work, cleanup ordering, warmup failure, bounded retries, invalid output and persistence failure. Fixed spacing findings in the added regression tests.

Validation: lint, strict typechecks, formatting and core/fixture tests pass, along with fresh installed-package runtime/type/workflow checks. Production packaging runs through prepack. This is a scheduling API milestone; it does not add a CLI measurement command or validate live Lighthouse collection. Active runner cancellation is cooperative and runner cleanup/timeout enforcement still require browser-adapter evidence.

## Iteration 13 Lighthouse report normalization

Added `normalizeLighthouseReport` and immutable `lighthouseMetricDefinitions` for the pinned Lighthouse 13.6.0 navigation report format. The adapter extracts numeric navigation metrics, unitless layout shift and fractional performance scores into scheduler-compatible outcomes. It retains metadata, diagnostics and supplied original-report references without loading Lighthouse or browser dependencies.

Quality review and cleanup:

- Checked field names, navigation mode, numeric units and score scale against the installed pinned Lighthouse source/types. Tests use public synthetic report objects; they are not captured live browser evidence.
- Preserved missing/error-mode/incompatible-unit/nonfinite measurements as unknown rather than parsing display strings or substituting audit scores. Partial data remains a successful attempt, leaving completeness to aggregation rather than triggering score-driven retries.
- Made runtime errors and unexpected final URLs fail attempts and discard stale values. Requested URLs must match the scheduled URL. Documented the conservative redirect policy and that same-URL login pages still require authentication validation.
- Fixed a public declaration gap discovered during review: computed metric definitions exposed only the performance-score key to TypeScript. Explicit immutable definitions now preserve all metric names and units; an installed-consumer assertion checks layout shift's exact unit.
- Kept report parsing separate from browser startup, profile verification, storage and original-artifact persistence. Added six focused normalization cases and composition coverage through scheduling and aggregation. Fixed a misplaced expected-error directive found by the first installed type-check run.

Validation: lint, strict typechecks, formatting, core/fixture tests and fresh installed-consumer runtime/declaration/workflow checks pass. Production packaging runs through prepack. Live Lighthouse execution, authentication, cache semantics and browser cleanup remain unvalidated; this milestone adds report normalization, not a CLI collection command.

## Iteration 14 Experimental Lighthouse collector

Added `measure --experimental` and the programmatic `measureProject` API. The collector resolves application-installed Lighthouse 13.6.0 and chrome-launcher 1.2.2, launches an isolated worker and Chrome profile for each attempt, applies the mobile/default or desktop preset, enforces browser-attempt timeouts, and persists original reports, normalized samples and per-URL aggregates. Cold-cache measurements without authentication hooks are the explicit experimental scope; unsupported profiles fail before history creation.

Quality review and cleanup:

- Kept browser imports in the worker and out of CLI/core startup. No Lighthouse shipping dependency was added while the live engine comparison remains blocked.
- Connected existing scheduling, aggregation and immutable storage instead of introducing new retry math or report rendering. A partial measurement exits 1 with its manifest; fatal errors retain a terminal history entry when collection has started.
- Added fatal adapter errors so persistence, normalization and cleanup failures stop rather than consume navigation retries. Improved propagated diagnostics and retained malformed original reports for inspection.
- Accounted for Chrome launcher's separate process group on cancellation/timeouts. Parent cleanup uses its PID file, terminates the group and checks the browser PID for exit. A negative-PID existence probe produced `EPERM` here; checking the browser PID fixed that verification while retaining group termination.
- Preserved available reports even when a worker times out during cleanup after producing JSON/HTML. Added regression coverage for that case, cancellation, raw-report write failures, malformed data, missing engines, warmups, device settings, retry exhaustion and partial metrics.
- Added installed-CLI coverage using explicitly fake engine packages in a separate temporary application. The detached browser stub is a Node process; these tests establish orchestration and packaging, not browser emulation/cache correctness.
- Added a dedicated real collector probe and updated user-facing commands, setup, storage layout, exit statuses and experimental limits.

Validation: 74 core/fixture tests, lint, strict typechecks and formatting pass. Fresh installed-consumer checks exercise the packaged worker, command, runtime exports and public declarations, alongside existing Vite workflows and production prepack builds. The real engine comparison and real collector probe were both attempted and failed at `listen EPERM` on loopback before measurement. Live Lighthouse/Chrome execution, authentication and actual cache/device semantics remain unverified; the feature stays explicitly experimental.

## Iteration 15 Diátaxis documentation

Added a documentation home organized into tutorials, task recipes, reference and explanation. Added a getting-started exercise using an independently installed local tarball and a tiny Vite application; a how-to page with seven recipes; a command/exit-status reference; a measurement-model explanation; and root `Architecture.md` with workspace, sequence and lifecycle diagrams.

Review and cleanup: retained established reference paths, separated Vite setup instructions from interface details, corrected stale claims that CLI collection was future work and median aggregation unimplemented, and kept sample-dashboard/live-browser limitations explicit. The architecture diagrams distinguish implemented relationships from the future real-data dashboard connection.

Validation: local documentation links resolve, code fences are balanced, Oxfmt and whitespace checks pass. The tutorial's package/app/config blocks were used to pack and install the tool, initialize and inspect the project, build the Vite application, import it twice and inspect distinct same-label history entries. No server or browser was required. Mermaid source was reviewed; rendered diagrams were not previewed in this environment.

## Iteration 16 Next.js Pages initial-asset import

Added `analyze --next-build`, `importNextPagesBundle` and pure `normalizeNextPagesBundle` for Next.js 16.4.5 / Webpack 5.98.0 client artifacts. Original stats, build manifest, framework version and build identity are retained. Initial route-template sets combine polyfills, shared app assets and page files without duplicates. Missing referenced sizes remain unknown.

Quality review: rejected App Router/mixed-router, SSR, unsupported versions, unsafe asset paths, duplicate assets and mutually exclusive CLI inputs before history creation. Kept modules/compression unavailable and every snapshot partial because asynchronous route attribution is not established. Reused the cleared perf-tools shared-shell/deduplication approach without copying its zero-size or ambiguous-basename fallbacks. Kept importer normalization independent of Next.js runtime dependencies and updated Diátaxis reference/recipes/architecture to match the implemented boundary.

Validation: 78 core/fixture tests, all 16 fresh-tarball integration checks, lint, strict typechecks, formatting and production packaging pass. `pnpm test:next-pages` rebuilds and imports real baseline/candidate fixtures, checks emitted sizes against disk and preserves the known +70,017 emitted JS-byte delta. Route-specific asynchronous loading and concrete-URL template resolution remain unavailable rather than inferred from shared Webpack chunk relations.

## Iteration 17 Beta release preparation and synthetic-only profiles

Prepared `0.1.0-beta.0` using Changesets 3.0.3, following Britecharts' version/changelog model. Only the consumer-facing CLI package is public; its prebuilt report, core APIs and Vite subpath ship together. Added metadata, a changelog, version-PR automation and a separate manual publish workflow with explicit beta tag, provenance, verified tarball reuse and integrity-aware retry handling. No publication, push, secret configuration or GitHub workflow dispatch was performed.

Added synthetic-only `bundle.adapter: none` / generic run identities after inspecting the user's Expo portfolios. Unknown build frameworks can initialize a URL-measurement profile without being mislabeled as Vite or Next.js. Doctor checks the pinned Lighthouse/launcher for that profile. This does not claim Expo/Metro bundle attribution.

Quality review and fixes:

- Replaced a hard-coded 0.0.0 CLI test with installed manifest version verification.
- Guarded actual publication with a clean checkout, exact source commit, exact verified archive, beta-only metadata and a receipt that was not generated from dirty source. Registry failures other than explicit 404 stop rather than imply a missing version.
- Kept authentication scoped to the manual publish job, used npm for the packed artifact rather than copying Britecharts' pnpm auth interpolation, and retained local non-publishing release plans.
- Added release-policy tests, synthetic-only setup/collection coverage and installed generic-profile checks. Fixed the latter fixture to explicitly select the profile rather than relying on the Vite default.
- Retained bounded browser stderr/log evidence for failed attempts. Actual portfolio smoke testing produced a timeout and no valid measurements; HTTP availability checks are not performance results.
- Updated architecture-review guidance to the now-existing release workflow. Formatter and local links pass; the bundled Python skill validator could not run because PyYAML is unavailable, so unchanged frontmatter and the narrow body/link edit were checked directly.

Validation: 80 core/fixture tests, three release-policy tests, 16 installed-consumer checks, real Next Pages baseline/candidate import, lint, types, formatting and peer checks pass. Frozen dependency installation passes. `release:check` generated the beta archive and dirty-source receipt; `release:plan` verified it without publishing. Final publication still requires verification of a clean committed checkout and npm/GitHub account setup. Live Lighthouse evidence remains blocked/unverified; the installed portfolio runner and public URL profiles are isolated under ignored artifacts, and portfolio source checkouts are unchanged.

## Iteration 18 Shared comparisons and real-data Britecharts reports

Implemented shared comparison calculations for stored bundle/synthetic runs and a saved report model. `compare` retains source identities, completeness, metric counts/spread and compatible deltas. `report` exports one HTML file embedding validated comparison JSON, the prebuilt Shadcn/Britecharts app and styles; no server or consumer build is required. The dashboard uses real data and explicit empty/missing/partial/incompatible states rather than sample values or invented trends.

Quality review and fixes:

- Kept profile checks, measurement loading and math outside JSX. Separated browser-safe report contracts, comparison persistence and exclusive export-file handling.
- Deduplicated bundle sets, propagated missing sizes/subjects, retained per-metric synthetic evidence, rejected mixed targets/profiles/versions and preserved null percentages for zero baselines. Strengthened serialized numeric-delta consistency checks.
- Added guarded readers for listed ordinary history artifacts, report/comparison identity checks, escaped inline JSON and immutable output behavior. Fixed history containment for dot-prefixed child names and canonical aliases into history.
- Reused prebuilt UI assets in a standalone report and retained exact-value tables alongside the chart. Added the report app's explicit React DOM dependency and used the installed consumer boundary for runtime/types/report export.
- Added Playwright file-based checks for filters/chart, mobile layout, partial/incompatible/unknown/empty states, escaped labels and malformed JSON. CI installs Chromium and requires these checks. Chrome aborts at launch in this environment, before rendering; the three local browser cases failed at launch and are not reported as passing.
- Added an explicit offline consumer-install option after registry metadata waits exceeded the local process timeout; fresh cached installations then completed normally. No validation assertion was weakened.

Validation: 85 core/fixture cases, all 17 fresh-tarball consumer checks, lint, strict types, formatting, peers and production packaging pass. The installed workflow compares real baseline/candidate Vite builds and preserves their >50 KB emitted-JS increase in the exported report. Browser rendering/interaction remains a material CI validation requirement; no local visual pass is claimed. Portfolio testing is stopped as requested. Next group: CI budgets and release validation against this same comparison/report model.

## Iteration 19 CI budgets and release validation

Implemented `budget` against saved comparisons, with absolute ceilings/floors and allowed percentage regressions. Selectors identify exact group/subject/metric rows and source units. Exit 0 means all rules pass, 1 means violation and 2 means measurement/configuration error; errors dominate violations. Optional JSON exports are exclusive and outside immutable history. HTML reports can embed the same evaluated rules without changing the saved comparison.

Quality review and fixes:

- Kept browser-safe budget schemas separate from the pure evaluator and filesystem/CLI orchestration. Reused the existing shared comparison/report model and export guard; added no runtime dependencies.
- Required compatible, complete runs and known values; synthetic metrics require at least three valid samples on each side. Zero baselines cannot pass percentage rules. Higher-is-better scores use fractional floors and direction-aware regression; improvements consume no allowance.
- Strengthened report selector and sample-metadata consistency validation to reject contradictory imported data. Tested equality, unrounded percentages, partial/incompatible/unknown data, unit errors, missing selectors, insufficient samples and malformed rules.
- Exercised budget pass/violation/error exit codes through the installed tarball against real Vite builds, including exclusive JSON export and verdict-bearing HTML. Added public type coverage and browser assertions for the budget panel.
- Made report browser tests mandatory in release receipts, installed Chromium in the manual publish workflow and invalidated earlier receipts before verification. Policy tests reject a receipt missing this check. Updated the unpublished beta descriptions and Diátaxis reference/how-to docs.

Validation: lint, types, formatting, 92 core/fixture cases, three release-policy cases, 17 fresh-tarball consumer checks and production packaging pass. The real Next Pages pair still verifies +70017 emitted JS bytes. Local report tests fail before rendering because Chrome cannot launch; release verification therefore stops without a receipt. CI must establish browser rendering/interaction before publication. No publication or portfolio testing was performed.

## Iteration 20 Absolute regression budgets and CI job examples

Closed the remaining work package 10 budget gap: regression limits now support both percentages and absolute floors. Added `regression-absolute` rules, which allow a source-unit regression and evaluate zero baselines, and an optional `minimumChange` noise floor on `regression-percent` rules. A percentage violation within the floor passes with an explanatory reason. Added a Vite pull-request GitHub Actions example and Next.js Pages guidance to the CI how-to.

Quality review and fixes:

- Kept the change inside the pure evaluator and browser-safe budget schema; split per-mode judgement into a helper to stay within the SonarJS complexity limit. No runtime dependencies, CLI flags or persisted comparison schemas changed; existing budget files and evaluations remain valid.
- Reused direction-aware clamping for both regression modes so higher-is-better scores reverse and improvements report zero. Score limits and floors stay on the fractional scale. `minimumChange` is rejected on other modes and cannot rescue a zero-baseline percentage rule.
- Added the unit to the floor-pass reason after review found a bare number. Ordered the installed CLI cases so the following export assertions still use a failing rule.
- Did not add a Next.js budget step to the examples: Pages imports are always partial, so every rule returns exit 2. The guidance says so and uses the stats-enabled `next build --webpack` command. The GitHub Actions YAML is documentation and was not executed in Actions; the installed workflow test exercises the same command sequence locally.
- Updated the unpublished beta changeset, changelog and release notes.

Validation: lint, strict typechecks, formatting, 95 core/fixture cases and all 17 fresh-tarball consumer checks pass, including installed `regression-absolute` and floor cases and strict declarations for both rule shapes. Report browser checks were not rerun because Chrome cannot launch locally; the report UI is unchanged. Remaining release blockers are unchanged: CI browser rendering and live Lighthouse evidence.
