import { randomUUID } from 'node:crypto';
import {
  link,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { z } from 'zod';
import {
  comparisonSchema,
  parseRunManifest,
  type Comparison,
  type RunManifest,
} from './contracts.js';
import { parseValidated, relativeArtifactPath } from './validation.js';

export type RunMetadata = Pick<
  RunManifest,
  'label' | 'environment' | 'framework' | 'configFingerprint' | 'toolVersions' | 'git' | 'identity'
>;
type FinishedStatus = Exclude<RunManifest['status'], 'running'>;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function atomicJSON(directory: string, filename: string, value: unknown): Promise<void> {
  const temporary = join(directory, `.manifest-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx',
    });
    await rename(temporary, join(directory, filename));
  } finally {
    await rm(temporary, { force: true });
  }
}

function atomicManifest(directory: string, manifest: RunManifest): Promise<void> {
  return atomicJSON(directory, 'manifest.json', parseRunManifest(manifest));
}

/** Create child directories while refusing to follow symlinks inside a run. */
async function artifactDestination(directory: string, name: string): Promise<string> {
  const path = parseValidated(relativeArtifactPath, name, 'Invalid artifact path');
  if (path === 'manifest.json') throw new Error('manifest.json is managed by the run store');
  const parts = path.split('/');
  let current = directory;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    try {
      await mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(`Artifact directory is not an ordinary directory: ${part}`);
  }

  return join(directory, ...parts);
}

class RunSession {
  #manifest: RunManifest;
  #pending: Promise<void> = Promise.resolve();
  #closing = false;
  #writeErrors: string[] = [];
  constructor(
    readonly directory: string,
    manifest: RunManifest,
  ) {
    this.#manifest = structuredClone(manifest);
  }
  get manifest(): RunManifest {
    return structuredClone(this.#manifest);
  }
  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#pending.then(operation);
    // A failed artifact write must not prevent the caller from finalizing a failed/partial run.
    this.#pending = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
  writeArtifact(name: string, contents: string | Uint8Array): Promise<void> {
    if (this.#closing)
      return Promise.reject(new Error('Run has already been finalized or is closing'));

    return this.#enqueue(async () => {
      const destination = await artifactDestination(this.directory, name);
      const temporary = join(dirname(destination), `.artifact-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, contents, { flag: 'wx' });
        // A hard link atomically creates the destination without overwriting an existing artifact.
        await link(temporary, destination);
      } finally {
        await rm(temporary, { force: true });
      }
      const next = parseRunManifest({
        ...this.#manifest,
        artifacts: [...this.#manifest.artifacts, name],
      });
      await atomicManifest(this.directory, next);
      this.#manifest = next;
    }).catch((error) => {
      this.#writeErrors.push(`${name}: ${message(error)}`);
      throw error;
    });
  }
  async writeJSON(name: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === undefined)
      return Promise.reject(new Error('Artifact value is not JSON serializable'));

    return this.writeArtifact(name, serialized + '\n');
  }
  finish(status: FinishedStatus, diagnostics: string[] = []): Promise<RunManifest> {
    if (this.#closing)
      return Promise.reject(new Error('Run has already been finalized or is closing'));
    this.#closing = true;

    return this.#enqueue(async () => {
      if (status === 'complete' && this.#writeErrors.length)
        throw new Error('A run with failed artifact writes cannot be complete');
      const manifest = parseRunManifest({
        ...this.#manifest,
        status,
        diagnostics: [...diagnostics, ...this.#writeErrors],
        finishedAt: new Date().toISOString(),
      });
      await atomicManifest(this.directory, manifest);
      this.#manifest = manifest;

      return this.manifest;
    }).catch((error) => {
      this.#closing = false;
      throw error;
    });
  }
}

export class RunStore {
  readonly directory: string;
  constructor(directory: string) {
    this.directory = resolve(directory);
  }
  async create(metadata: RunMetadata): Promise<RunSession> {
    const manifest = parseRunManifest({
      ...metadata,
      schemaVersion: 1,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running',
      artifacts: [],
      diagnostics: [],
    });
    await mkdir(join(this.directory, 'runs'), { recursive: true });
    const runsDirectory = await realpath(join(this.directory, 'runs'));
    const directory = join(runsDirectory, manifest.id);
    await mkdir(directory); // Exclusive: labels and timestamps never determine identity.
    await atomicManifest(directory, manifest);

    return new RunSession(directory, manifest);
  }
  async read(id: string): Promise<RunManifest> {
    const runId = parseValidated(z.uuid(), id, 'Invalid run ID');
    const directory = join(this.directory, 'runs', runId);
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Run is not an ordinary directory');
    const manifestPath = join(directory, 'manifest.json');
    const manifestInfo = await lstat(manifestPath);
    if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink())
      throw new Error('Manifest is not an ordinary file');
    const manifest = parseRunManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
    if (manifest.id !== runId) throw new Error('Manifest ID does not match its directory');

    return manifest;
  }
  async createComparison(input: Omit<Comparison, 'schemaVersion' | 'id'>): Promise<Comparison> {
    const comparison = parseValidated(
      comparisonSchema,
      { ...input, schemaVersion: 1, id: randomUUID() },
      'Invalid comparison',
    );
    await Promise.all([this.read(comparison.baselineId), this.read(comparison.candidateId)]);
    await mkdir(join(this.directory, 'comparisons'), { recursive: true });
    const directory = join(await realpath(join(this.directory, 'comparisons')), comparison.id);
    await mkdir(directory);
    await atomicJSON(directory, 'comparison.json', comparison);

    return comparison;
  }
  async discover(): Promise<{ runs: RunManifest[]; diagnostics: string[] }> {
    let entries;
    try {
      entries = await readdir(join(this.directory, 'runs'), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { runs: [], diagnostics: [] };
      throw error;
    }
    const runs: RunManifest[] = [];
    const diagnostics: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        runs.push(await this.read(entry.name));
      } catch (error) {
        diagnostics.push(`${entry.name}: ${message(error)}`);
      }
    }
    runs.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
    );

    return { runs, diagnostics };
  }
}

export type { RunSession };
