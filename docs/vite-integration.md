# Vite production bundle collection

The first shipping adapter supports Vite 8.3.5, the version validated by fixtures. Other versions fail with a diagnostic. The integration is production-only and uses Vite hooks; it does not rewrite application files.

Add the optional integration to the application's existing Vite configuration:

```ts
import { defineConfig } from 'vite';
import { britepulse } from 'britepulse/vite';

export default defineConfig({
  plugins: [britepulse({ compression: true })],
});
```

Build the application normally. The adapter writes `britepulse-bundle.json` into the actual output directory. `fileName` can select a different single JSON filename. An artifact filename collision fails the build. Multiple entrypoints and separate client/SSR builds are supported. Multiple output formats sharing one directory are rejected rather than silently overwriting each other's artifact.

Import the artifact into local history:

```sh
britepulse analyze --artifact /path/to/app/dist/britepulse-bundle.json --label baseline
britepulse history --json
```

Use `--config <path>` to choose settings, and explicitly select `--target ssr` to import an SSR artifact. The original JSON is retained. The normalized snapshot receives the local run ID; the source artifact's build ID is preserved in manifest build identity. Repeated imports create distinct local runs.

## What the artifact measures

The snapshot measures exact emitted JS, CSS and other output bytes. Manifest CSS and static asset links join the chunk graph. Initial entrypoint closures follow static references; asynchronous closures follow all reachable imports with initial assets subtracted. Shared chunks are deduplicated. Missing emitted references become explicit unknown-size records. Entrypoints are build facts, not inferred React Router or TanStack routes.

The adapter enables a Vite manifest only when the application has not set a manifest option. An explicitly disabled manifest produces a partial snapshot with a diagnostic. Unattributed emitted CSS also produces a diagnostic. Module identifiers are retained, but no module byte sizes or complete package attribution are inferred.

Compression is optional and disabled by default. When enabled, gzip level 9 and Brotli quality 11 estimates are stored with the snapshot. They are estimates over emitted files, not measured network transfer. Parsed and transfer byte fields stay unknown.

Client and SSR targets are distinct. External imports are excluded from emitted totals and reported as incomplete attribution. The adapter's own metadata file is excluded from the bundle; other files emitted by the build remain visible. Source maps and metadata are not automatically treated as a user's initial network download.

Collection status follows snapshot completeness, so an incomplete artifact is stored as a partial run. Import validation rejects unsupported versions and target mismatches before creating history entries. The dashboard still uses labeled sample data until the shared report feature is connected.
