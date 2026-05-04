// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

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
      '*.config.js',
      'babel.config.js',
      'jest.config.js',
      'eslint.config.js',
    ],
  },
]);
