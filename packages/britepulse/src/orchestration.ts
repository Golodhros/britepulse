import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunStore, type RunMetadata, type RunSession } from './store.js';
import { CommandInterruptedError } from './process.js';
import type { RunManifest } from './contracts.js';

export async function withTemporaryDirectory<T>(
  operation: (directory: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'britepulse-'));
  try {
    return await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export class RunExecutionError extends Error {
  constructor(
    readonly manifest: RunManifest,
    cause: unknown,
  ) {
    super(
      `Run ${manifest.id} ${manifest.status}: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'RunExecutionError';
  }
}
/** Persist a terminal state even when collection fails or is cancelled. */
export async function collectRun<T>(
  store: RunStore,
  metadata: RunMetadata,
  operation: (session: RunSession) => Promise<T>,
  completion: { status: 'complete' | 'partial'; diagnostics?: string[] } = { status: 'complete' },
): Promise<{ value: T; manifest: RunManifest }> {
  const session = await store.create(metadata);
  try {
    const value = await operation(session);
    const manifest = await session.finish(completion.status, completion.diagnostics);
    return { value, manifest };
  } catch (error) {
    const status =
      error instanceof CommandInterruptedError && error.reason === 'cancelled'
        ? 'cancelled'
        : session.manifest.artifacts.length
          ? 'partial'
          : 'failed';
    const manifest = await session.finish(status, [
      error instanceof Error ? error.message : String(error),
    ]);
    throw new RunExecutionError(manifest, error);
  }
}
