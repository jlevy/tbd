#!/usr/bin/env node
/* global process, console */
/**
 * Extract a single "## X.Y.Z" section out of a Keep-a-Changelog style file.
 *
 * Usage:
 *   node scripts/extract-changelog.mjs <version> [changelog-path]   # prints body to stdout
 *   import { extractChangelogSection } from './scripts/extract-changelog.mjs'  # programmatic
 *
 * Used by .github/workflows/release.yml to set the GitHub Release body. Kept as a
 * standalone, unit-tested module (see tests/extract-changelog.test.ts) rather than
 * inline awk/sed in the workflow: CI-embedded shell is hard to test and debug, so the
 * logic lives here and the workflow only invokes it by reference.
 *
 * The CLI prints the matched section, or the fallback "Release v<version>" when the
 * version has no section, and always exits 0 so the release step never blocks on it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_CHANGELOG = 'packages/tbd/CHANGELOG.md';

/**
 * Return the changelog body for `version`: every line from the `## <version>` heading
 * up to (but not including) the next `## <digit…>` heading, with surrounding blank
 * lines trimmed. Returns null when the version's heading is not found.
 *
 * Matching the heading literally (not as a regex) avoids the historical bug where the
 * start pattern `^## X.Y.Z$` also matched the generic end pattern `^## [0-9]`, collapsing
 * the range to a single line and silently falling back to "Release vX.Y.Z".
 *
 * @param {string} changelog - full CHANGELOG.md contents
 * @param {string} version - version string, e.g. "0.2.0" or "1.0.0-rc.1"
 * @returns {string | null}
 */
export function extractChangelogSection(changelog, version) {
  const heading = `## ${version}`;
  const lines = changelog.split(/\r?\n/);

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === heading) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    return null;
  }

  // Collect the heading and following lines until the next top-level version heading.
  const collected = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## [0-9]/.test(lines[i])) {
      break;
    }
    collected.push(lines[i]);
  }

  // Trim trailing/leading blank lines for a clean release body.
  while (collected.length && collected[collected.length - 1].trim() === '') {
    collected.pop();
  }
  return collected.join('\n');
}

/**
 * Resolve the release body for `version`, falling back to "Release v<version>" when the
 * changelog has no matching section.
 *
 * @param {string} changelog - full CHANGELOG.md contents
 * @param {string} version - version string
 * @returns {string}
 */
export function resolveReleaseBody(changelog, version) {
  const section = extractChangelogSection(changelog, version);
  return section && section.trim() !== '' ? section : `Release v${version}`;
}

function main(argv) {
  const version = argv[0];
  if (!version) {
    console.error('Usage: extract-changelog.mjs <version> [changelog-path]');
    process.exit(2);
  }
  const changelogPath = argv[1] ?? DEFAULT_CHANGELOG;
  const changelog = readFileSync(changelogPath, 'utf-8');
  process.stdout.write(resolveReleaseBody(changelog, version) + '\n');
}

// Run as CLI only when invoked directly, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
