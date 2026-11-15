import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const sharedOnly = {
  patterns: [
    {
      group: [
        '@/shell',
        '@/shell/*',
        '@/screens/*',
        '@/games/*',
        '@/watch/*',
        '@/design/*',
        '@/data/*',
        '@/ophi/*',
        '@/registry/*',
        '../*',
      ],
      message:
        'Screens and games import shared code only from @/design, @/data, @/ophi and @/registry.',
    },
  ],
}

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/games/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', sharedOnly] },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/shell/router.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
