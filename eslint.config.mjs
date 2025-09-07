import unusedImports from 'eslint-plugin-unused-imports'
import { configs } from 'typescript-eslint'
import { defineConfig } from "eslint/config";
import { importX } from 'eslint-plugin-import-x'
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  // ...configs.recommendedTypeChecked,
  ...configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  eslintConfigPrettier,
  {
    ignores: [
      '**/,.*',
      '**/*.config.ts',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/dist',
      '**/debug',
      '**/lib',
      '**/docs',
      '**/gen',
      '**/types',
      '**/builtin',
    ]
  },
  {
    plugins: {
      'unused-imports': unusedImports
    },
    languageOptions: {
      parserOptions: {
        projectService: true
      },
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',

      '@typescript-eslint/no-inferrable-types': ['off'],
      '@typescript-eslint/no-empty-function': ['off'],
      '@typescript-eslint/no-unused-vars': ['off'],
      '@typescript-eslint/no-this-alias': ['off'],
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/no-unused-expressions': ["warn"],

      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description'
        }
      ],

      'import-x/no-named-as-default': ['off'],
      'import-x/no-named-as-default-member': ['off'],
      'import-x/no-unresolved': ['off'],
      'unused-imports/no-unused-imports': 'error',
    }
  }
])
