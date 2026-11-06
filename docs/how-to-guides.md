# How-to guides

Task recipes · [Documentation home](README.md)

These recipes assume BritePulse is installed in your application and `britepulse.config.json` already exists. For a guided first exercise, use [Getting started](getting-started.md).

## Collect an existing Vite application's production bundle

Add the plugin to the existing `plugins` array in `vite.config.ts`, preserving the application's other plugins:

```ts
import { britepulse } from 'britepulse/vite';
// Within defineConfig:
// plugins: [react(), britepulse()]
```

Build and import the generated artifact from your application directory:

```sh
pnpm run build
pnpm exec britepulse analyze --artifact dist/britepulse-bundle.json --label baseline --json
```

If your output directory differs, use its artifact path. See [Vite reference](vite-integration.md) for version and capability limits.

## Include compression estimates

Change the existing plugin call to `britepulse({ compression: true })`, then rebuild and import under a new label:

```sh
pnpm run build
pnpm exec britepulse analyze --artifact dist/britepulse-bundle.json --label compressed --json
```

Inspect the normalized snapshot's `gzipBytes`, `brotliBytes` and `compression` fields. These are emitted-file estimates, not measured network transfer.

## Keep an SSR build separate from client assets

Build the application's SSR target using its existing Vite build command and separate output directory. Import its artifact explicitly as SSR:

```sh
pnpm exec britepulse analyze --artifact dist-server/britepulse-bundle.json --target ssr --label server --json
```

Use the application's actual SSR output path. Omitting `--target ssr` rejects an SSR artifact rather than treating it as a client bundle.

## Select a different environment without editing defaults

Add the environment to the existing configuration's `environments` object. For example, merge this entry alongside `local`:

```json
{ "staging": { "urls": ["https://staging.example.com/"] } }
```

Inspect the selected profile first:

```sh
pnpm exec britepulse doctor --environment staging --json
```

Pass `--environment staging` to collection commands that support it. The override selects that invocation; it does not rewrite the configuration file. `history` lists entries from the selected output directory and does not filter them by environment.

## Inspect a partial or interrupted run

```sh
pnpm exec britepulse history --json
```

Take the run's `id` and inspect its `manifest.json` under the resolved output directory. `diagnostics` explains incomplete data; `artifacts` lists retained files. Open the corresponding original report and normalized sample or snapshot. Missing values stay null and must not be read as zero.

Correct the application or collection inputs and collect a new run. Existing history is immutable. A stale `running` entry records an interrupted process; automatic resumption is not implemented. See [storage reference](local-storage.md).

## Try cold-cache Lighthouse collection

On macOS/Linux, install the pinned tools in the application:

```sh
pnpm add -D lighthouse@13.6.0 chrome-launcher@1.2.2
```

Start the application using its normal preview/server command, and make sure configured URLs are reachable. Ensure Chrome is installed; set `CHROME_PATH` if auto-detection cannot find it. Use `synthetic.cache: "cold"` and no `authHook`.

```sh
pnpm exec britepulse measure --experimental --label baseline --json
```

