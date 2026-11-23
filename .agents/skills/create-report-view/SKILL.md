---
name: create-report-view
description: Build or update BritePulse dashboard views with Vite, React, Shadcn UI and Britecharts while preserving measurement semantics and explicit sample or missing-data states.
---

# Develop a BritePulse report view

Read `packages/report/src/App.tsx`, relevant UI components, `components.json`, the owning manifest and the data contract or report model that will supply the view. BritePulse has a Vite report application, not Storybook. Use existing components and dependencies before introducing another UI or chart system.

## Keep data and presentation distinct

- Compose controls and layout with the existing Shadcn/Tailwind setup and use `@britecharts/react` for supported chart types. Keep exact-value tables and useful artifact links alongside visual summaries when the feature has those data.
- Keep measurement/comparison calculations in a testable model or core function, separate from JSX. Do not introduce filesystem, process or build-tool imports into the browser UI. Type-only shared contracts must not cause Node runtime dependencies to enter the bundle.
- Identify units, sample counts, spread, baseline/candidate identity and relevant profile differences. Unknown data must remain distinguishable from zero; client/SSR and emitted/compressed/transfer measurements must not be blended.
- The dashboard reads saved comparison data and shows an explicit empty state without it. Keep missing/incompatible/partial data explicit; wiring a chart is not proof that collection or budgets work.
- Build assets ahead of time through the report/packaging pipeline. Users generating reports should not need to install Tailwind or build the dashboard themselves.

## Check the view

Use `pnpm dev` to develop and `pnpm --filter @britepulse/report run typecheck` / `pnpm --filter @britepulse/report run build` for scoped checks. A packaging change needs the installed-consumer workflow from [create-integration-test](../create-integration-test/SKILL.md).

When browser access is available, inspect the states touched by the feature: initial load, valid filters, empty/missing or incompatible data, narrow viewport, keyboard navigation, readable tables and units, tooltip behavior and links. Select states relevant to the change rather than adding inert controls or placeholder features.

The installed-consumer workflow generates a real comparison HTML file. Run `pnpm --filter @britepulse/integration run test:report` for the Playwright file-based report checks after that workflow. Report browser launch failures as validation gaps; do not claim visual validation from a successful build. Report the actual browser evidence or the remaining gap. Use [code-review](../code-review/SKILL.md) for numerical correctness and [audit-changes](../audit-changes/SKILL.md) for the final scoped checks.
