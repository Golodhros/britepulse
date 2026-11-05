---
name: create-unit-test
description: Create, run or debug BritePulse Node test-runner coverage for core logic, configuration, schemas, storage, processes and CLI behavior.
---

# Test BritePulse behavior

Read the source and a neighboring test first. Core tests live in `packages/britepulse/test/*.test.mjs`, import compiled `../dist/*.js`, and use explicit imports from `node:test` and `node:assert/strict`. Synthetic request-handler tests live under `fixtures/synthetic`. There is no Vitest/jsdom setup or source alias to rely on.

## Run the right artifact

The root `pnpm test` compiles the core and runs the existing core/handler suite. For a focused loop, compile before running the selected test:

```sh
pnpm --filter britepulse run build
node --test packages/britepulse/test/config.test.mjs
node --test --test-name-pattern 'fingerprints' packages/britepulse/test/config.test.mjs
```

A stale `dist` can make an edited source appear to pass. Root `pnpm build` is the larger production build that also packages report assets; it is not necessary for every pure-core test. Tests of the installed tool belong to [create-integration-test](../create-integration-test/SKILL.md).

## Choose meaningful observations

- Exercise a public behavior or regression trigger rather than matching private implementation details, line counts or generated wording.
- For schemas/configuration, cover precedence, invalid settings and versions, path bases, deterministic fingerprints and nullable values. Round-trip units and sample counts through JSON where persistence is the contract.
- For metric algorithms when implemented, use deterministic samples and edge cases. Exclude warmups and failed/invalid samples; do not assert fixed Lighthouse scores or timing thresholds that depend on the machine.
- For graphs, use shared chunks, cycles, static/async overlap, CSS and missing references. Compare actual emitted file sizes in build tests instead of assuming minifier output.
- For storage/processes, use `mkdtemp` and `tmpdir` with `finally` cleanup. Test observable artifacts, terminal state and failure/abort behavior. A failure should be asserted for its expected reason, not merely because an unrelated filesystem permission denied the operation.
- For CLI behavior, spawn the executable with bounded execution, inspect status/stdout/stderr, and parse JSON output. Include missing arguments and redirected-input behavior when relevant. Reuse the existing process test helpers where appropriate.

Await asynchronous work and clean up only resources owned by the test. Use runner fakes for scheduling/math, but retain a separate real browser probe before claiming live measurement support. Do not weaken assertions or fixture deltas to conceal a regression.

After a fix, rerun the failing/affected tests and use [audit-changes](../audit-changes/SKILL.md) for proportionate validation. Report actual results and any remaining runtime gap, without treating historical test counts as an invariant.
