# Release reference

Reference · [Documentation home](README.md)

| Item                    | Value                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| Publishable package     | `britepulse` in `packages/britepulse`                                       |
| Prepared version        | `0.1.0-beta.0`                                                              |
| npm registry/access/tag | `https://registry.npmjs.org/`, public, `beta`                               |
| Version tool            | Changesets 3.0.3, matching Britecharts' model                               |
| Prerelease state        | `.changeset/pre.json`; consumed beta changesets under `.changeset/pre/`     |
| Version PR trigger      | Push to `main`, only when Changesets selects version mode                   |
| Publish trigger         | Manual `Release` workflow dispatch on `main` with exact version input       |
| Runner                  | GitHub-hosted Ubuntu, Node 24, pnpm pinned by `packageManager`              |
| Authentication          | Bootstrap repository secret `NPM_TOKEN`; temporary npm configuration        |
| Provenance              | Explicit npm `--provenance` in the publish command                          |
| Tag                     | `britepulse@<version>`, reported through `CHANGESETS_OUTPUT` for Changesets |

## Scripts

| Command                 | Behavior                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm changeset`        | Adds a release description                                                                                                                                                          |
| `pnpm version-packages` | Applies Changesets versioning; no publication                                                                                                                                       |
| `pnpm test:release`     | Tests beta-only policy, receipt consistency and registry error handling                                                                                                             |
| `pnpm release:check`    | Validates public/private boundaries and runs lint, types, core tests, release tests, formatting, installed consumers and real Pages fixture import; saves verified artifact/receipt |
| `pnpm release:plan`     | Validates receipt and prints the planned npm command; no publication or credential access                                                                                           |
| `pnpm release`          | Actual publication; requires GitHub Actions, clean checkout, matching commit/receipt and beta policy                                                                                |

## Artifact receipt

`.artifacts/release/receipt.json` records schema version 1, package name/version/tag/filename, SHA-512 integrity, checked source commit, dirty-source flag, completed check names and material validation limitations. The publisher rechecks these against the current manifest, prerelease state, git commit and tarball contents. Changing the source commit or artifact requires a new verification run. A receipt produced from uncommitted source cannot authorize publication even if that source is later reverted. Generated release files are ignored by git; the workflow uploads them as a release-verification artifact.

The tarball allowlist contains `dist`, `README.md`, `LICENSE` and `CHANGELOG.md`; package metadata is included by the packer. Compiled `dist` includes declarations, worker code and prebuilt report assets. Fixtures, credentials, source tests, workspace dependencies and local history do not ship.

A registry query skips publication only for an identical published integrity. Explicit 404 permits a first publish attempt; all other lookup failures stop publication. No `latest` promotion or stable-version publishing is implemented. First-package registry tag behavior must be inspected after the first authorized publish, as described in [the release guide](releases.md).
