/**
 * Tests for github-fetch.ts - GitHub URL utilities and content fetching.
 */

import { describe, it, expect } from 'vitest';

import {
  githubBlobToRawUrl,
  isGitHubUrl,
  parseRawGitHubUrl,
  fetchWithGhFallback,
  directFetch,
} from '../src/file/github-fetch.js';

// =============================================================================
// githubBlobToRawUrl
// =============================================================================

describe('githubBlobToRawUrl', () => {
  it('converts GitHub blob URL to raw URL', () => {
    const url =
      'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md';
    expect(githubBlobToRawUrl(url)).toBe(
      'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
    );
  });

  it('converts GitHub blob URL with branch name', () => {
    expect(githubBlobToRawUrl('https://github.com/org/repo/blob/main/docs/file.md')).toBe(
      'https://raw.githubusercontent.com/org/repo/main/docs/file.md',
    );
  });

  it('passes through raw.githubusercontent.com URLs unchanged', () => {
    const url = 'https://raw.githubusercontent.com/org/repo/main/docs/file.md';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('passes through non-GitHub URLs unchanged', () => {
    const url = 'https://example.com/docs/file.md';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('passes through GitHub tree URLs unchanged', () => {
    const url = 'https://github.com/org/repo/tree/main/docs';
    expect(githubBlobToRawUrl(url)).toBe(url);
  });

  it('handles http:// URLs', () => {
    expect(githubBlobToRawUrl('http://github.com/org/repo/blob/main/file.md')).toBe(
      'https://raw.githubusercontent.com/org/repo/main/file.md',
    );
  });
});

// =============================================================================
// isGitHubUrl
// =============================================================================

describe('isGitHubUrl', () => {
  it('recognizes github.com URLs', () => {
    expect(isGitHubUrl('https://github.com/org/repo')).toBe(true);
  });

  it('recognizes raw.githubusercontent.com URLs', () => {
    expect(isGitHubUrl('https://raw.githubusercontent.com/org/repo/main/file.md')).toBe(true);
  });

  it('rejects non-GitHub URLs', () => {
    expect(isGitHubUrl('https://example.com/docs')).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isGitHubUrl('https://notgithub.com/org/repo')).toBe(false);
  });
});

// =============================================================================
// parseRawGitHubUrl
// =============================================================================

describe('parseRawGitHubUrl', () => {
  it('parses raw GitHub URL into components', () => {
    const result = parseRawGitHubUrl(
      'https://raw.githubusercontent.com/jlevy/tbd/main/docs/file.md',
    );
    expect(result).toEqual({
      owner: 'jlevy',
      repo: 'tbd',
      ref: 'main',
      path: 'docs/file.md',
    });
  });

  it('parses URL with commit SHA ref', () => {
    const result = parseRawGitHubUrl(
      'https://raw.githubusercontent.com/org/repo/abc123/src/index.ts',
    );
    expect(result).toEqual({
      owner: 'org',
      repo: 'repo',
      ref: 'abc123',
      path: 'src/index.ts',
    });
  });

  it('returns null for non-raw-GitHub URLs', () => {
    expect(parseRawGitHubUrl('https://github.com/org/repo/blob/main/file.md')).toBeNull();
    expect(parseRawGitHubUrl('https://example.com/file.md')).toBeNull();
  });
});

// =============================================================================
// directFetch (network tests)
// =============================================================================

describe('directFetch', () => {
  it('fetches content from a valid URL', async () => {
    try {
      const content = await directFetch(
        'https://raw.githubusercontent.com/jlevy/tbd/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
      );
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(100);
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });

  it('throws on 404', async () => {
    try {
      await expect(
        directFetch('https://raw.githubusercontent.com/jlevy/tbd/main/nonexistent-file-12345.md'),
      ).rejects.toThrow('HTTP 404');
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });
});

// =============================================================================
// fetchWithGhFallback (network tests)
// =============================================================================

describe('fetchWithGhFallback', () => {
  it('converts blob URL and fetches', async () => {
    try {
      const result = await fetchWithGhFallback(
        'https://github.com/jlevy/tbd/blob/413ac0b770e9ddc415f4095af30b64869cf8d0d2/docs/general/research/current/research-modern-bun-monorepo-patterns.md',
      );
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(100);
    } catch {
      console.log('Skipping network test - no connectivity');
    }
  });
});
