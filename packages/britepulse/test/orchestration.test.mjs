import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { RunStore } from '../dist/store.js';
import { collectRun, withTemporaryDirectory, RunExecutionError } from '../dist/orchestration.js';
import { CommandInterruptedError } from '../dist/process.js';
const metadata = {
  label: 'test',
  framework: 'vite',
  environment: 'local',
  configFingerprint: 'a'.repeat(64),
  toolVersions: {},
  git: null,
};
test('temporary workspaces are isolated and cleaned on success or failure', async () => {
  const directories = [];
  await Promise.all(
    [1, 2].map(() =>
      withTemporaryDirectory(async (directory) => {
        directories.push(directory);
        await access(directory);
      }),
    ),
  );
  assert.notEqual(directories[0], directories[1]);
  for (const directory of directories) await assert.rejects(access(directory));
  let failedDirectory;
  await assert.rejects(
    withTemporaryDirectory(async (directory) => {
      failedDirectory = directory;
      throw new Error('failed');
    }),
    /failed/,
  );
  await assert.rejects(access(failedDirectory));
});
test('collection persists failed, partial and cancelled terminal states', async () =>
  withTemporaryDirectory(async (directory) => {
    const store = new RunStore(directory);
    for (const status of ['failed', 'partial', 'cancelled']) {
      await assert.rejects(
        collectRun(store, metadata, async (session) => {
          if (status === 'partial') await session.writeJSON('sample.json', { value: null });
          if (status === 'cancelled') throw new CommandInterruptedError('cancelled');
          throw new Error('Collection interrupted');
        }),
        (error) => error instanceof RunExecutionError && error.manifest.status === status,
      );
    }
    const { runs } = await store.discover();
    assert.equal(runs.length, 3);
    assert(runs.every((run) => run.finishedAt && run.diagnostics.length));
  }));
test('successful collection finalizes original artifacts and returns its value', async () =>
  withTemporaryDirectory(async (directory) => {
    const result = await collectRun(new RunStore(directory), metadata, async (session) => {
      await session.writeArtifact('original.txt', 'source');
      return 42;
    });
    assert.equal(result.value, 42);
    assert.equal(result.manifest.status, 'complete');
  }));
