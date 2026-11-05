import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { httpUrl, nonempty, parseValidated, schemaVersion } from './validation.js';

const syntheticSettings = z.strictObject({
  runs: z.number().int().min(1).max(100).default(3),
  warmups: z.number().int().min(0).max(20).default(0),
  retries: z.number().int().min(0).max(10).default(1),
  timeoutMs: z.number().int().min(1000).max(600_000).default(60_000),
  device: z.enum(['desktop', 'mobile']).default('mobile'),
  cache: z.enum(['cold', 'warm']).default('cold'),
  authHook: nonempty.optional(),
});
const bundleSettings = z.strictObject({
  adapter: z.enum(['vite', 'next-webpack']).default('vite'),
  buildCommand: z.array(nonempty).min(1).default(['npm', 'run', 'build']),
  outputDir: nonempty.default('dist'),
  statsFile: nonempty.optional(),
});
const environmentSettings = z.record(nonempty, z.strictObject({ urls: z.array(httpUrl).min(1) }));
export const configSchema = z
  .strictObject({
    schemaVersion,
    appRoot: nonempty.default('.'),
    environment: nonempty.default('local'),
    environments: environmentSettings,
    synthetic: syntheticSettings.prefault({}),
    bundle: bundleSettings.prefault({}),
    outputDir: nonempty.default('.britepulse'),
  })
  .refine((config) => Object.hasOwn(config.environments, config.environment), {
    path: ['environment'],
    message: 'Selected environment is missing from environments',
  });
const overridesSchema = z.strictObject({
  appRoot: nonempty.optional(),
  environment: nonempty.optional(),
  environments: environmentSettings.optional(),
  synthetic: z
    .strictObject({
      runs: syntheticSettings.shape.runs.removeDefault(),
      warmups: syntheticSettings.shape.warmups.removeDefault(),
      retries: syntheticSettings.shape.retries.removeDefault(),
      timeoutMs: syntheticSettings.shape.timeoutMs.removeDefault(),
      device: syntheticSettings.shape.device.removeDefault(),
      cache: syntheticSettings.shape.cache.removeDefault(),
      authHook: syntheticSettings.shape.authHook,
    })
    .partial()
    .optional(),
  bundle: z
    .strictObject({
      adapter: bundleSettings.shape.adapter.removeDefault(),
      buildCommand: bundleSettings.shape.buildCommand.removeDefault(),
      outputDir: bundleSettings.shape.outputDir.removeDefault(),
      statsFile: bundleSettings.shape.statsFile,
    })
    .partial()
    .optional(),
  outputDir: nonempty.optional(),
});
export type ProjectConfig = z.infer<typeof configSchema>;
export interface ResolvedConfig extends ProjectConfig {
  configPath: string | null;
  fingerprint: string;
}

function compareKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJSON(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Flag values override project values, which override schema defaults. Paths are relative to the config directory. */
export function resolveConfig(
  project: unknown,
  overrides: unknown = {},
  configPath: string | null = null,
  cwd = process.cwd(),
): ResolvedConfig {
  // Validate the project independently: flags must not hide a typo or unsupported schema version.
  const settings = parseValidated(configSchema, project, 'Invalid project configuration');
  const parsedFlags = parseValidated(overridesSchema, overrides, 'Invalid configuration overrides');
  const defined = (value: object | undefined) =>
    Object.fromEntries(Object.entries(value ?? {}).filter(([, item]) => item !== undefined));
  const flags = {
    ...parsedFlags,
    synthetic: defined(parsedFlags.synthetic),
    bundle: defined(parsedFlags.bundle),
  };
  const merged = parseValidated(
    configSchema,
    {
      ...settings,
      ...defined(flags),
      synthetic: { ...settings.synthetic, ...flags.synthetic },
      bundle: { ...settings.bundle, ...flags.bundle },
    },
    'Invalid resolved configuration',
  );
  const base = configPath === null ? resolve(cwd) : dirname(resolve(cwd, configPath));
  const appRoot = resolve(base, merged.appRoot);
  const normalized = {
    ...merged,
    appRoot,
    outputDir: resolve(appRoot, merged.outputDir),
    synthetic: {
      ...merged.synthetic,
      ...(merged.synthetic.authHook ? { authHook: resolve(base, merged.synthetic.authHook) } : {}),
    },
    bundle: {
      ...merged.bundle,
      outputDir: resolve(appRoot, merged.bundle.outputDir),
      ...(merged.bundle.statsFile ? { statsFile: resolve(appRoot, merged.bundle.statsFile) } : {}),
    },
  };
  const fingerprint = createHash('sha256')
    .update(
      stableJSON({
        environment: merged.environment,
        urls: merged.environments[merged.environment]!.urls,
        synthetic: merged.synthetic,
        bundle: merged.bundle,
      }),
    )
    .digest('hex');
  return {
    ...normalized,
    configPath: configPath === null ? null : resolve(cwd, configPath),
    fingerprint,
  };
}

export async function loadConfig(
  path = 'britepulse.config.json',
  overrides: unknown = {},
  cwd = process.cwd(),
): Promise<ResolvedConfig> {
  const absolute = resolve(cwd, path);
  let project: unknown;
  try {
    project = JSON.parse(await readFile(absolute, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read configuration ${absolute}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return resolveConfig(project, overrides, absolute, cwd);
}
