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
        {
          // ADR-009: rgba() literals slipped past the hex ban.
          selector: 'Literal[value=/^rgba?\\(/]',
          message: 'Raw rgba() color — use a token (or withAlpha(token, a)) from src/ui/palette.ts',
        },
      ],
      // ADR-009 dark mode: read colours from the theme (useTheme / makeStyles
      // in src/ui/appearance.tsx), not the static light TOKENS. Warning while
      // screens are converted (steps 1–3); an error from step 4.
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/palette', '**/ui/palette'],
              importNames: ['TOKENS'],
              message: 'ADR-009: use useTheme() / makeStyles() from src/ui/appearance — TOKENS is light-only.',
            },
          ],
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
  // The theme module itself builds on the light / dark token tables.
  {
    files: ['src/ui/appearance.tsx', 'src/ui/theme.ts', 'tests/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
