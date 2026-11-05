# Developing BritePulse

BritePulse combines local frontend performance measurements and bundle analysis. Read the relevant implementation and its tests before changing it. The current commands, versions and exports live in the package manifests; compatibility evidence lives in [docs/compatibility.md](docs/compatibility.md). A schema or experiment is not proof that a user-facing feature exists.

## Repository map

- `packages/britepulse`: compiled TypeScript ESM CLI, configuration, result contracts, storage, orchestration and optional build adapters.
- `packages/report`: Vite React dashboard using Shadcn and Britecharts. It currently displays labeled sample data.
- `packages/integration`: installed-tarball consumer checks; consumer templates are staged into ignored `.artifacts/` before installation.
- `fixtures`: compatibility experiments, separate from supported integrations.
- `docs`: contracts, storage, integration decisions and the implementation/review ledger.

Use the Node requirement and pnpm version pinned in `package.json`. Keep measurements and reports on the local filesystem, preserve unknown values instead of inventing zeros, and keep browser/build-tool dependencies outside ordinary CLI startup.

## Development loop

Complete one feature slice, review its correctness and architecture, address findings and verify the result before moving to the next feature. Use the same resolved change scope for review and validation. Standalone review requests produce findings; an implementation task includes fixing the issues found within its scope.

Do not infer release readiness from passing unit tests. Changes to runtime exports, dependencies, the CLI, build adapters or report packaging need installed-consumer evidence. Read [the implementation ledger](docs/implementation-progress.md) for completed work and review decisions; check actual code before treating an entry as current status.

Formatting uses Oxfmt. ESLint enforces a blank line between function declarations/exports and before return statements when another statement precedes them. Keep those gaps when refactoring.

## Local skills

Use the relevant workflow rather than loading every skill:

| Task                                          | Skill                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Select and run checks for a change            | [audit-changes](.agents/skills/audit-changes/SKILL.md)                     |
| Review correctness and data handling          | [code-review](.agents/skills/code-review/SKILL.md)                         |
| Review boundaries, dependencies and packaging | [architecture-review](.agents/skills/architecture-review/SKILL.md)         |
| Review naming, units and documentation        | [style-review](.agents/skills/style-review/SKILL.md)                       |
| Combine reviews before finishing a feature    | [quality](.agents/skills/quality/SKILL.md)                                 |
| Create or debug Node unit tests               | [create-unit-test](.agents/skills/create-unit-test/SKILL.md)               |
| Extend installed-consumer coverage            | [create-integration-test](.agents/skills/create-integration-test/SKILL.md) |
| Develop a dashboard view                      | [create-report-view](.agents/skills/create-report-view/SKILL.md)           |

Review scope is defined in [.agents/references/review-scope.md](.agents/references/review-scope.md). Reuse existing test/build scripts; there is no Storybook, Vitest or Stylelint workflow in this repository.

Release preparation uses Changesets for the single public `britepulse` package; all other workspaces stay private. Read [release reference](docs/release-reference.md) before changing metadata/workflows. `pnpm release:check` validates a beta artifact; `pnpm release:plan` does not publish. Publication requires an explicit manual workflow dispatch, not ordinary implementation authorization.
