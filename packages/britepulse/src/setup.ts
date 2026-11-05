import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { configSchema, loadConfig, type ResolvedConfig } from './config.js';

const packageSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

export async function detectProject(
  appRoot: string,
): Promise<{ adapters: Array<'vite' | 'next-webpack'> }> {
  const pkg = packageSchema.parse(
    JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8')),
  );
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const adapters: Array<'vite' | 'next-webpack'> = [];
  if (dependencies.vite) adapters.push('vite');
  if (dependencies.next) adapters.push('next-webpack');

  return { adapters };
}

export interface InitOptions {
  configPath: string;
  appRoot: string;
  urls: string[];
  environment?: string;
  adapter?: 'vite' | 'next-webpack';
  runs?: number;
}

export async function initializeProject(
  options: InitOptions,
): Promise<{ configPath: string; config: z.infer<typeof configSchema> }> {
  const appRoot = resolve(options.appRoot);
  const configPath = resolve(options.configPath);
  const { adapters } = await detectProject(appRoot);
  const adapter = options.adapter ?? (adapters.length === 1 ? adapters[0] : undefined);
  if (!adapter)
    throw new Error(
      adapters.length > 1
        ? 'Both Vite and Next.js were detected; choose --adapter explicitly.'
        : 'No supported framework detected; choose --adapter explicitly.',
    );
  const environment = options.environment ?? 'local';
  const config = configSchema.parse({
    schemaVersion: 1,
    appRoot: relative(dirname(configPath), appRoot) || '.',
    environment,
    environments: { [environment]: { urls: options.urls } },
    synthetic: { runs: options.runs ?? 3 },
    bundle: { adapter, outputDir: adapter === 'vite' ? 'dist' : '.next' },
  });
  await mkdir(dirname(configPath), { recursive: true });
  // Never overwrite a project configuration, even when two setup processes race.
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });

  return { configPath, config };
}

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'warning' | 'error';
  detail: string;
}

export async function inspectProject(
  config: ResolvedConfig,
): Promise<{ ok: boolean; config: ResolvedConfig; checks: DoctorCheck[] }> {
  const checks: DoctorCheck[] = [];
  const check = async (name: string, operation: () => Promise<string>) => {
    try {
      checks.push({ name, status: 'pass', detail: await operation() });
    } catch (error) {
      checks.push({
        name,
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await check('application', async () => {
    if (!(await stat(config.appRoot)).isDirectory())
      throw new Error('Application root is not a directory');

    return config.appRoot;
  });
  await check('framework', async () => {
    const { adapters } = await detectProject(config.appRoot);
    if (!adapters.includes(config.bundle.adapter))
      throw new Error(
        `Configured adapter ${config.bundle.adapter} does not match the application dependencies`,
      );

    return config.bundle.adapter;
  });
  await check('installed-tool', async () => {
    const require = createRequire(join(config.appRoot, 'package.json'));
    const name = config.bundle.adapter === 'vite' ? 'vite' : 'next';
    const pkg = JSON.parse(await readFile(require.resolve(`${name}/package.json`), 'utf8')) as {
      version: string;
    };
    const validated = name === 'vite' ? '8.3.5' : '16.4.5';
    if (pkg.version !== validated) {
      checks.push({
        name: 'compatibility',
        status: 'warning',
        detail: `${name} ${pkg.version} is not the fixture-validated version ${validated}; integration compatibility is unverified`,
      });
    }

    return `${name} ${pkg.version}`;
  });
  if (config.synthetic.authHook)
    await check('auth-hook', async () => {
      if (!(await stat(config.synthetic.authHook!)).isFile())
        throw new Error('Authentication hook is not a file');

      return config.synthetic.authHook!;
    });
  await check('local-storage', async () => {
    let candidate = config.outputDir;
    while (true) {
      try {
        const info = await stat(candidate);
        if (!info.isDirectory()) throw new Error('Storage parent is not a directory');
        await access(candidate, constants.W_OK);

        return config.outputDir;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(candidate) === candidate)
          throw error;
        candidate = dirname(candidate);
      }
    }
  });

  return { ok: checks.every((item) => item.status !== 'error'), config, checks };
}

export { loadConfig };
