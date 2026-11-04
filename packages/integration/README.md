# Consumer integration tests

This private package tests the BritePulse tarball through installed public exports and the installed CLI. It follows Britecharts' separate integration package pattern.

Run the complete suite from the repository root:

```sh
pnpm test:integration
```

The command packs BritePulse through its production `prepack` build, creates fresh isolated consumers, installs the tarball with pnpm, and runs the package, type and workflow checks. Installation requires registry access for dependencies. No server or browser is needed for this suite.

## Consumers

| Consumer   | What it establishes                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI only   | The installed binary and root/config exports work without Vite, React, Lighthouse or workspace package links. Optional tooling cannot load during help/version or core API startup. |
| Vite React | An application imports `britepulse/vite` from the installed tarball, compiles the public TypeScript declarations and builds real client and SSR artifacts.                          |

Source consumer templates live in `consumers/`. Preparation copies them to `.artifacts/consumers/`, replaces the BritePulse dependency with the freshly packed tarball and creates an independent pnpm workspace. Templates are not members of the repository workspace. Installed package paths are checked to stay inside each staged consumer, so a source symlink cannot make a missing export or file pass unnoticed.

The generated consumers, lockfiles, build outputs, local history and tarballs stay in ignored `.artifacts/`. Every full run removes and recreates consumer installations to avoid stale tarball contents.

## Checks

- Verify declared runtime/type export files, license, README and referenced prebuilt report JS/CSS files exist. Ensure fixtures, source, tests and local run data do not ship.
- Execute the installed bin's help, version, unknown-command and redirected-input paths. Block optional dependency imports during help/version and core export imports.
- Compile a strict NodeNext TypeScript consumer using root, configuration and Vite exports, including expected type errors for invalid targets, units and plugin options.
- Run installed `init`, `doctor`, `analyze` and `history` commands with JSON output. Existing configuration cannot be overwritten, and command overrides preserve project settings.
- Build baseline and candidate React applications with shared code, static CSS and lazy CSS. The candidate adds lodash to a lazy import. Verify an emitted JS increase greater than 50 KB, exact asset sizes against disk, compression estimates, and disjoint initial/asynchronous asset sets.
- Import both builds with the same label and verify distinct run IDs, preserved original JSON, normalized snapshots and complete history.
- Reject unsupported artifact schemas before creating history entries. Build an SSR artifact, reject it without explicit target selection and retain the SSR target when imported correctly.

Workflow assertions inspect emitted files and installed CLI output. They do not import workspace implementation modules or validate output by calling the implementation's own parser.

## Run individual phases

```sh
pnpm --filter @britepulse/integration run pack
pnpm --filter @britepulse/integration run install:consumers
pnpm --filter @britepulse/integration run test:tarballs
pnpm --filter @britepulse/integration run test:types
pnpm --filter @britepulse/integration run test:cli
```

`install:consumers` always prepares fresh copies first. `prepare:consumers` is also exposed for inspecting staged manifests before installing. `pnpm test:package` remains available as a compatibility alias for fresh packing, installation and package checks only.

CI runs the complete integration suite separately on Node 22.19.0 and Node 26. The existing compatibility fixtures remain responsible for broader framework experiments. Browser dashboard interactions and live Lighthouse measurement will be added when those runtime features are available; checking shipped report assets does not establish browser rendering correctness.
