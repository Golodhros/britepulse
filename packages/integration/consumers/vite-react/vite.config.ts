import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { britepulse } from 'britepulse/vite';
import { fileURLToPath } from 'node:url';
const variant = process.env.BRITEPULSE_VARIANT ?? 'baseline';
if (!['baseline', 'candidate'].includes(variant)) throw new Error('Invalid integration variant');
export default defineConfig({
  plugins: [react(), britepulse({ compression: true })],
  resolve: {
    alias: { 'consumer-variant': fileURLToPath(new URL(`./src/${variant}.js`, import.meta.url)) },
  },
  build: { outDir: `dist/${variant}` },
});
