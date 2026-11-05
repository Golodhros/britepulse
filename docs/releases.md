# How to prepare and publish a beta

How-to guide · [Documentation home](README.md)

BritePulse adapts Britecharts' Changesets model: user-facing changes carry changesets, version PRs update versions/changelogs, and a verified package artifact is published with provenance and a release tag. BritePulse has one publishable package. Publication is deliberately a separate manual workflow; pushing a prepared version does not publish it.

## Review the first beta

The prepared version is `britepulse@0.1.0-beta.0`. Read [beta release notes](beta-release-notes.md), [the changelog](../packages/britepulse/CHANGELOG.md) and [compatibility limits](compatibility.md). The CLI, Vite integration and partial Next Pages importer are available; shared comparisons feed the report dashboard, while local browser launch/rendering validation and live Lighthouse probes remain blocked.

From the repository root, install dependencies and validate the exact checkout:

```sh
pnpm install --frozen-lockfile
pnpm release:check
pnpm release:plan
```

The check builds and installs a fresh tarball into isolated consumers, runs the required checks and saves `.artifacts/release/britepulse-0.1.0-beta.0.tgz` with `receipt.json`. The plan checks its checksum, version and source commit, then prints the npm command without executing it. It does not access npm credentials or publish. A dirty checkout is visible in the plan; actual publication requires a clean checkout. After committing further changes, rerun the check for that commit.

## Prepare the GitHub workflow

Before an authorized first publish:

1. Push the reviewed commits to the public `Golodhros/britepulse` repository and wait for CI. This preparation task does not itself push or publish.
2. Enable GitHub Actions to create pull requests if version PRs are desired.
3. Configure a granular npm publishing token as the repository secret `NPM_TOKEN`, with the package-creation/publishing permissions and 2FA policy required by the account. The token is read only in the manual publish job and written to a temporary npm configuration that is removed afterward. No token belongs in git.
4. Confirm the npm account can claim/publish `britepulse`. A registry 404 is not a name reservation or permission check.

The release workflow uses npm to publish an already packed artifact, avoiding pnpm authentication interpolation and workspace-range concerns. It requests provenance from the public GitHub runner/repository. After bootstrapping the package, consider [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) to replace the bootstrap token; that account configuration has not been performed by this repository change.

## Publish an approved beta

Only after the package and release are approved, open GitHub Actions → **Release** → **Run workflow** on `main`, supplying the exact prepared version (`0.1.0-beta.0`). The manual job checks the requested version, reruns verification, uploads the tarball/receipt, configures authentication and invokes publication. It publishes the verified tarball with explicit `--tag beta`, public access and provenance, then lets Changesets create the corresponding `britepulse@<version>` tag/release.

After publication, inspect registry metadata and tags:

```sh
npm view britepulse@0.1.0-beta.0 version dist.integrity --json
npm view britepulse dist-tags --json
```

Use `britepulse@beta` for beta installations. [Changesets documents](https://changesets.dev/guide/prereleases#release-prerelease-versions) that a new package's first prerelease may also acquire `latest`; inspect the actual first-publication tags instead of assuming there is already a stable channel. The script always requests `beta` and never promotes a version to `latest` itself.

## Prepare later beta versions

For a user-facing change:

```sh
pnpm changeset
```

Select only `britepulse`, describe the behavior and choose the bump. On pushes to `main`, the version-only job opens or updates a beta version PR. Alternatively, run `pnpm version-packages` locally, review the version/changelog changes and commit them. Versioning does not publish.

Merge the version PR after review, then use the manual publish recipe for that exact new version. Leaving beta or shipping a stable version requires an explicit workflow/policy update; the current publisher rejects stable versions, other dist-tags and private packages.

## Recover an interrupted publish

The publisher checks registry state before publication. An existing version is skipped only when its registry integrity matches the verified tarball; tag/release reporting can then finish. A different artifact or an authentication/network response other than explicit 404 stops the run. Preserve the uploaded tarball/receipt from the failed workflow, inspect the registry and tags, and correct the underlying failure before rerunning. Do not change package contents under an already published version.

See [release reference](release-reference.md) for exact scripts, files and checks. GitHub workflow execution, npm authentication and actual publication are external steps and have not been exercised by local dry runs.
