import { test } from 'node:test';
import assert from 'node:assert/strict';
import { command } from './helpers.mjs';

test('published root/config/Vite declarations compile in a strict isolated consumer', () => {
  const result = command('vite-react', process.execPath, [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
  ]);
  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
