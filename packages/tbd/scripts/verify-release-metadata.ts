#!/usr/bin/env npx tsx
/**
 * Verify that a release tag, package.json, changelog, and compiled CLI agree.
 *
 * Usage: tsx scripts/verify-release-metadata.ts <tag> [package-json] [changelog] [built-cli]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  verifyReleaseArtifactVersion,
  verifyReleaseMetadata,
} from '../src/utils/release-metadata.js';

const DEFAULT_PACKAGE_JSON = 'packages/tbd/package.json';
const DEFAULT_CHANGELOG = 'packages/tbd/CHANGELOG.md';
const DEFAULT_BUILT_CLI = 'packages/tbd/dist/bin-bootstrap.cjs';

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
    console.error('Usage: verify-release-metadata.ts <tag> [package-json] [changelog] [built-cli]');
    process.exitCode = 2;
    return;
  }

  const packageJsonPath = argv[1] ?? DEFAULT_PACKAGE_JSON;
  const changelogPath = argv[2] ?? DEFAULT_CHANGELOG;
  const builtCliPath = argv[3] ?? DEFAULT_BUILT_CLI;
  const packageVersion = readPackageVersion(packageJsonPath);
  const changelog = readFileSync(changelogPath, 'utf-8');
  const verified = verifyReleaseMetadata(tagName, packageVersion, changelog);
  const builtVersion = execFileSync(process.execPath, [builtCliPath, '--version'], {
    encoding: 'utf-8',
  }).trim();
  verifyReleaseArtifactVersion(verified.version, builtVersion);
  process.stdout.write(`Verified release metadata for ${verified.version}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
