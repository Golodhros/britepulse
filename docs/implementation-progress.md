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
