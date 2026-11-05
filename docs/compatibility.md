# Compatibility evidence

These are fixture observations from November 4, 2026 on macOS arm64 and Node 26.9.0, not a general framework support promise. Dependencies are pinned in each fixture and the workspace lockfile. Fixtures contain public synthetic data only.

| Path                                     | Observed capability                                                                                                                                                              | Remaining limit                                                                                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vite 8.3.5 with Rolldown                 | Baseline and candidate builds; emitted JS and CSS bytes; static and dynamic import graph; module identifiers; manifest CSS relationships                                         | Module sizes are not emitted transfer sizes. Framework route attribution is unavailable.                                                                                                                                                                     |
| Next.js 16.4.5 Pages Router with Webpack | Client stats, build manifest, shared app shell, two page entries, lazy chunks; candidate adds 70,017 emitted JS bytes                                                            | Route closure and asynchronous attribution require their own adapter tests.                                                                                                                                                                                  |
| Next.js 16.4.5 App Router with Webpack   | Client asset totals, modules and entrypoints; candidate adds 70,017 emitted JS bytes                                                                                             | App Router layout and route attribution remain partial. Server and client totals must stay separate.                                                                                                                                                         |
| Next.js 16.4.5 native Turbopack analysis | `experimental-analyze --output` and graph JSON Lines export succeed. Schema version 1 contains route, module, part, output and group records. Candidate includes lodash modules. | Analysis is not a production build. Production byte totals and route/client/server semantics are unvalidated. Reusing analysis output caused internal Rust panic messages despite exit code 0; the probe now starts with a clean generated output directory. |
| Lighthouse 13.6.0 and LHCI 0.16.0        | Pinned matching Lighthouse version; repeat/public/authenticated-page probe and original-report checks are implemented                                                            | Execution is blocked here by `listen EPERM` on loopback. Engine selection, browser authentication, cancellation and timing behavior remain unvalidated. Lighthouse requires Node >=22.19.                                                                    |

## Reproduce

From the repository root, after `pnpm install`:

```sh
node scripts/compatibility.mjs
node scripts/probe-next-native.mjs
node --test fixtures/synthetic/server.test.mjs
node fixtures/synthetic/probe.mjs
```

The first command builds baseline/candidate pairs for all three fixtures and verifies emitted JS/CSS, a meaningful candidate delta, shared assets, and dynamic-import evidence. Pass fixture names to restrict it. Each fixture saves generated evidence under its ignored `.artifacts/` directory. The native probe cleans only its generated analysis directories before rebuilding. The synthetic probe requires a working Chrome installation and permission to bind a loopback port; set `CHROME_PATH` if Chrome is not auto-detected. It stores each probe in an isolated output directory.

## Vite backend comparison

The baseline thin probe measures 222,371 emitted JS bytes and 104 CSS bytes. The candidate measures 293,328 JS bytes and 104 CSS bytes. The added dependency is deliberately lazy; its emitted chunk grows from 62 to 70,996 bytes. Shared React and clsx code stays in the main entry.

BundleStats 4.23.1 also detects the dependency increase and package/module counts. Its `webpack.totalInitialSizeCSS` summary is zero for both variants even though the Vite manifest links 104 CSS bytes to the entry. Its aggregate bundle size includes the probe artifact generated by the other plugin, so totals must be compared over the same asset set. This is why BritePulse must preserve its own raw emitted asset graph and manifest relationships.

Vite's documented [plugin hooks](https://vite.dev/guide/api-plugin.html), [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next), and [BundleStats](https://github.com/relative-ci/bundle-stats) describe the upstream interfaces. Runtime evidence, rather than untested version ranges, governs initial support.

The workspace gives `lighthouse@13.6.0` its own proxy-agent 8.0.1 dependency for its browser downloader through a package extension. This keeps LHCI's proxy-agent 6 from satisfying the downloader's incompatible optional peer; it does not change LHCI's own proxy implementation.

## Experimental collector evidence

The `measure --experimental` command resolves application-installed Lighthouse 13.6.0 and chrome-launcher 1.2.2. Worker/storage tests use explicitly fake engines and detached Node processes to check profiles passed to the adapter, retained reports, partial results, timeouts and cancellation. These establish orchestration behavior, not browser compatibility.

`pnpm test:synthetic:collector` builds the core and exercises the real collector against three public fixture navigations, checking original JSON/HTML reports and per-metric aggregates. Both this probe and the engine comparison were attempted on November 5, 2026 and stopped at `listen EPERM` on loopback before browser measurement. Live device/cache semantics, authentication and actual Chrome cleanup therefore remain unverified. Warm cache and authentication hooks are rejected by the experimental collector.

## Next.js Pages initial-asset importer

The importer now validates Next.js 16.4.5 / Webpack 5.98.0 client stats and Pages build manifests. `pnpm test:next-pages` verifies baseline/candidate imports against emitted file sizes and retains the known +70,017 JS-byte delta. Initial sets include shared shell/CSS and page files without duplicates. Snapshots remain partial because asynchronous route attribution is unavailable. App Router, mixed-router, SSR and Turbopack inputs are rejected.
