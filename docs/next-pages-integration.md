# Next.js Pages Router import reference

Reference · [Documentation home](README.md)

The importer accepts production client Webpack stats from Next.js 16.4.5 with Webpack 5.98.0. App Router, mixed-router, Turbopack, SSR and other versions are rejected. No Next.js runtime dependency is loaded by the CLI.

## Inputs

`analyze --next-build <directory>` expects these source files:

| File                                         | Required content                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `client-stats.json`                          | Webpack JSON with `name: "client"`, `version: "5.98.0"`, and named `assets` with integer emitted sizes      |
| `build-manifest.json`                        | `polyfillFiles`, `lowPriorityFiles` and `pages` including `/_app`; nonempty `rootMainFiles` are unsupported |
| `diagnostics/framework.json`                 | `{ "name": "Next.js", "version": "16.4.5" }`                                                                |
| `BUILD_ID`                                   | Nonempty source build identity                                                                              |
| `server/app-paths-manifest.json`, if present | Must be empty; nonempty App Router paths are rejected                                                       |

`bundle.adapter` must be `next-webpack`. `bundle.statsFile` can select a different stats file; the other inputs remain relative to `--next-build`. `--artifact` and `--next-build` are mutually exclusive. Only client imports are supported. The programmatic API is `importNextPagesBundle(resolvedConfig, directory, label)`; pure normalization is exposed as `normalizeNextPagesBundle(stats, buildManifest, { runId, nextVersion })`.

## Normalization and limits

Each public Pages manifest template becomes an entrypoint. Initial assets are the deduplicated union of polyfills, `/_app` assets and that page's files. Framework-only `/_app`, `/_document` and `/_error` templates are excluded. Dynamic route keys such as `/products/[id]` remain templates; the importer does not resolve concrete URLs or Next.js rewrites.

Webpack-reported asset sizes are emitted bytes. A manifest reference missing from the client stats becomes an explicit unknown-size asset. No basename fallback, content-hash matching, module size inference or compressed/transfer estimate is used. Low-priority framework files are retained without inferred route timing.

Every imported snapshot is deliberately `partial`: asynchronous route attribution is unavailable, `asynchronous: []` represents no attributed evidence rather than proof of no lazy code, routes are `partial`, and module/compression capabilities are `unavailable`. Do not total several route initial sets as an app-wide download: shared assets appear in each route's set.

The importer preserves four source files under `original/`, stores `normalized/bundle.json` with the local run ID and records the original `BUILD_ID` as manifest build identity. Input validation precedes history creation. A successful import exits 0 even when its measurement snapshot is partial; only experimental `measure` uses exit 1 for partial collection.

## Evidence

`pnpm test:next-pages` rebuilds the real Pages Router baseline/candidate fixture pair and imports both. It checks reported asset sizes against disk, shared CSS, route entries, deduplication and the known +70,017 emitted-JS-byte candidate increase. Unit and installed-consumer tests cover malformed inputs, mixed-router/SSR rejection, source retention, same-label identities and partial status. These checks do not establish App Router or async-route attribution support.
