#!/usr/bin/env npx tsx
/**
 * Print the GitHub Release body for a version: the matching "## X.Y.Z" section of the
 * changelog, or "Release v<version>" when there is no such section.
 *
 * Usage: tsx scripts/extract-changelog.ts <version> [changelog-path]
 *
 * Invoked by .github/workflows/release.yml. The extraction logic lives in
 * src/utils/changelog.ts and is unit-tested (tests/extract-changelog.test.ts); this is
 * just the thin CLI wrapper, so the workflow contains no inline parsing shell.
 */

import { readFileSync } from 'node:fs';

import { resolveReleaseBody } from '../src/utils/changelog.js';

const DEFAULT_CHANGELOG = 'packages/tbd/CHANGELOG.md';

function main(argv: string[]): void {
  const version = argv[0];
  if (!version) {
    console.error('Usage: extract-changelog.ts <version> [changelog-path]');
    process.exitCode = 2;
    return;
  }
  const changelogPath = argv[1] ?? DEFAULT_CHANGELOG;
  const changelog = readFileSync(changelogPath, 'utf-8');
  process.stdout.write(resolveReleaseBody(changelog, version) + '\n');
}

main(process.argv.slice(2));
