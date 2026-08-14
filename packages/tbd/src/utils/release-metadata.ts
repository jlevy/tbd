/**
 * Cross-check the independent version sources used by a tag-triggered release.
 */

import { requireChangelogSection } from './changelog.js';

export interface VerifiedReleaseMetadata {
  version: string;
  releaseBody: string;
}

/** Require the compiled CLI to report the same immutable version as the release tag. */
export function verifyReleaseArtifactVersion(expectedVersion: string, actualVersion: string): void {
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Built CLI reports ${actualVersion || '<empty>'}, expected release version ${expectedVersion}`,
    );
  }
}

/**
 * Require an exact `v<package version>` tag and an exact, non-empty changelog section.
 * Call this before any irreversible registry publish.
 */
export function verifyReleaseMetadata(
  tagName: string,
  packageVersion: string,
  changelog: string,
): VerifiedReleaseMetadata {
  if (!tagName.startsWith('v') || tagName.length === 1) {
    throw new Error(`Release tag must start with v and include a version; received ${tagName}`);
  }

  const version = tagName.slice(1);
  if (version !== packageVersion) {
    throw new Error(`Release tag ${tagName} does not match package version ${packageVersion}`);
  }

  return {
    version,
    releaseBody: requireChangelogSection(changelog, version),
  };
}
