/**
 * Tests for docmap schemas.
 *
 * Test cases match the example manifests, lockfiles, and doc maps
 * in the docmap spec (`packages/tbd/docs/design-docmap-format.md`).
 * The spec and these tests must stay in exact sync.
 */

import { describe, expect, it } from 'vitest';

import { DocMapSchema, LockfileSchema, ManifestEnvelopeSchema } from '../src/docmap/index.js';

describe('ManifestEnvelopeSchema', () => {
  it('accepts the spec §1.1 example manifest', () => {
    const manifest = {
      docmap: {
        schema: 'docmap/0.1' as const,
        doc_types: [
          { name: 'shortcut', dir: 'shortcuts', command: 'shortcut' },
          { name: 'guideline', dir: 'guidelines', command: 'guidelines' },
          { name: 'template', dir: 'templates', command: 'template' },
          { name: 'reference', dir: 'references', command: 'reference' },
        ],
        sources: [
          { docref: './docs/agent/', bundle: 'proj' },
          { docref: 'github:jlevy/coding-guidelines@main', bundle: 'coding' },
          {
            docref: 'github:jlevy/writing-guidelines@main',
            bundle: 'writing',
            contents: [
              { path: 'docs/style/', type: 'guideline' },
              { path: 'docs/refs/', type: 'reference' },
            ],
          },
          { docref: 'gitlab:my-group/my-docs@v1.0.0', bundle: 'ours' },
          {
            docref: 'https://example.com/foo.md',
            bundle: 'misc',
            type: 'guideline',
            as: 'foo',
          },
        ],
      },
    };
    expect(() => ManifestEnvelopeSchema.parse(manifest)).not.toThrow();
  });

  it('rejects unknown schema version', () => {
    const manifest = {
      docmap: {
        schema: 'docmap/9.9',
        doc_types: [{ name: 'x', dir: 'x' }],
        sources: [],
      },
    };
    expect(() => ManifestEnvelopeSchema.parse(manifest)).toThrow();
  });

  it('rejects invalid bundle names', () => {
    const manifest = {
      docmap: {
        schema: 'docmap/0.1' as const,
        doc_types: [{ name: 'x', dir: 'x' }],
        sources: [{ docref: './foo/', bundle: 'NotLowercase' }],
      },
    };
    expect(() => ManifestEnvelopeSchema.parse(manifest)).toThrow();
  });

  it('rejects invalid docref strings', () => {
    const manifest = {
      docmap: {
        schema: 'docmap/0.1' as const,
        doc_types: [{ name: 'x', dir: 'x' }],
        sources: [{ docref: 'not-a-docref', bundle: 'x' }],
      },
    };
    expect(() => ManifestEnvelopeSchema.parse(manifest)).toThrow();
  });

  it('requires at least one doc_type', () => {
    const manifest = {
      docmap: { schema: 'docmap/0.1' as const, doc_types: [], sources: [] },
    };
    expect(() => ManifestEnvelopeSchema.parse(manifest)).toThrow();
  });
});

describe('LockfileSchema', () => {
  it('accepts the spec §2.1 example lockfile', () => {
    const lockfile = {
      docmap: { schema: 'docmap/0.1' as const },
      sources: [
        {
          docref: 'github:jlevy/coding-guidelines@main',
          revision: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
          hash: 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b1234567890abcdef12345678',
          materialization: { kind: 'git-shallow' as const, depth: 1 },
          synced_at: '2026-05-07T10:00:00Z',
        },
        {
          docref: 'https://example.com/foo.md',
          hash: 'sha256:3e864103884c7d659a2feaa0c55ad015a3bf4f1b1234567890abcdef12345678',
          etag: '"3e86-410-3596fbbc"',
          materialization: { kind: 'fetched-file' as const, format: 'markdown' as const },
          synced_at: '2026-05-07T10:00:00Z',
        },
      ],
    };
    expect(() => LockfileSchema.parse(lockfile)).not.toThrow();
  });

  it('rejects malformed hash', () => {
    const lockfile = {
      docmap: { schema: 'docmap/0.1' as const },
      sources: [
        {
          docref: 'https://example.com/foo.md',
          hash: 'md5:abc',
          materialization: { kind: 'fetched-file' as const, format: 'original' as const },
          synced_at: '2026-05-07T10:00:00Z',
        },
      ],
    };
    expect(() => LockfileSchema.parse(lockfile)).toThrow();
  });
});

describe('DocMapSchema', () => {
  it('accepts the spec §3.1 example doc map', () => {
    const docMap = {
      docmap: { schema: 'docmap/0.1' as const },
      built: '2026-05-07T10:00:00Z',
      documents: [
        {
          key: 'coding:guidelines/typescript',
          bundle: 'coding',
          type: 'guideline',
          path: 'guidelines/typescript.md',
          title: 'TypeScript Coding Rules',
          description: 'Comprehensive TypeScript guidelines',
          when: 'Writing, reviewing, or refactoring TypeScript',
          word_count: 3200,
        },
        {
          key: 'writing:reference/writing-overview',
          bundle: 'writing',
          type: 'reference',
          path: 'references/writing-overview.md',
          upstream_path: 'README.md',
          word_count: 1800,
        },
      ],
    };
    expect(() => DocMapSchema.parse(docMap)).not.toThrow();
  });
});
