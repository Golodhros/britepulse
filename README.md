# BritePulse

An open source local workflow for frontend performance checks, bundle analysis, and release comparisons for Vite and Next.js applications.

## Documentation

Start with the [documentation home](docs/README.md), [Getting started tutorial](docs/getting-started.md), [How-to guides](docs/how-to-guides.md), [CLI reference](docs/reference.md), or [architecture diagrams](Architecture.md). Documentation separates tutorials, recipes, reference and explanation following Diátaxis.

## Development

Use Node.js 22.19 or newer and pnpm 12.6.0.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. The dashboard uses React, TypeScript, Tailwind CSS, Shadcn UI components, and Britecharts. The dashboard reads real comparison data; without a comparison it shows an explicit empty state.

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm test:package
pnpm test:integration
pnpm --filter britepulse dev --help
pnpm --filter britepulse dev
pnpm --filter @britepulse/report preview
```

Build once before running the compiled CLI. The last command previews the production report after building it. Vite uses relative asset URLs so the prebuilt dashboard can be packaged for local serving. The report command exports a standalone HTML file with real comparison data, styles and the prebuilt app; no report server is required.

## Workspace

- `packages/britepulse`: Clack CLI, configuration, data contracts, local history and optional bundle adapters. Interactive prompts require a terminal; redirected input fails promptly with exit code 2.
- `packages/report`: Vite dashboard application. `components.json` configures the Shadcn registry and `@/` aliases. UI components live in `src/components/ui`.

Add Shadcn components from the report directory:

```sh
cd packages/report
pnpm dlx shadcn@latest add button
```

The current scaffold adapts the Shadcn Card component. See [Shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite) and [Britecharts React](https://britecharts.github.io/britecharts/docs/packages/react-readme).

Oxfmt owns formatting; `pnpm format` writes changes and `pnpm format:check` verifies them. ESLint includes the TypeScript and SonarJS recommended rules, plus blank-line checks around function declarations/exports and before returns. Use `pnpm exec eslint --fix --fix-type layout <files>` to apply spacing fixes without semantic lint fixes. Whole-Lodash imports are exempted only in the four candidate fixtures that deliberately create measurable bundle growth; production code uses the full recommended ruleset.

## Development skills

[AGENTS.md](AGENTS.md) indexes the repository's `.agents/skills` workflows. Use `$audit-changes` for checks and `$quality` for the implement-review-cleanup loop, with focused skills for Node tests, installed-consumer integration tests and report views.

## Configure a project

After building, use the compiled CLI:

```sh
node packages/britepulse/dist/cli.js init --app-root /path/to/app --url http://localhost:3000/
node packages/britepulse/dist/cli.js doctor --runs 5 --json
node packages/britepulse/dist/cli.js history --json
```

The installed tarball provides the same commands as `britepulse`. Initialization never overwrites existing settings. Use `--config <path>` to select a configuration file. Run with no command in a terminal for the Clack setup menu. See [configuration contracts](docs/configuration.md) and [local storage](docs/local-storage.md).

## Collect a Vite bundle

Add `britepulse()` from `britepulse/vite` to the application's Vite plugins, build normally, then import the generated artifact:

```sh
britepulse analyze --artifact /path/to/app/dist/britepulse-bundle.json --label baseline
britepulse history --json
```

See [Vite integration](docs/vite-integration.md) for tested versions, CSS and dynamic import handling, SSR targets and compression estimates.

## Consumer integration tests

`pnpm test:integration` packs and installs the tool into isolated CLI-only and Vite React consumers, then tests public exports, strict TypeScript usage, real builds and the installed CLI workflow. See [integration tests](packages/integration/README.md) for coverage and individual phases. `pnpm test:package` runs the packaging subset.

## Compatibility

See [tested paths and limitations](docs/compatibility.md), [engine decisions](docs/decisions/measurement-engines.md), and [iteration reviews](docs/implementation-progress.md). Run `pnpm test:compatibility` for production fixture pairs and `pnpm test:native` for native Next.js analysis. The engine comparison (`pnpm test:synthetic`) and collector probe (`pnpm test:synthetic:collector`) require Chrome and a loopback port. See [experimental collection](docs/configuration.md#experimental-lighthouse-collection) for setup and limits.

## Status and next work

The workspace includes a comparison dashboard, a compiled interactive CLI, compatibility fixtures, and prebuilt dashboard assets in the CLI tarball. `--help` and `--version` run without loading Clack, React, charts, or a browser. It includes configuration validation and programmatic immutable local history. It imports Vite production artifacts and Next.js Pages client Webpack builds into local history, with explicit partial Next.js attribution. An experimental `measure --experimental` command collects cold-cache Lighthouse reports using application-installed Lighthouse 13.6.0 and chrome-launcher 1.2.2 on macOS/Linux; live browser compatibility is unvalidated. Warm-cache collection, authentication hooks, App Router/Turbopack attribution, budgets and automated build orchestration remain in progress. Shared comparisons and real-data HTML report export are implemented; local browser rendering remains unverified because Chrome launch is blocked. Unknown/partial/incompatible measurements stay explicit; no significance verdict is implied.

Next: finish live runner validation, add automated build invocation and asynchronous Next.js attribution, then complete CI budgets and release validation. Measurements will retain individual samples and report per-metric medians, with three measured runs by default. Remote storage is outside the initial scope.

## Beta release preparation

Changesets has prepared `0.1.0-beta.0`. See [beta notes](docs/beta-release-notes.md), [release how-to](docs/releases.md) and [release reference](docs/release-reference.md). `pnpm release:check` verifies a tarball; `pnpm release:plan` prints a non-publishing plan. Publishing is a separate manual GitHub workflow and has not been performed.

## License

[MIT](LICENSE). Shadcn UI components are adapted under the [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md); Britecharts is Apache-2.0.
