---
name: architecture-review
description: Review BritePulse package and module boundaries, optional dependencies, versioned contracts, adapter isolation and installed-package behavior.
---

# Review BritePulse architecture

Use [review scope](../../references/review-scope.md). Read the owning manifests, runtime exports and relevant module callers before judging placement. The intended system is a local performance tool, not a hosted monitoring service. Prefer the smallest boundary change that solves a demonstrated coupling problem.

## Boundaries to inspect

| Area                         | Responsibility and dependency boundary                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core configuration/contracts | Validate external data and provide inferred TypeScript types. Keep serialization contracts independent of browser rendering and adapter startup.                                                     |
| Store and process modules    | Local files, immutable run identities, atomic visibility and process execution primitives. Collection orchestration maps results/errors into lifecycle states.                                       |
| CLI                          | Parse commands and present results; shared setup/configuration logic serves interactive and direct paths. Help/version and core exports must not load Clack, React, charts, Vite or browser engines. |
| Build/measurement adapters   | Normalize upstream data through explicit capabilities and versions. Keep optional tooling behind its integration path or command. Fixture evidence must precede expanded support claims.             |
| Report package               | React, Shadcn and Britecharts presentation. Build assets ahead of time; generating a report must not require a consumer-side Tailwind/report build.                                                  |
| Integration package          | Install the production tarball into isolated consumers and use its public exports/binary. Test drivers may inspect files; consumer applications must not import workspace source.                    |
| Compatibility fixtures       | Test pinned upstream combinations and known input changes. An experiment does not become a shipping adapter merely because it builds.                                                                |

Within the core, keep graph traversal and measurement/comparison math separate from process, filesystem and presentation concerns. Avoid moving every helper into an abstraction layer: require a concrete shared responsibility or dependency direction to justify it.

## Public and persisted boundaries

- Inspect `packages/britepulse/package.json` exports and the source barrel together. Runtime and declared types must agree for the root, config and optional Vite entrypoints.
- Check dependencies in the package that imports them. A hoisted workspace dependency is not proof that a packed install works. Vite is optional for CLI-only consumers; chart/React dependencies belong to the report package.
- Review schema compatibility when changing stored snapshots or manifests. Reject unsupported versions explicitly or provide a tested migration; do not silently reinterpret old units or unknown values.
- Preserve original artifacts and distinguish source build identity from the local collection ID. Keep configuration fingerprints about the documented measurement profile, not checkout/storage location.
- Check `scripts/build-package.mjs`, the tarball file allowlist and [consumer integration tests](../../../packages/integration/README.md) for build/declaration/asset changes. Ignore generated directories as source; regenerate them through their owning scripts.

Describe the dependency or contract violation, affected consumers and the smallest correction. Give tradeoffs only when there is a real choice. Flag a breaking public or persisted-data change explicitly; use the repository’s Changesets beta workflow when a release is needed. Read [release reference](../../../docs/release-reference.md) for the single public-package boundary and verified-tarball policy. Use [code-review](../code-review/SKILL.md) for numerical/lifecycle correctness.
