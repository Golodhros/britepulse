# Measurement engine decisions

## Bundle collection

Use a thin production-only Vite adapter as the initial collection boundary. Collect exact emitted asset bytes, imports, dynamic imports and available module identifiers; combine these with manifest CSS and entrypoint relationships. The compatibility spike confirms these inputs on Vite 8.3.5. Do not claim framework route attribution or rendered/compressed module bytes from identifiers alone.

Keep BundleStats as a possible optional diagnostic report. It supplies useful package and module insights, but its fixture initial-CSS summary is incomplete and the report model adds dependencies that the CLI does not need for basic collection. The fixture-only dependency remains available for comparison. Preserve adapter boundaries so this decision can be revisited without changing stored BritePulse contracts.

Start Next.js collection with imported client Webpack stats. Pages Router route mapping has a manifest path worth validating next. App Router route/layout mapping remains partial. Native Turbopack graph export is promising but remains an experimental, separate importer until its size and route semantics pass fixture checks.

## Synthetic collection

Prefer the direct Lighthouse API behind a replaceable runner adapter, subject to the live comparison passing. LHCI 0.16.0 and direct Lighthouse 13.6.0 are pinned in a fixture, using the same Lighthouse engine. The probe compares three reports per public/authenticated URL and retains original JSON and HTML. Live execution is blocked by loopback permissions in this environment. Cancellation, retry scheduling and per-metric median aggregation must be BritePulse-owned behavior regardless of engine choice; a runner's built-in summary must not silently replace those contracts.

Do not introduce a shipping Lighthouse dependency or claim authenticated measurement support until the live probe passes. An explicitly experimental collector now resolves application-installed Lighthouse 13.6.0 and chrome-launcher 1.2.2 behind its worker adapter; it is limited to cold-cache collection without authentication hooks and does not settle the live engine comparison.

## Authentication and support scope

Start with headers/cookies and an optional browser setup hook. Authentication setup must preserve the declared cache policy: logging in must not silently warm a cold-cache measurement. Validate this contract in the authenticated fixture before describing it as supported.

Publish explicitly tested framework, backend and Node combinations; expand through CI evidence instead of promising broad version ranges. Keep Turbopack attribution experimental while implementing the validated Webpack importer first.

## Reuse of perf-tools helpers

The author explicitly cleared `perf-tools/lighthouse/` and `perf-tools/bundle-analysis/` for reuse on November 5, 2026. Adapt helpers as their feature slices need them; do not add a dependency on the private tools or copy their application configuration, saved browser state, reports or cloud storage integration.

- `lighthouse/src/utils/reports.mjs`: artifact discovery and JSON/HTML pairing are useful starting points. Validate report contents and use BritePulse-owned artifact paths and immutable storage.
- `lighthouse/src/utils/results.mjs`: retain useful named-run ordering cases, but keep BritePulse's existing run identity and storage contracts rather than introducing another execution directory scheme.
- `bundle-analysis/src/bundleStatsArtifacts.mjs`: use Pages Router template matching, shared-file deduplication and comparison cases as starting points for the Next.js importer. Split pure mapping from CLI, filesystem and cloud concerns. Replace unknown-size-as-zero and ambiguous basename fallback behavior with explicit unknown values before reuse; content-hash matching must never determine byte totals.

These are reviewed reuse candidates, not imported implementations. Keep the existing thin Vite collector and avoid copying another CLI parser or report renderer.
