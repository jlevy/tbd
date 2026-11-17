#!/usr/bin/env node
/* global process, console */
/**
 * Config-contract check for the ESLint floor.
 *
 * Computes the effective config for one TypeScript file and one JavaScript
 * file and asserts the floor rules from
 * packages/tbd/docs/guidelines/typescript-lint-format-rules.md are live at
 * error severity. This catches config regressions that keep
 * `eslint . --max-warnings 0` green while silently disabling the floor
 * (the classic case: an entry added after eslint-config-prettier turning
 * `curly` back off).
 *
 * Usage: node scripts/check-eslint-contract.mjs
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// One representative file per language; both must exist and be linted.
const TS_PROBE = join(REPO_ROOT, 'packages/tbd/src/cli/bin.ts');
const JS_PROBE = join(REPO_ROOT, 'packages/tbd/docs/guidelines/scripts/check-rust-gate.mjs');

// rule -> expected: severity 2, plus (for array entries) leading options.
const TS_CONTRACT = {
  // Floor: mandatory braces, re-asserted after eslint-config-prettier.
  curly: { options: ['all'] },
  // Floor: promise safety.
  '@typescript-eslint/no-floating-promises': {},
  '@typescript-eslint/no-misused-promises': {},
  '@typescript-eslint/await-thenable': {},
  // Floor: type-only imports.
  '@typescript-eslint/consistent-type-imports': {},
  // Proves the strictTypeChecked preset itself is applied (this rule is in
  // the strict preset and is not configured explicitly in eslint.config.js).
  '@typescript-eslint/use-unknown-in-catch-callback-variable': {},
};

const JS_CONTRACT = {
  curly: { options: ['all'] },
  // Checked JavaScript receives the same type-aware safety floor as TypeScript.
  '@typescript-eslint/no-unused-vars': {},
  '@typescript-eslint/no-floating-promises': {},
  '@typescript-eslint/no-misused-promises': {},
  '@typescript-eslint/await-thenable': {},
  '@typescript-eslint/consistent-type-imports': {},
  '@typescript-eslint/use-unknown-in-catch-callback-variable': {},
};

function severityOf(entry) {
  const raw = Array.isArray(entry) ? entry[0] : entry;
  if (raw === 'error') {
    return 2;
  }
  if (raw === 'warn') {
    return 1;
  }
  if (raw === 'off') {
    return 0;
  }
  return raw;
}

async function checkFile(eslint, filePath, contract, failures) {
  const config = await eslint.calculateConfigForFile(filePath);
  if (!config?.rules) {
    failures.push(`${filePath}: no effective config (is the file ignored?)`);
    return;
  }
  for (const [rule, expected] of Object.entries(contract)) {
    const entry = config.rules[rule];
    const actual = entry === undefined ? undefined : severityOf(entry);
    if (actual !== 2) {
      failures.push(`${filePath}: ${rule} must be at error severity, got ${JSON.stringify(entry)}`);
      continue;
    }
    for (const [i, option] of (expected.options ?? []).entries()) {
      const actualOption = Array.isArray(entry) ? entry[i + 1] : undefined;
      if (JSON.stringify(actualOption) !== JSON.stringify(option)) {
        failures.push(
          `${filePath}: ${rule} option ${i + 1} must be ${JSON.stringify(option)}, ` +
            `got ${JSON.stringify(actualOption)}`,
        );
      }
    }
  }
}

const eslint = new ESLint({ cwd: REPO_ROOT });
const failures = [];
await checkFile(eslint, TS_PROBE, TS_CONTRACT, failures);
await checkFile(eslint, JS_PROBE, JS_CONTRACT, failures);

if (failures.length > 0) {
  console.error('ESLint config contract violated:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error(
    'The lint/format floor (typescript-lint-format-rules) must stay live; ' +
      'fix eslint.config.js rather than this check.',
  );
  process.exit(1);
}

console.log('ESLint config contract holds for TS and JS probes.');
