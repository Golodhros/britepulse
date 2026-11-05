---
name: audit-changes
description: Validate BritePulse changes with the appropriate lint, type, Node test, build and installed-consumer checks, and fix failures within the task scope.
---

# Audit BritePulse changes

Read [review scope](../../references/review-scope.md), then inspect the changed files and their callers. Choose checks by the behavior touched; do not run compatibility or browser probes for an unrelated documentation edit.

## Choose the checks

| Change                                                                 | Checks                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Markdown or local skills only                                          | Oxfmt on the changed files; validate changed skills and their local links                                    |
| Core logic, configuration, contracts or storage                        | ESLint on changed code, `pnpm typecheck`, `pnpm test`                                                        |
| CLI, runtime exports, adapter, dependencies, declarations or packaging | Core checks plus `pnpm test:integration`; this performs production prepack/build and fresh consumer installs |
| Dashboard rendering or styling                                         | Lint, report typecheck/build, then inspect the affected browser states when available                        |
| Compatibility fixtures or supported tool versions                      | Relevant production fixture pairs or native/synthetic probe, as well as affected unit/integration checks     |

Use the actual scripts in `package.json`. Full routine checks are `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm format:check`. Use `pnpm build` when a production build is needed outside the integration pipeline. Dependency or workspace edits also need `pnpm install --frozen-lockfile` and `pnpm peers check`.

While iterating, scope lint and formatting with `pnpm exec eslint <files>` and `pnpm exec oxfmt --check <files>`. Fix formatting deliberately with `pnpm exec oxfmt --write <files>`; Oxfmt writes by default, so always use `--check` for validation. The root `pnpm format` rewrites the whole repository. ESLint enforces blank lines around function declarations/exports and before returns; apply layout-only fixes with `pnpm exec eslint --fix --fix-type layout <files>` when needed. ESLint includes SonarJS; preserve the exact fixture-only whole-Lodash exception in `eslint.config.mjs`, rather than widening it to production code.

## Test and build details

`pnpm test` compiles the core and runs Node's test runner over `packages/britepulse/test/*.test.mjs` plus the synthetic request-handler tests. Core tests import `dist`, so compiling first is essential for a focused test:

```sh
pnpm --filter britepulse run build
node --test packages/britepulse/test/config.test.mjs
```

`pnpm --filter britepulse run build` compiles only the core. Root `pnpm build` also builds and packages the report assets. Do not substitute a bare `tsc` invocation with unspecified emission behavior.

`pnpm test:integration` packs the production artifact, recreates isolated consumers, installs it, compiles its public types and exercises the installed CLI and Vite integration. If only part of a split run succeeds, report the phases actually completed; use the phase commands in the consumer integration guide below.

For compatibility work, use `pnpm test:compatibility`, `pnpm test:native` or `pnpm test:synthetic` only when relevant. The synthetic probe needs Chrome and a loopback listener. Passing handler/unit tests does not establish live authenticated collection; an unavailable browser or port is a validation gap, not a passing probe.

Read [the consumer integration guide](../../../packages/integration/README.md) for phase commands and [compatibility evidence](../../../docs/compatibility.md) for limits. If a check fails, fix the cause and rerun that check. Repeat broader validation only when the fix or an unresolved concern warrants it. Finish with commands, outcomes and material gaps; do not use old test counts as a fixed target.
