---
name: style-review
description: Review BritePulse naming, measurement terminology, public contract clarity and documentation consistency without duplicating formatter or lint checks.
---

# Review BritePulse conventions

Resolve [review scope](../../references/review-scope.md). Check the current manifests, schemas, neighboring modules and relevant [configuration](../../../docs/configuration.md), [storage](../../../docs/local-storage.md) and [Vite](../../../docs/vite-integration.md) documentation. There is no Britecharts accessor/JSDoc/SCSS convention to import into this repository.

Review the aspects that affect understanding and consumer behavior:

- Names and labels identify units and measurement type: emitted, parsed, gzip, Brotli and transfer bytes are different values. Preserve explicit `null`/unknown semantics; do not relabel missing data as zero or improvement.
- Run labels, run IDs, source build IDs and environment/profile identity remain distinguishable. Status names describe actual lifecycle/completeness states rather than optimistic success.
- New TypeScript core modules follow ESM imports with `.js` specifiers and strict types; test files follow the existing Node `.test.mjs` convention. Match useful neighboring patterns instead of inventing rigid section orders or requiring comments on every function.
- Public CLI usage, exports, configuration keys and snapshot examples agree with the implementation. Document a renamed option, changed default or schema incompatibility where consumers will see it.
- Describe fixture experiments, sample dashboards and unavailable capabilities honestly. Do not promote a Zod schema, successful build or sample chart into a claim of implemented measurement, comparison or release support.
- Dashboard labels keep product concepts clear; internal artifact paths and debug details should appear only when useful to the user. Comments explain a non-obvious invariant or upstream limit, rather than narrating syntax.

ESLint/SonarJS and Oxfmt own mechanical rules; read `eslint.config.mjs` and `.oxfmtrc.json` rather than copying their settings here. The configured spacing rule requires blank lines around function declarations/exports and before returns when another statement precedes them. Let ESLint enforce those gaps; do not report additional formatting taste as a review finding. Keep the deliberate whole-Lodash candidate-fixture exception narrow.

For each finding, cite the contract, documented behavior or established neighboring convention, explain the ambiguity and propose a concrete edit. Distinguish stale documentation from faulty code. Call out consumer-visible renames as compatibility changes. If no supported issue exists, report a clean review.
