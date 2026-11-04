# Measurement engine decisions

## Bundle collection

Use a thin production-only Vite adapter as the initial collection boundary. Collect exact emitted asset bytes, imports, dynamic imports and available module identifiers; combine these with manifest CSS and entrypoint relationships. The compatibility spike confirms these inputs on Vite 8.3.5. Do not claim framework route attribution or rendered/compressed module bytes from identifiers alone.

Keep BundleStats as a possible optional diagnostic report. It supplies useful package and module insights, but its fixture initial-CSS summary is incomplete and the report model adds dependencies that the CLI does not need for basic collection. The fixture-only dependency remains available for comparison. Preserve adapter boundaries so this decision can be revisited without changing stored BritePulse contracts.

Start Next.js collection with imported client Webpack stats. Pages Router route mapping has a manifest path worth validating next. App Router route/layout mapping remains partial. Native Turbopack graph export is promising but remains an experimental, separate importer until its size and route semantics pass fixture checks.

## Synthetic collection

Engine selection remains open. LHCI 0.16.0 and direct Lighthouse 13.6.0 are pinned in a fixture, using the same Lighthouse engine. The probe compares three reports per public/authenticated URL and retains original JSON and HTML. Live execution is blocked by loopback permissions in this environment. Cancellation, retry scheduling and per-metric median aggregation must be BritePulse-owned behavior regardless of engine choice; a runner's built-in summary must not silently replace those contracts.

Do not introduce a shipping Lighthouse dependency or claim authenticated measurement support until the live probe passes. No existing organization-specific measurement code or reports were copied.
