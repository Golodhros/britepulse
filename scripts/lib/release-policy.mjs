import assert from 'node:assert/strict';

export function betaReleasePlan(manifest, pre) {
  assert.equal(manifest.name, 'britepulse', 'Only britepulse may be published');
  assert.notEqual(manifest.private, true, 'CLI package must be publishable');
  assert.match(
    manifest.version,
    /^\d+\.\d+\.\d+-beta\.\d+$/,
    'Only beta versions are supported by this release workflow',
  );
  assert.equal(pre.mode, 'pre');
  assert.equal(pre.tag, 'beta');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.publishConfig?.tag, 'beta');
  assert.equal(manifest.publishConfig?.registry, 'https://registry.npmjs.org/');
  assert.equal(manifest.repository?.url, 'https://github.com/Golodhros/britepulse.git');

  return {
    name: manifest.name,
    version: manifest.version,
    tag: 'beta',
    filename: `britepulse-${manifest.version}.tgz`,
  };
}

export function verifyReleaseReceipt(plan, receipt, integrity, head, forPublish = false) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(typeof receipt.sourceDirty, 'boolean');
  if (forPublish)
    assert.equal(receipt.sourceDirty, false, 'Reverify the committed source before publishing');
  assert.equal(receipt.name, plan.name);
  assert.equal(receipt.version, plan.version);
  assert.equal(receipt.tag, plan.tag);
  assert.equal(receipt.filename, plan.filename);
  assert.equal(receipt.integrity, integrity, 'Release tarball differs from the verified artifact');
  assert.equal(receipt.gitHead, head, 'Run release:check again for the current commit');
  assert.deepEqual(receipt.checks, [
    'lint',
    'typecheck',
    'test',
    'test:release',
    'format:check',
    'test:integration',
    'test:report',
    'test:next-pages',
  ]);
}

export function classifyRegistryResult(result, expectedIntegrity) {
  if (result.status === 0) {
    assert.equal(
      JSON.parse(result.stdout),
      expectedIntegrity,
      'Registry version exists with different integrity',
    );

    return 'already-published';
  }
  let error;
  try {
    error = JSON.parse(result.stdout).error;
  } catch {
    /* A non-JSON/network error must fail closed. */
  }
  if (error?.code === 'E404') return 'unpublished';
  throw new Error('Cannot verify npm registry state; publication was not attempted');
}
