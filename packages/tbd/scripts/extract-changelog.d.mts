/**
 * Extract a single "## X.Y.Z" section from a Keep-a-Changelog file.
 * Returns null when the version's heading is not found.
 */
export function extractChangelogSection(changelog: string, version: string): string | null;

/**
 * Resolve the release body for a version, falling back to "Release v<version>" when the
 * changelog has no matching section.
 */
export function resolveReleaseBody(changelog: string, version: string): string;
