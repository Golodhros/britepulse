# Getting started: collect your first Vite build

Tutorial · [Documentation home](README.md)

In this exercise you will create a tiny Vite application, collect its production assets, and save your first BritePulse history entry. You will use a local tarball because BritePulse is still preparing its first npm release. No application server or Chrome is needed.

You need a checkout of this repository, Node.js 22.19 or newer, pnpm 12.6.0, and registry access for dependencies. Start in the repository root. Use a fresh `.artifacts/getting-started` directory for this lesson.

## 1. Build a local package

```sh
pnpm install
mkdir -p .artifacts/getting-started
pnpm --filter britepulse pack --pack-destination "$PWD/.artifacts/getting-started"
```

The pack command builds the CLI and dashboard. Find the generated `britepulse-<version>.tgz` in `.artifacts/getting-started`; use its exact filename in the next step.

## 2. Create a small application

```sh
mkdir -p .artifacts/getting-started/app
cd .artifacts/getting-started/app
```

Create `package.json`, replacing `britepulse-<version>.tgz` with the filename from step 1:

```json
{
  "name": "my-first-britepulse-build",
  "private": true,
  "type": "module",
  "scripts": { "build": "vite build" },
  "devDependencies": {
    "britepulse": "file:../britepulse-<version>.tgz",
    "vite": "8.3.5"
  }
}
```

Create `pnpm-workspace.yaml` so this lesson installs its own tarball instead of linking workspace source:

```yaml
packages: []
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My first build</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/app.js"></script>
  </body>
</html>
```

Create `app.js`:

```js
document.querySelector('#app').textContent = 'Hello BritePulse';
```

Create `vite.config.js`:

```js
import { defineConfig } from 'vite';
import { britepulse } from 'britepulse/vite';

export default defineConfig({ plugins: [britepulse()] });
```

Install the application dependencies:

```sh
pnpm install --ignore-scripts
```

You now have an independent Vite application with the installed BritePulse plugin.

## 3. Initialize local history settings

```sh
pnpm exec britepulse init --url http://localhost:5173/ --adapter vite
pnpm exec britepulse doctor --json
```

The first command creates `britepulse.config.json`. The doctor output identifies Vite 8.3.5 and the resolved settings. The URL is configuration metadata for this exercise; these commands do not navigate to it.

## 4. Collect and import a build

```sh
pnpm run build
pnpm exec britepulse analyze --artifact dist/britepulse-bundle.json --label first-build --json
```

The build produces `dist/britepulse-bundle.json`. The import prints a manifest with a UUID `id`, the label `first-build`, and a terminal collection status. This small fixture should produce `complete` collection data.

## 5. Find your saved run

```sh
pnpm exec britepulse history --json
```

The `runs` array now contains your first entry. In `.britepulse/runs/<id>/`, `original/bundle.json` retains the source artifact and `normalized/bundle.json` uses the local run identity. Inspect either file in your editor.

Run the import command from step 4 again. History now contains two different IDs with the same label; collecting a run does not overwrite earlier evidence.

You have completed the collection workflow. To view those runs, follow the [compare-and-report recipe](how-to-guides.md#compare-two-saved-builds-and-share-a-report) and export a comparison HTML file. Continue with a [task recipe](how-to-guides.md), consult [the CLI reference](reference.md), or read [how measurement identities and unknowns work](measurement-model.md).
