import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleStats } from 'rollup-plugin-bundle-stats';
import { resolve } from 'node:path';
const variant = process.env.BRITEPULSE_VARIANT ?? 'baseline';
if (!['baseline', 'candidate'].includes(variant)) throw new Error('Invalid fixture variant');
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'britepulse-compatibility-probe',
      generateBundle(_options, bundle) {
        const assets = Object.values(bundle).map((item) => ({
          fileName: item.fileName,
          type: item.type,
          emittedBytes: Buffer.byteLength(item.type === 'chunk' ? item.code : item.source),
          ...(item.type === 'chunk'
            ? {
                isEntry: item.isEntry,
                imports: item.imports,
                dynamicImports: item.dynamicImports,
                modules: Object.keys(item.modules),
              }
            : {}),
        }));
        this.emitFile({
          type: 'asset',
          fileName: 'probe.json',
          source: JSON.stringify({ schemaVersion: 1, assets }, null, 2),
        });
      },
    },
    bundleStats({ html: false, json: true, baseline: false }),
  ],
  resolve: { alias: { 'fixture-variant': resolve(`src/${variant}.js`) } },
  build: { outDir: `.artifacts/${variant}`, manifest: true },
});
