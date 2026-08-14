/**
 * Extract a single "## X.Y.Z" section from a Keep-a-Changelog style file.
 *
 * Used by the release workflow (via scripts/extract-changelog.ts) to set the GitHub
 * Release body, and unit-tested directly. Kept as a normal source module, rather than
 * inline awk in the workflow, so the logic can be tested and debugged in isolation.
 */

/**
 * Return the changelog body for `version`: every line from the `## <version>` heading
 * up to (but not including) the next `## <digit…>` heading, with surrounding blank
 * lines trimmed. Returns null when the version's heading is not found.
 *
 * Matching the heading literally (not as a regex) avoids the historical bug where the
 * start pattern `^## X.Y.Z$` also matched the generic end pattern `^## [0-9]`, collapsing
 * the range to a single line and silently falling back to "Release vX.Y.Z".
 */
export function extractChangelogSection(changelog: string, version: string): string | null {
  const heading = `## ${version}`;
  const lines = changelog.split(/\r?\n/);

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trimEnd() === heading) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    return null;
  }

  // Collect the heading and following lines until the next top-level version heading.
  const collected: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (i > start && /^## [0-9]/.test(line)) {
      break;
    }
    collected.push(line);
  }

  // Trim trailing blank lines for a clean release body.
  while (collected.length > 0 && (collected[collected.length - 1] ?? '').trim() === '') {
    collected.pop();
  }
  return collected.join('\n');
}

/**
 * Return the release body for `version`, failing closed when the exact section is absent
 * or contains no notes. A tag-triggered publish must never silently substitute a generic
 * body because that can hide a tag/package/changelog version mismatch.
 */
export function requireChangelogSection(changelog: string, version: string): string {
  const section = extractChangelogSection(changelog, version);
  if (section === null) {
    throw new Error(`No changelog section found for version ${version}`);
  }

  const hasReleaseNotes = section
    .split('\n')
    .slice(1)
    .some((line) => line.trim() !== '');
  if (!hasReleaseNotes) {
    throw new Error(`Changelog section for version ${version} has no release notes`);
  }

  return section;
}
