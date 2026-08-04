/**
 * ESLint flat config with type-aware rules.
 *
 * See: `tbd guidelines pnpm-monorepo-patterns` Appendix C and
 * `tbd guidelines typescript-lint-format-rules` for the floor this implements.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Apply type-checked configs only to TypeScript files
const typedStrict = tseslint.configs.strictTypeChecked.map((cfg) => ({
  ...cfg,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

const typedStylistic = tseslint.configs.stylisticTypeChecked.map((cfg) => ({
  ...cfg,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...(cfg.languageOptions ?? {}),
    parserOptions: {
      ...(cfg.languageOptions?.parserOptions ?? {}),
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

export default [
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/coverage/**',
      '**/attic/**',
      'eslint.config.*',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // Type-aware TypeScript rules
  ...typedStrict,
  ...typedStylistic,

  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // === Strict-preset tuning ===
      // Numbers and booleans interpolate unambiguously; everything else
      // (objects, nullish, any) still errors.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      // Deliberate exception, not debt: with noUncheckedIndexedAccess on,
      // a postfix ! after a bounds-checked index is the sanctioned idiom.
      '@typescript-eslint/no-non-null-assertion': 'off',

      // === Ratchet (tracked debt, tbd-s9vn): existing violations predate
      // the strictTypeChecked floor; re-enable when the backlog is cleared.
      '@typescript-eslint/no-unnecessary-condition': 'off',

      // === Unused Variables ===
      // Allow underscore prefix for intentionally unused vars/args
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // === Promise Safety (Critical for Node.js) ===
      // Catch unhandled promises (common source of silent failures)
      '@typescript-eslint/no-floating-promises': 'error',
      // Prevent passing promises where void is expected
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Catch awaiting non-promise values
      '@typescript-eslint/await-thenable': 'error',
      // Prevent confusing void expressions in unexpected places
      '@typescript-eslint/no-confusing-void-expression': 'error',

      // === Type Import Consistency ===
      // Enforce `import type` for type-only imports (better tree-shaking)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: true,
        },
      ],
      // Prevent side effects in type-only imports
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // === Restricted Patterns ===
      // Forbid inline import() type expressions (prefer proper imports)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSImportType',
          message:
            'Inline import() type expressions are not allowed. Use a proper import statement at the top of the file instead.',
        },
      ],

      // === Atomic File Writes ===
      // Enforce use of 'atomically' library for file writes to prevent data corruption
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs',
              importNames: ['writeFile', 'writeFileSync'],
              message: 'Use writeFile from "atomically" instead for atomic writes.',
            },
            {
              name: 'node:fs',
              importNames: ['writeFile', 'writeFileSync'],
              message: 'Use writeFile from "atomically" instead for atomic writes.',
            },
            {
              name: 'fs/promises',
              importNames: ['writeFile'],
              message: 'Use writeFile from "atomically" instead for atomic writes.',
            },
            {
              name: 'node:fs/promises',
              importNames: ['writeFile'],
              message: 'Use writeFile from "atomically" instead for atomic writes.',
            },
          ],
        },
      ],
    },
  },

  // === File-Specific Overrides ===
  // Relax rules for test files where dynamic behavior is expected
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Test files create temporary fixtures where atomic writes aren't critical
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },

  // Env scrubbing and settings-file editing delete computed keys by design;
  // dynamic delete is the correct operation on these plain records.
  {
    files: ['**/src/cli/commands/setup.ts', '**/src/lib/git-env.ts', '**/tests/scrub-git-env.ts'],
    rules: {
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },

  // Relax rules for scripts/tooling
  {
    files: ['**/scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      // Note: Atomic writes are still enforced for scripts
    },
  },

  // Relax rules for CLI command stubs (not yet implemented)
  {
    files: ['**/cli/commands/**/*.ts', '**/cli/lib/**/*.ts'],
    rules: {
      // Commands are stubs with placeholder implementations
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_|^options$|^id$|^query$' },
      ],
      // Commander.js action callbacks have loose types
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Prettier config must be LAST to override conflicting rules
  prettier,

  // Rules that eslint-config-prettier turns off but that are safe alongside
  // Prettier, so they must be re-asserted after it. With the 'all' option,
  // curly only adds braces; Prettier then owns their formatting (which is why
  // there is no brace-style rule here).
  {
    rules: {
      curly: ['error', 'all'],
    },
  },
];
