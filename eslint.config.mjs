import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.artifacts/**'] },
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    // These candidate fixtures intentionally import the complete library to verify bundle growth.
    files: [
      'fixtures/next-app/src/candidate.js',
      'fixtures/next-pages/src/candidate.js',
      'fixtures/vite-react/src/candidate.js',
      'packages/integration/consumers/vite-react/src/candidate.js',
    ],
    rules: { 'sonarjs/no-default-utility-imports': 'off' },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
);
