import { intro, outro, select, text, isCancel, cancel, log } from '@clack/prompts';
import { resolve } from 'node:path';
import { detectProject, initializeProject, inspectProject, loadConfig } from './setup.js';
import { httpUrl } from './validation.js';
import { RunStore } from './store.js';
import type { DoctorCheck } from './setup.js';
import type { ResolvedConfig } from './config.js';
function cancelled(value: unknown): value is symbol {
  if (!isCancel(value)) return false;
  cancel('Cancelled.');
  process.exitCode = 130;
  return true;
}
async function guidedSetup(): Promise<void> {
  const appRoot = await text({
    message: 'Application directory',
    initialValue: process.cwd(),
    validate: (value) => (value?.trim() ? undefined : 'Enter a directory'),
  });
  if (cancelled(appRoot)) return;
  const { adapters } = await detectProject(resolve(appRoot));
  const adapter =
    adapters.length === 1
      ? adapters[0]!
      : await select({
          message: 'Which bundle adapter should this project use?',
          options: [
            { value: 'vite' as const, label: 'Vite' },
            {
              value: 'next-webpack' as const,
              label: 'Next.js Webpack',
              hint: 'route support depends on router',
            },
          ],
        });
  if (cancelled(adapter)) return;
  const urls = await text({
    message: 'URLs to measure, separated by commas',
    placeholder: 'http://localhost:3000/, http://localhost:3000/checkout',
    validate: (value) =>
      value?.split(',').every((url) => httpUrl.safeParse(url.trim()).success)
        ? undefined
        : 'Enter HTTP or HTTPS URLs',
  });
  if (cancelled(urls)) return;
  const runs = await text({
    message: 'Measured runs per URL (reported as per-metric medians)',
    initialValue: '3',
    validate: (value) =>
      /^\d+$/.test(value ?? '') && Number(value) >= 1 && Number(value) <= 100
        ? undefined
        : 'Enter a whole number from 1 to 100',
  });
  if (cancelled(runs)) return;
  const result = await initializeProject({
    configPath: 'britepulse.config.json',
    appRoot,
    adapter,
    urls: urls.split(',').map((url) => url.trim()),
    runs: Number(runs),
  });
  log.success(`Saved ${result.configPath}`);
  outro('Run britepulse doctor to inspect the resolved project settings.');
}
function printCheck(check: DoctorCheck): void {
  const output = `${check.name}: ${check.detail}`;
  if (check.status === 'error') log.error(output);
  else if (check.status === 'warning') log.warn(output);
  else log.success(output);
}

async function showDoctor(config: ResolvedConfig): Promise<void> {
  const result = await inspectProject(config);
  for (const check of result.checks) printCheck(check);
  log.info(
    `${config.environment}: ${config.environments[config.environment]!.urls.join(', ')}; ${config.synthetic.runs} measured runs per URL`,
  );
  outro(result.ok ? 'Configuration checks passed.' : 'Resolve the checks above before collection.');
  if (!result.ok) process.exitCode = 2;
}

async function showHistory(config: ResolvedConfig): Promise<void> {
  const { runs, diagnostics } = await new RunStore(config.outputDir).discover();
  for (const diagnostic of diagnostics) log.warn(diagnostic);
  for (const run of runs) log.info(`${run.id} · ${run.label} · ${run.status} · ${run.createdAt}`);
  outro(runs.length ? `${runs.length} local runs` : 'No local runs yet.');
}

export async function interactive(): Promise<void> {
  intro('BritePulse');
  const task = await select({
    message: 'What would you like to do?',
    options: [
      { value: 'init', label: 'Set up a project' },
      { value: 'doctor', label: 'Check project configuration' },
      { value: 'history', label: 'View local run history' },
    ],
  });
  if (cancelled(task)) return;
  if (task === 'init') return guidedSetup();
  const config = await loadConfig();
  if (task === 'doctor') return showDoctor(config);
  return showHistory(config);
}
