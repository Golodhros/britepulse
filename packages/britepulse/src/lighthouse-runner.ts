import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResolvedConfig } from './config.js';
import type { RunSession } from './store.js';
import { SyntheticRunnerFatalError, type SyntheticRunner } from './synthetic-scheduler.js';
import { runCommand } from './process.js';
import { withTemporaryDirectory } from './orchestration.js';
import { normalizeLighthouseReport } from './lighthouse-report.js';

export function resolveLighthouse(appRoot: string): { engine: string; launcher: string } {
  if (process.platform === 'win32')
    throw new Error('Experimental measurement currently requires macOS or Linux');
  const require = createRequire(join(appRoot, 'package.json'));
  try {
    const engine = require.resolve('lighthouse');
    const manifest = require('lighthouse/package.json') as { version: string };
    if (manifest.version !== '13.6.0') throw new Error('Expected Lighthouse 13.6.0');

    const launcher = require.resolve('chrome-launcher', { paths: [engine] });
    const launcherManifest = require(
      require.resolve('chrome-launcher/package.json', { paths: [engine] }),
    ) as { version: string };
    if (launcherManifest.version !== '1.2.2') throw new Error('Expected chrome-launcher 1.2.2');

    return { engine, launcher };
  } catch (error) {
    throw new Error(
      'Install lighthouse@13.6.0 with chrome-launcher@1.2.2 in the application before experimental measurement',
      { cause: error },
    );
  }
}

function browserProcessExists(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

/** Chrome has its own process group. Reap it even if the worker was forcibly terminated. */
async function reapChrome(directory: string): Promise<void> {
  let pid: string;
  try {
    pid = await readFile(join(directory, 'chrome/chrome.pid'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!/^\d+\s*$/.test(pid) || Number(pid) <= 1) throw new Error('Invalid Chrome process ID');
  try {
    process.kill(-Number(pid), 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
  for (let retry = 0; retry < 100; retry++) {
    if (!browserProcessExists(Number(pid))) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Chrome process did not terminate');
}

async function runWorker(
  config: ResolvedConfig,
  input: string,
  directory: string,
  signal: AbortSignal,
): Promise<Error | null> {
  let stderr = '';
  try {
    const result = await runCommand(
      [process.execPath, fileURLToPath(new URL('./lighthouse-worker.js', import.meta.url)), input],
      {
        cwd: config.appRoot,
        timeoutMs: config.synthetic.timeoutMs,
        signal,
        onStderr: (chunk) => {
          stderr = (stderr + chunk).slice(-8000);
        },
      },
    );
    if (result.code !== 0)
      throw new Error(`Lighthouse worker failed: ${stderr || result.signal || result.code}`);

    return null;
  } catch (error) {
    try {
      await reapChrome(directory);
    } catch (cleanupError) {
      throw new SyntheticRunnerFatalError('Could not terminate Chrome', cleanupError);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

async function optionalReport(directory: string, name: string): Promise<string | null> {
  try {
    return await readFile(join(directory, name), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function persistReports(directory: string, session: RunSession, base: string) {
  const json = await optionalReport(directory, 'report.json');
  const html = await optionalReport(directory, 'report.html');
  const reports = {
    json: json === null ? null : `${base}.json`,
    html: html === null ? null : `${base}.html`,
  };
  if (json !== null) await session.writeArtifact(reports.json!, json);
  if (html !== null) await session.writeArtifact(reports.html!, html);

  return { json, reports };
}

export function createLighthouseRunner(
  config: ResolvedConfig,
  engine: { engine: string; launcher: string },
  session: RunSession,
  page: number,
  diagnostics: string[],
): SyntheticRunner {
  return async (attempt) =>
    withTemporaryDirectory(async (directory) => {
      await mkdir(join(directory, 'chrome'));
      const input = join(directory, 'input.json');
      await writeFile(
        input,
        JSON.stringify({ url: attempt.url, ...engine, directory, device: config.synthetic.device }),
      );
      const failure = await runWorker(config, input, directory, attempt.signal);
      try {
        const { json, reports } = await persistReports(
          directory,
          session,
          `original/synthetic/page-${page}/attempt-${attempt.attempt}`,
        );
        if (failure) return { status: 'failed', error: failure.message, metrics: {}, reports };
        if (json === null || reports.html === null)
          throw new Error('Lighthouse worker omitted an original report');
        const normalized = normalizeLighthouseReport(JSON.parse(json), {
          url: attempt.url,
          reports,
        });
        diagnostics.push(
          ...normalized.diagnostics.map(
            (message) => `${attempt.url} attempt ${attempt.attempt}: ${message}`,
          ),
        );

        return normalized.outcome;
      } catch (error) {
        throw new SyntheticRunnerFatalError(
          'Could not persist or normalize Lighthouse reports',
          error,
        );
      }
    });
}
