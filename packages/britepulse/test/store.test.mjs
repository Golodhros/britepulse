import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile, rm, symlink, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunStore } from '../dist/store.js';
const metadata = {
  label: '../same-label',
  framework: 'vite',
  environment: 'local',
  configFingerprint: 'a'.repeat(64),
  toolVersions: {},
  git: null,
};
async function fixture(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'britepulse-store-'));
  try {
    await callback(new RunStore(directory), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test('concurrent runs with the same label have immutable unique identities', () =>
  fixture(async (store) => {
    const sessions = await Promise.all(Array.from({ length: 12 }, () => store.create(metadata)));
    assert.equal(new Set(sessions.map((session) => session.manifest.id)).size, 12);
    await Promise.all(sessions.map((session) => session.finish('complete')));
    const result = await store.discover();
    assert.equal(result.runs.length, 12);
    assert(result.runs.every((run) => run.label === metadata.label && run.status === 'complete'));
    assert.deepEqual(result.diagnostics, []);
  }));
test('concurrent artifact writes and finalization serialize without losing references', () =>
  fixture(async (store) => {
    const session = await store.create(metadata);
    const writes = [
      session.writeJSON('normalized/bundle.json', { emittedBytes: null }),
      session.writeArtifact('original/report.html', '<html>Original</html>'),
    ];
    const finished = session.finish('complete');
    await assert.rejects(session.writeArtifact('late.txt', 'late'), /closing/);
    await Promise.all(writes);
    const manifest = await finished;
    assert.equal(manifest.artifacts.length, 2);
    assert.equal(
      JSON.parse(await readFile(join(session.directory, 'normalized/bundle.json'), 'utf8'))
        .emittedBytes,
      null,
    );
    assert.deepEqual(await store.read(manifest.id), manifest);
    await assert.rejects(session.finish('complete'), /closing/);
  }));
test('failed writes cannot overwrite artifacts or silently produce a complete run', () =>
  fixture(async (store) => {
    const session = await store.create(metadata);
    await session.writeArtifact('original.txt', 'first');
    await assert.rejects(session.writeArtifact('original.txt', 'second'), /EEXIST/);
    assert.equal(await readFile(join(session.directory, 'original.txt'), 'utf8'), 'first');
    await assert.rejects(session.finish('complete'), /failed artifact writes/);
    const manifest = await session.finish('partial', ['An artifact failed']);
    assert.equal(manifest.status, 'partial');
    assert(manifest.diagnostics.some((item) => item.includes('original.txt')));
  }));
test('paths cannot traverse, replace the manifest or follow artifact symlinks', () =>
  fixture(async (store, directory) => {
    const session = await store.create(metadata);
    for (const path of ['../outside.txt', '/tmp/outside.txt', 'manifest.json'])
      await assert.rejects(session.writeArtifact(path, 'bad'));
    const outside = join(directory, 'outside');
    await mkdir(outside);
    await symlink(outside, join(session.directory, 'linked'));
    await assert.rejects(session.writeArtifact('linked/outside.txt', 'bad'), /ordinary directory/);
    await session.finish('failed', ['Invalid paths']);
    await assert.rejects(store.read('../outside'), /Invalid run ID/);
  }));
test('malformed entries do not crash discovery and sorting uses metadata timestamps', () =>
  fixture(async (store, directory) => {
    assert.deepEqual(await store.discover(), { runs: [], diagnostics: [] });
    const first = await store.create(metadata);
    const second = await store.create(metadata);
    const firstManifest = await first.finish('cancelled', ['Interrupted']);
    const secondManifest = await second.finish('failed', ['Collection failed']);
    const firstPath = join(first.directory, 'manifest.json');
    await writeFile(
      firstPath,
      JSON.stringify({ ...firstManifest, createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    await utimes(first.directory, new Date('2099-01-01'), new Date('2099-01-01'));
    await mkdir(join(directory, 'runs/broken'));
    await writeFile(join(directory, 'runs/broken/manifest.json'), '{invalid');
    const result = await store.discover();
    assert.equal(result.runs[0].id, secondManifest.id);
    assert.equal(result.runs[1].status, 'cancelled');
    assert.equal(result.diagnostics.length, 1);
  }));
test('manifest identity and symlinks cannot masquerade as other runs', () =>
  fixture(async (store) => {
    const session = await store.create(metadata);
    const other = await store.create(metadata);
    await writeFile(join(session.directory, 'manifest.json'), JSON.stringify(other.manifest));
    await assert.rejects(store.read(session.manifest.id), /does not match/);
    await rm(join(other.directory, 'manifest.json'));
    await symlink(join(session.directory, 'manifest.json'), join(other.directory, 'manifest.json'));
    await assert.rejects(store.read(other.manifest.id), /ordinary file/);
    assert.equal((await store.discover()).diagnostics.length, 2);
  }));

test('comparison identities are unique and require existing runs', () =>
  fixture(async (store) => {
    const baseline = await store.create(metadata);
    const candidate = await store.create(metadata);
    await baseline.finish('complete');
    await candidate.finish('complete');
    const input = {
      baselineId: baseline.manifest.id,
      candidateId: candidate.manifest.id,
      compatible: true,
      diagnostics: [],
      metrics: {},
    };
    const comparisons = await Promise.all([
      store.createComparison(input),
      store.createComparison(input),
    ]);
    assert.notEqual(comparisons[0].id, comparisons[1].id);
    await assert.rejects(
      store.createComparison({ ...input, baselineId: '48d36f03-5dfc-4b2a-80e9-d3f52efa4c27' }),
      /ENOENT/,
    );
  }));
