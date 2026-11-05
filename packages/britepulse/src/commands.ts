import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { initializeProject, inspectProject, loadConfig } from './setup.js';
import { RunStore } from './store.js';
const shared = {
  config: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;
const measurement = {
  environment: { type: 'string' },
  runs: { type: 'string' },
  retries: { type: 'string' },
  'timeout-ms': { type: 'string' },
} as const;
const integer = (name: string, value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number`);

  return Number(value);
};

// Direct commands emit JSON; the Clack menu owns human-facing terminal presentation.
function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function initialize(rest: string[]): Promise<void> {
  const { values } = parseArgs({
    args: rest,
    options: {
      ...shared,
      'app-root': { type: 'string' },
      url: { type: 'string', multiple: true },
      adapter: { type: 'string' },
      environment: { type: 'string' },
      runs: { type: 'string' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: britepulse init --url <http(s) URL> [--url <URL>] [--app-root <path>] [--adapter vite|next-webpack] [--runs <count>] [--config <path>]',
    );

    return;
  }
  if (!values.url?.length)
    throw new Error('init requires --url. Run britepulse in a terminal for guided setup.');
  if (
    values.adapter !== undefined &&
    values.adapter !== 'vite' &&
    values.adapter !== 'next-webpack'
  )
    throw new Error('adapter must be vite or next-webpack');
  const result = await initializeProject({
    configPath: values.config ?? 'britepulse.config.json',
    appRoot: values['app-root'] ?? process.cwd(),
    urls: values.url,
    adapter: values.adapter,
    environment: values.environment,
    runs: integer('runs', values.runs),
  });
  print(result);
}

async function analyze(rest: string[]): Promise<void> {
  const { values } = parseArgs({
    args: rest,
    options: {
      ...shared,
      artifact: { type: 'string' },
      'next-build': { type: 'string' },
      label: { type: 'string' },
      target: { type: 'string' },
      environment: { type: 'string' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: britepulse analyze (--artifact <path> | --next-build <directory>) [--label <name>] [--target client|ssr] [--config <path>] [--json]',
    );

    return;
  }
  if (Boolean(values.artifact) === Boolean(values['next-build']))
    throw new Error('analyze requires exactly one of --artifact or --next-build');
  if (values.target !== undefined && values.target !== 'client' && values.target !== 'ssr')
    throw new Error('target must be client or ssr');
  const config = await loadConfig(values.config, { environment: values.environment });
  if (values['next-build']) {
    if (values.target === 'ssr') throw new Error('Next.js import supports client assets only');
    const { importNextPagesBundle } = await import('./next-pages.js');
    print(
      await importNextPagesBundle(config, resolve(values['next-build']), values.label ?? 'bundle'),
    );

    return;
  }
  const { importBundle } = await import('./analyze.js');
  print(
    await importBundle(config, resolve(values.artifact!), values.label ?? 'bundle', values.target),
  );
}

async function measure(rest: string[]): Promise<void> {
  const { values } = parseArgs({
    args: rest,
    options: {
      ...shared,
      ...measurement,
      experimental: { type: 'boolean' },
      label: { type: 'string' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: britepulse measure --experimental [--label <name>] [--config <path>] [--environment <name>] [--runs <count>] [--retries <count>] [--timeout-ms <ms>] [--json]',
    );

    return;
  }
  if (!values.experimental)
    throw new Error('measure requires --experimental; live browser compatibility is not validated');
  const config = await loadConfig(values.config, {
    environment: values.environment,
    synthetic: {
      runs: integer('runs', values.runs),
      retries: integer('retries', values.retries),
      timeoutMs: integer('timeout-ms', values['timeout-ms']),
    },
  });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const { measureProject } = await import('./measure.js');
    const manifest = await measureProject(config, values.label ?? 'synthetic', {
      signal: controller.signal,
    });
    print(manifest);
    if (manifest.status !== 'complete') process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

async function inspect(command: 'doctor' | 'history', rest: string[]): Promise<void> {
  const { values } = parseArgs({ args: rest, options: { ...shared, ...measurement } });
  if (values.help) {
    console.log(
      `Usage: britepulse ${command} [--config <path>] [--environment <name>] [--runs <count>] [--retries <count>] [--timeout-ms <ms>] [--json]`,
    );

    return;
  }
  const config = await loadConfig(values.config, {
    environment: values.environment,
    synthetic: {
      runs: integer('runs', values.runs),
      retries: integer('retries', values.retries),
      timeoutMs: integer('timeout-ms', values['timeout-ms']),
    },
  });
  if (command === 'doctor') {
    const result = await inspectProject(config);
    print(result);
    if (!result.ok) process.exitCode = 2;
  } else {
    print(await new RunStore(resolve(config.outputDir)).discover());
  }
}

export async function execute(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  switch (command) {
    case 'init':
      return initialize(rest);
    case 'measure':
      return measure(rest);
    case 'analyze':
      return analyze(rest);
    case 'doctor':
    case 'history':
      return inspect(command, rest);
    default:
      throw new Error(`Unknown command: ${args.join(' ')}. Run britepulse --help.`);
  }
}
