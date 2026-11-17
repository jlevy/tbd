#!/usr/bin/env npx tsx
/**
 * Regenerate the README's shortcut, guideline, and template tables in place.
 *
 * Usage: pnpm --filter get-tbd generate:readme
 *
 * Run it after adding, renaming, or re-describing a bundled shortcut, guideline, or
 * template, then commit README.md. The rendering lives in
 * scripts/readme-reference-tables.ts; tests/readme-reference-tables.test.ts fails when
 * the committed README is stale, and explains why this is not a build step.
 */

import { readFileSync } from 'node:fs';

import { writeFile } from 'atomically';

import { README_PATH, renderAllRegions, updateReadme } from './readme-reference-tables.js';

const original = readFileSync(README_PATH, 'utf-8');
// Render with LF line endings and write back whichever ending the checkout uses.
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const updated = updateReadme(original.replace(/\r\n/gu, '\n'), renderAllRegions()).replace(
  /\n/gu,
  eol,
);

if (updated === original) {
  console.log('README.md reference tables are current');
} else {
  await writeFile(README_PATH, updated);
  console.log('Wrote the README.md reference tables');
}
