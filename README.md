# BritePulse

An open source local workflow for frontend performance checks, bundle analysis, and release comparisons for Vite and Next.js applications.

## Development

Use Node.js 22.19 or newer and pnpm 12.6.0.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. The dashboard uses React, TypeScript, Tailwind CSS, Shadcn UI components, and Britecharts. Its page and measurement filters work with clearly labeled illustrative data.

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

Build once before running the compiled CLI. The last command previews the production report after building it. Vite uses relative asset URLs so the prebuilt dashboard can be packaged for local serving. Report export and a CLI report server are future work.

## Workspace

- `packages/britepulse`: Clack CLI, configuration, data contracts, local history and optional bundle adapters. Interactive prompts require a terminal; redirected input fails promptly with exit code 2.
- `packages/report`: Vite dashboard application. `components.json` configures the Shadcn registry and `@/` aliases. UI components live in `src/components/ui`.

Add Shadcn components from the report directory:

```sh
cd packages/report
pnpm dlx shadcn@latest add button
```

The current scaffold adapts the Shadcn Card component. See [Shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite) and [Britecharts React](https://britecharts.github.io/britecharts/docs/packages/react-readme).

ESLint includes the TypeScript and SonarJS recommended rules. Whole-Lodash imports are exempted only in the four candidate fixtures that deliberately create measurable bundle growth; production code uses the full recommended ruleset.

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

See [tested paths and limitations](docs/compatibility.md), [engine decisions](docs/decisions/measurement-engines.md), and [iteration reviews](docs/implementation-progress.md). Run `pnpm test:compatibility` for production fixture pairs and `pnpm test:native` for native Next.js analysis. The live synthetic probe (`pnpm test:synthetic`) requires Chrome and a loopback port.

## Status and next work

The workspace includes a sample dashboard, a compiled interactive CLI, compatibility fixtures, and prebuilt dashboard assets in the CLI tarball. `--help` and `--version` run without loading Clack, React, charts, or a browser. It includes configuration validation and programmatic immutable local history. It imports production Vite bundle artifacts into local history. Lighthouse collection, Next.js import, computed comparisons, budgets, and real-data report export remain in progress. Sample values are not performance findings.

Next: finish runner validation and median aggregation, add automated build invocation and validated Next.js import, and connect comparisons and real data to the dashboard before budgets and release validation. Measurements will retain individual samples and report per-metric medians, with three measured runs by default. Remote storage is outside the initial scope.

## License

[MIT](LICENSE). Shadcn UI components are adapted under the [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md); Britecharts is Apache-2.0.
