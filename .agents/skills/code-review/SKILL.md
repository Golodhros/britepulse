---
name: code-review
description: Review BritePulse changes for correctness in measurement data, CLI behavior, local history, process lifecycle and bundle accounting.
---

# Review BritePulse correctness

Resolve the scope using [review scope](../../references/review-scope.md). Read the changed implementation, callers and tests, together with the relevant [configuration/contracts](../../../docs/configuration.md), [storage](../../../docs/local-storage.md) or [Vite integration](../../../docs/vite-integration.md) document. Follow the review-versus-fix mode defined by the task; reviews are not an excuse for unrelated refactors.

## Check the relevant behavior

- **Configuration and CLI:** flags override only the supplied settings, defaults do not reset sibling project values, relative paths use the documented base, and fingerprints remain deterministic. Invalid settings fail before collection; redirected input cannot enter prompts. Structured command results go to stdout and progress/errors to stderr.
- **Measurement semantics:** preserve units, tool versions, completeness and unknown values. When changing synthetic execution, verify per-metric valid samples, exclusion of warmups/failed attempts, retry accounting, unrounded medians, spread and cleanup. A navigation test is not real-user interaction measurement, and a budget check is not a significance test.
- **Bundle accounting:** initial closures follow static imports; asynchronous assets exclude the initial set. Shared assets must not be counted twice. Missing assets stay unknown. Keep client and SSR targets, module attribution and framework route attribution distinct. Emitted/compressed sizes are not measured network transfer.
- **History and lifecycle:** labels cannot select filesystem identities or overwrite runs. Check concurrent writes versus finalization, failed-write handling, cancellation, timeout cleanup, traversal/symlink guards and malformed-history discovery. Preserve original artifacts alongside normalized results.
- **Comparisons and budgets when touched:** incompatible profiles and missing measurements cannot create numerical claims or a passing budget. Zero baselines cannot create finite percentage changes. Schema definitions alone do not establish an evaluator or runnable command.
- **Tests:** look for externally observable assertions, not mocks that assume the algorithm is correct. Installed-consumer tests should detect packaging and declaration gaps that workspace tests cannot. Do not equate a build or request-handler test with browser execution.

Report actionable findings with priority, location, trigger and impact. Separate confirmed defects from unverified environment-dependent behavior. If the scope is clean, say so. Use [audit-changes](../audit-changes/SKILL.md) for executable checks and [architecture-review](../architecture-review/SKILL.md) for structural boundaries rather than repeating their entire reviews.
