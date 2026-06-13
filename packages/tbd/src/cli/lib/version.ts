/**
 * CLI version detection
 *
 * Priority:
 * 1. Build-time injected __TBD_VERSION__ (production builds)
 * 2. TBD_DEV_VERSION env var (dev mode, set by pnpm tbd script)
 * 3. package.json version (fallback)
 *
 * No git dependency at runtime - git version is computed at build time
 * or by the dev script wrapper.
 */

import { createRequire } from 'node:module';

import { VERSION as BUILD_VERSION } from '../../index.js';

// Build-time injected clean package.json semver (see tsdown.config.ts). Used for
// pinned `get-tbd@<version>` fallbacks. Unlike VERSION, this is never a
// git-describe dev/dirty string.
declare const __TBD_PINNED_VERSION__: string;

/** Read the package.json version (dev fallback, when running from source). */
function readPackageVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require('../../../package.json') as { version: string };
  return pkg.version;
}

/**
 * Get the CLI version.
 */
function getVersion(): string {
  // 1. Build-time injected version (production)
  if (BUILD_VERSION !== 'development') {
    return BUILD_VERSION;
  }

  // 2. Dev mode env var (set by pnpm tbd script)
  if (process.env.TBD_DEV_VERSION) {
    return process.env.TBD_DEV_VERSION;
  }

  // 3. Fallback to package.json version
  return readPackageVersion();
}

/**
 * Clean published npm version for pinned `get-tbd@<version>` fallbacks (the
 * session script and any other generated install hint). Always the package.json
 * semver, NOT the git-describe display version, which for a local/dirty build
 * is an unpublished string like `0.2.3-dev.2.abc1234-dirty` that npm cannot
 * install and that would churn generated files on every build.
 */
function getPinnedNpmVersion(): string {
  // Build-time injected clean semver (production).
  if (typeof __TBD_PINNED_VERSION__ !== 'undefined') {
    return __TBD_PINNED_VERSION__;
  }
  // Dev fallback: read package.json directly.
  return readPackageVersion();
}

/**
 * CLI version - use this instead of importing VERSION directly from index.ts
 */
export const VERSION = getVersion();

/**
 * Pinned npm version for `get-tbd@<version>` install fallbacks. Use this (not
 * VERSION) anywhere a version is written into a generated file as an installable
 * pin, so dev/dirty builds do not stamp unpublished, churn-prone strings.
 */
export const PINNED_NPM_VERSION = getPinnedNpmVersion();
