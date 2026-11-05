# Vite production bundle collection

The first shipping adapter supports Vite 8.3.5, the version validated by fixtures. Other versions fail with a diagnostic. The integration is production-only and uses Vite hooks; it does not rewrite application files.

## Integration interface

The `britepulse` named export from `britepulse/vite` creates a production-only Vite plugin. Add it alongside the application's other plugins. [How-to guides](how-to-guides.md) contains setup, compression and SSR recipes; [Getting started](getting-started.md) provides a complete exercise.

| Option        | Default                  | Meaning                                                |
| ------------- | ------------------------ | ------------------------------------------------------ |
| `compression` | `false`                  | Include gzip level 9 and Brotli quality 11 estimates   |
| `fileName`    | `britepulse-bundle.json` | Single output JSON filename; collisions fail the build |

The plugin writes into the actual build output directory. Multiple entrypoints and separate client/SSR builds are supported. Multiple output formats sharing one directory are rejected. `analyze --artifact <path>` imports the original JSON; `--target ssr` is required for SSR artifacts. The normalized snapshot receives a local run ID, while manifest build identity preserves the source build ID. Repeated imports create distinct runs.

## What the artifact measures

The snapshot measures exact emitted JS, CSS and other output bytes. Manifest CSS and static asset links join the chunk graph. Initial entrypoint closures follow static references; asynchronous closures follow all reachable imports with initial assets subtracted. Shared chunks are deduplicated. Missing emitted references become explicit unknown-size records. Entrypoints are build facts, not inferred React Router or TanStack routes.

The adapter enables a Vite manifest only when the application has not set a manifest option. An explicitly disabled manifest produces a partial snapshot with a diagnostic. Unattributed emitted CSS also produces a diagnostic. Module identifiers are retained, but no module byte sizes or complete package attribution are inferred.

Compression is optional and disabled by default. When enabled, gzip level 9 and Brotli quality 11 estimates are stored with the snapshot. They are estimates over emitted files, not measured network transfer. Parsed and transfer byte fields stay unknown.

Client and SSR targets are distinct. External imports are excluded from emitted totals and reported as incomplete attribution. The adapter's own metadata file is excluded from the bundle; other files emitted by the build remain visible. Source maps and metadata are not automatically treated as a user's initial network download.

Collection status follows snapshot completeness, so an incomplete artifact is stored as a partial run. Import validation rejects unsupported versions and target mismatches before creating history entries. The dashboard still uses labeled sample data until the shared report feature is connected.