A complete run exits 0; a partial run prints its manifest and exits 1. Read retained reports and per-metric counts before using results. Actual browser compatibility is still unvalidated in the development environment; warm-cache collection and authentication hooks are rejected. See [collection reference](configuration.md#experimental-lighthouse-collection).

## Reproduce the live collector validation gap

From the BritePulse repository root:

```sh
pnpm test:synthetic:collector
```

This builds the core, binds a local synthetic server and requests three real navigations. Chrome and loopback permission are required. A `listen EPERM` failure occurs before measurement and is not a passing browser check. The separate `pnpm test:synthetic` command compares direct Lighthouse and LHCI.

## Import a Next.js Pages Router Webpack build

Use a Next.js 16.4.5 Pages Router application with `bundle.adapter: "next-webpack"`. Capture client stats by adding this plugin inside the existing `webpack(config, { isServer })` callback in `next.config.mjs`, preserving existing settings and plugins:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Inside the existing webpack callback:
if (!isServer) {
  config.plugins.push({
    apply(compiler) {
      compiler.hooks.done.tap('BritePulseClientStats', (stats) => {
        const directory = resolve('.next'); // Use your actual distDir.
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          resolve(directory, 'client-stats.json'),
          JSON.stringify(stats.toJson({ all: false, version: true, assets: true })),
        );
      });
    },
  });
}
// Return config as usual.
```

Build using the application's installed Next.js CLI, then import from the actual build directory:

```sh
pnpm exec next build --webpack
pnpm exec britepulse analyze --next-build .next --label next-baseline --json
```

Inspect `normalized/bundle.json` under the returned run ID. Initial route sets include shared CSS and page assets; the snapshot is explicitly partial because asynchronous route attribution is unavailable. See [Next.js reference](next-pages-integration.md) for required files and rejected router/target combinations. Do not change a Turbopack application's bundler just to use this importer.

## Measure a website built with Expo, Gatsby or another framework

Use a standalone measurement directory with BritePulse, Lighthouse 13.6.0 and chrome-launcher 1.2.2 installed. Keep it separate from the site's source checkout if you do not want to add tooling dependencies to that project. Create configuration with an explicit synthetic-only profile:

```sh
pnpm exec britepulse init --adapter none --url https://example.com/en/
pnpm exec britepulse doctor --json
pnpm exec britepulse measure --experimental --label baseline --json
```

Replace the URL with the final deployed URL, including its locale/trailing slash when necessary. Use `bundle.adapter: "none"` in hand-written configuration. Runs record `framework: "generic"`; no Vite, Next.js, Expo or Gatsby bundle attribution is claimed. The collector still requires Chrome and its pinned engine/launcher, and existing experimental cold-cache restrictions apply.

Several sites can be separate named environments, each with its own `urls` array. Use `--environment <name>` to select one. A shared environment can contain all target URLs. `history` lists retained results; a timeout or failed navigation is not a measured score.

## Compare two saved builds and share a report

Collect and import both builds, then find their UUIDs:

```sh
pnpm exec britepulse history --json
```

Use the selected IDs as baseline and candidate. Labels need not be unique:

```sh
pnpm exec britepulse compare --baseline BASELINE_UUID --candidate CANDIDATE_UUID --json
```

The output includes a new comparison `id`, compatibility diagnostics and metric keys/values. Use that comparison ID to export a new file:

```sh
pnpm exec britepulse report --comparison COMPARISON_UUID --output reports/release-comparison.html --json
```

Open the resulting HTML file in a browser. Choose a subject and measurement to inspect its real baseline/candidate values. Unknown/incompatible values do not become bars or numeric differences. The file includes its data, styles and app; share it without starting a server. Choose a new filename for another export, because existing output is never overwritten. See [comparison reference](comparisons-and-reports.md) for compatibility and partial-data semantics.

## Gate a comparison in CI

Create a budget file using the selectors in your saved comparison's `report.json`; see [budget reference](budgets.md). After importing baseline and candidate artifacts with the same profile, create their comparison and evaluate it:

```sh
britepulse compare --baseline "$BASELINE_ID" --candidate "$CANDIDATE_ID" --json > comparison.json
COMPARISON_ID=$(node -p "JSON.parse(require('node:fs').readFileSync('comparison.json','utf8')).id")
britepulse report --comparison "$COMPARISON_ID" --budgets budgets.json --output comparison.html
britepulse budget --comparison "$COMPARISON_ID" --budgets budgets.json --output budget-result.json --json
```

Use fresh output paths per job. Upload the HTML and JSON as CI artifacts, including on failure. Preserve exit codes 1 (violation) and 2 (measurement/configuration error); either should fail the job. Source artifact collection remains your build pipeline's responsibility.
