#!/usr/bin/env npx tsx
/**
 * Verify that a release tag, package.json, and changelog all name the same version.
 *
 * Usage: tsx scripts/verify-release-metadata.ts <tag> [package-json-path] [changelog-path]
 */

import { readFileSync } from 'node:fs';

import { verifyReleaseMetadata } from '../src/utils/release-metadata.js';

const DEFAULT_PACKAGE_JSON = 'packages/tbd/package.json';
const DEFAULT_CHANGELOG = 'packages/tbd/CHANGELOG.md';

function readPackageVersion(packageJsonPath: string): string {
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error(`${packageJsonPath} does not contain a version`);
  }
  const version = (parsed as { version: unknown }).version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`${packageJsonPath} does not contain a string version`);
  }
  return version;
}

function main(argv: string[]): void {
  const tagName = argv[0];
  if (!tagName) {
    console.error('Usage: verify-release-metadata.ts <tag> [package-json-path] [changelog-path]');
    process.exitCode = 2;
    return;
  }

  const packageJsonPath = argv[1] ?? DEFAULT_PACKAGE_JSON;
  const changelogPath = argv[2] ?? DEFAULT_CHANGELOG;
  const packageVersion = readPackageVersion(packageJsonPath);
  const changelog = readFileSync(changelogPath, 'utf-8');
  const verified = verifyReleaseMetadata(tagName, packageVersion, changelog);
  process.stdout.write(`Verified release metadata for ${verified.version}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
