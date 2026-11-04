import { test } from 'node:test';
import { command, success } from './helpers.mjs';
test('published root/config/Vite declarations compile in a strict isolated consumer', () => {
  success(command('vite-react', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']));
});
