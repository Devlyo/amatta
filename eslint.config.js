// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['dist/*', 'node_modules/*', '.expo/*', '.tsbuildinfo'],
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.expo/**',
      'web-build/**',
      'ios/**',
      'android/**',
      'docs/**',
      '*.config.js',
      'babel.config.js',
      'jest.config.js',
      'eslint.config.js',
      'metro.config.js',
    ],
  },
  // Ban raw hex color literals — use TOKENS.<name> from src/ui/palette.ts instead.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]',
          message: 'Raw hex color — use a TOKENS.<name> from src/ui/palette.ts',
        },
      ],
    },
  },
  // Disable the hex ban for the palette source-of-truth and the design gallery.
  {
    files: ['src/ui/palette.ts', 'app/dev-gallery.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]);
