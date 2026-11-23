import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const variant = process.env.BRITEPULSE_VARIANT ?? 'baseline';
if (!['baseline', 'candidate'].includes(variant)) throw new Error('Invalid fixture variant');

export function createNextConfig() {
  return {
    distDir: `.artifacts/${process.env.BRITEPULSE_BACKEND ?? 'webpack'}-${variant}`,
    experimental: { cpus: 1 },
    turbopack: { resolveAlias: { 'fixture-variant': `./src/${variant}.js` } },
    webpack(config, { isServer }) {
      config.resolve.alias['fixture-variant'] = resolve(`src/${variant}.js`);
      if (!isServer)
        config.plugins.push({
          apply(compiler) {
            compiler.hooks.done.tap('BritePulseFixtureStats', (stats) => {
              const dir = resolve(`.artifacts/webpack-${variant}`);
              mkdirSync(dir, { recursive: true });
              writeFileSync(
                resolve(dir, 'client-stats.json'),
                JSON.stringify(
                  stats.toJson({
                    all: false,
                    version: true,
                    assets: true,
                    chunks: true,
                    chunkRelations: true,
                    modules: true,
                    entrypoints: true,
                  }),
                ),
              );
            });
          },
        });

      return config;
    },
  };
}
