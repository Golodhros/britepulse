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
