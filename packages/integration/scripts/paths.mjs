import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const integrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(integrationRoot, '../..');
export const artifacts = join(integrationRoot, '.artifacts');
export const tarballs = join(artifacts, 'tarballs');
export const consumerNames = ['cli', 'vite-react'];
export const consumerPath = (name) => {
  if (!consumerNames.includes(name)) throw new Error(`Unknown consumer: ${name}`);
  return join(artifacts, 'consumers', name);
};
