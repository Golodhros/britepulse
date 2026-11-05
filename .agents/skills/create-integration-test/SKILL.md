---
name: create-integration-test
description: Extend BritePulse installed-tarball consumer tests for public exports, TypeScript declarations, CLI commands, real build adapters and packaged report assets.
---

# Test the installed BritePulse tool

Read [packages/integration/README.md](../../../packages/integration/README.md), the relevant consumer template, test and preparation scripts. The private integration package is the consumer boundary, while `fixtures/` contains broader compatibility experiments.

## Preserve consumer isolation

- Change templates in `packages/integration/consumers/`, not generated copies under `.artifacts/consumers/`.
- Pack through the existing `prepack` workflow. Preparation rewrites the BritePulse dependency to the fresh tarball and creates an independent pnpm workspace; do not replace it with a workspace/source link.
- Keep the installed-path assertions and fresh installation behavior. Reusing a same-version tarball installation can silently test old code.
- Consumer applications import public package entrypoints and invoke the installed bin. Test drivers may inspect manifests, bytes and JSON, but must not import workspace implementation modules or use their parser as the oracle for correctness.

Use the existing CLI-only consumer to check startup without optional UI/build/browser dependencies. Use the Vite React consumer for plugin/runtime/type behavior. Add a consumer only when it exercises a different supported boundary; a Next.js experiment is not evidence that a shipping importer already exists.

## Extend the observable workflow

Choose assertions relevant to the changed feature: exported JS/declaration files, strict TypeScript usage, package assets, init/doctor/collection/history results, artifact units and completeness, same-label run identity, actual disk sizes, known candidate growth, missing/invalid inputs or client/SSR separation. Public API type tests should include a meaningful expected compile error where it protects a contract.

Keep the whole-Lodash candidate dependency: its purpose is a deliberate lazy bundle regression. Do not change it to a smaller subpath import, remove the expected growth or broaden the fixture-only lint exception to make a failing test pass.

## Run

```sh
pnpm test:integration
```

This command packs, recreates and installs consumers, then runs tarball, type and CLI workflow checks. It includes the production core/report build. `pnpm test:package` is the packaging subset, not the full integration suite. For phase debugging, use the commands in the integration README; rerun the phases affected by code or dependency changes, with a fresh tarball when shipping content changed.

The current suite is server-free. Report asset existence does not establish browser rendering, and handler tests do not establish live Lighthouse/authentication behavior. Add runtime coverage when the implemented feature requires it, and report unavailable browser/loopback access as a gap rather than silently skipping it. Finish with evidence from the installed artifact and any unverified platform/version combination.
