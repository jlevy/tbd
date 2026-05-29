/**
 * Tests for the release changelog extractor used by .github/workflows/release.yml.
 *
 * This logic previously lived as inline awk in the workflow and broke silently on
 * every release (the start heading `## X.Y.Z` also matched the awk end pattern
 * `## [0-9]`, collapsing the range to one line). Keeping it as a unit-tested module
 * locks in the regression and lets the workflow invoke it by reference.
 */

import { describe, it, expect } from 'vitest';

import { extractChangelogSection, resolveReleaseBody } from '../scripts/extract-changelog.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes are documented here.',
  '',
  '## 0.2.0',
  '',
  '### Added',
  '',
  '- f04 upgrade contract',
  '- Multi-worktree notice',
  '',
  '### Fixed',
  '',
  '- Hardening section',
  '',
  '## 0.1.30',
  '',
  '- Older release notes',
  '',
  '## 0.1.0',
  '',
  '- First release',
  '',
].join('\n');

describe('extractChangelogSection', () => {
  it('extracts the full section, not just the heading (regression for the awk-range bug)', () => {
    const body = extractChangelogSection(CHANGELOG, '0.2.0');
    expect(body).not.toBeNull();
    const lines = body!.split('\n');
    expect(lines[0]).toBe('## 0.2.0');
    // The whole section must be present, not collapsed to a single line.
    expect(body).toContain('### Added');
    expect(body).toContain('- f04 upgrade contract');
    expect(body).toContain('### Fixed');
    expect(body).toContain('- Hardening section');
    // It must stop before the next version heading.
    expect(body).not.toContain('## 0.1.30');
    expect(body).not.toContain('Older release notes');
  });

  it('extracts a middle section bounded by the next version heading', () => {
    const body = extractChangelogSection(CHANGELOG, '0.1.30');
    expect(body).toBe(['## 0.1.30', '', '- Older release notes'].join('\n'));
  });

  it('extracts the last section in the file (no trailing version heading)', () => {
    const body = extractChangelogSection(CHANGELOG, '0.1.0');
    expect(body).toBe(['## 0.1.0', '', '- First release'].join('\n'));
  });

  it('trims trailing blank lines from the section', () => {
    const body = extractChangelogSection(CHANGELOG, '0.2.0');
    expect(body!.endsWith('- Hardening section')).toBe(true);
  });

  it('returns null for a version that has no section', () => {
    expect(extractChangelogSection(CHANGELOG, '9.9.9')).toBeNull();
  });

  it('matches the heading literally so dots are not treated as regex wildcards', () => {
    // "0x2y0" must not match the "## 0.2.0" heading.
    expect(extractChangelogSection(CHANGELOG, '0x2y0')).toBeNull();
  });

  it('handles prerelease version headings', () => {
    const prerelease = ['## 1.0.0-rc.1', '', '- Release candidate', ''].join('\n');
    expect(extractChangelogSection(prerelease, '1.0.0-rc.1')).toBe(
      ['## 1.0.0-rc.1', '', '- Release candidate'].join('\n'),
    );
  });

  it('handles CRLF line endings', () => {
    const crlf = CHANGELOG.replace(/\n/g, '\r\n');
    const body = extractChangelogSection(crlf, '0.1.0');
    expect(body).toBe(['## 0.1.0', '', '- First release'].join('\n'));
  });
});

describe('resolveReleaseBody', () => {
  it('returns the section when present', () => {
    expect(resolveReleaseBody(CHANGELOG, '0.1.0')).toContain('- First release');
  });

  it('falls back to "Release v<version>" when the section is missing', () => {
    expect(resolveReleaseBody(CHANGELOG, '9.9.9')).toBe('Release v9.9.9');
  });
});
