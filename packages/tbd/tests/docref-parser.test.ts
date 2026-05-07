/**
 * Tests for the docref parser.
 *
 * Test cases here cover every example shown in the docref spec
 * (`packages/tbd/docs/design-docref-format.md`). The spec and these
 * tests MUST stay in exact sync — when the spec changes, tests must
 * be updated; when tests change, the spec must reflect the new
 * behavior.
 */

import { describe, expect, it } from 'vitest';

import { parseDocref, parseGitBody } from '../src/docref/index.js';

describe('parseDocref — filesystem paths', () => {
  it('absolute path (file)', () => {
    expect(parseDocref('/abs/path/file.md')).toEqual({
      kind: 'path',
      path: '/abs/path/file.md',
      absolute: true,
      isDir: false,
    });
  });

  it('absolute path (directory)', () => {
    expect(parseDocref('/abs/path/to/docs/')).toEqual({
      kind: 'path',
      path: '/abs/path/to/docs/',
      absolute: true,
      isDir: true,
    });
  });

  it('relative path (file)', () => {
    expect(parseDocref('./docs/guidelines/typescript.md')).toEqual({
      kind: 'path',
      path: './docs/guidelines/typescript.md',
      absolute: false,
      isDir: false,
    });
  });

  it('relative path (directory)', () => {
    expect(parseDocref('./docs/agent/')).toEqual({
      kind: 'path',
      path: './docs/agent/',
      absolute: false,
      isDir: true,
    });
  });

  it('parent-relative path', () => {
    expect(parseDocref('../sibling/file.md')).toEqual({
      kind: 'path',
      path: '../sibling/file.md',
      absolute: false,
      isDir: false,
    });
  });

  it('rejects bare relative path (no leading ./)', () => {
    expect(() => parseDocref('foo/bar.md')).toThrow(/Invalid docref/);
  });
});

describe('parseDocref — scheme-prefixed', () => {
  it('https URL', () => {
    expect(parseDocref('https://example.com/foo.md')).toEqual({
      kind: 'scheme',
      scheme: 'https',
      body: '//example.com/foo.md',
    });
  });

  it('http URL', () => {
    expect(parseDocref('http://example.org/page.html')).toEqual({
      kind: 'scheme',
      scheme: 'http',
      body: '//example.org/page.html',
    });
  });

  it('github scheme — bare repo', () => {
    expect(parseDocref('github:jlevy/coding-guidelines')).toEqual({
      kind: 'scheme',
      scheme: 'github',
      body: 'jlevy/coding-guidelines',
    });
  });

  it('github scheme — pinned to branch with sub-path', () => {
    expect(parseDocref('github:jlevy/coding-guidelines@main//guidelines/')).toEqual({
      kind: 'scheme',
      scheme: 'github',
      body: 'jlevy/coding-guidelines@main//guidelines/',
    });
  });

  it('gitlab scheme — nested group', () => {
    expect(parseDocref('gitlab:my-group/my-subgroup/my-project@main')).toEqual({
      kind: 'scheme',
      scheme: 'gitlab',
      body: 'my-group/my-subgroup/my-project@main',
    });
  });

  it('git scheme wrapping HTTPS remote', () => {
    expect(parseDocref('git:https://self-hosted.example.com/org/repo.git@main')).toEqual({
      kind: 'scheme',
      scheme: 'git',
      body: 'https://self-hosted.example.com/org/repo.git@main',
    });
  });

  it('git scheme wrapping SSH remote', () => {
    expect(parseDocref('git:git@host.example.com:org/repo.git@main//src/')).toEqual({
      kind: 'scheme',
      scheme: 'git',
      body: 'git@host.example.com:org/repo.git@main//src/',
    });
  });

  it('arbitrary unknown scheme is parsed without error (consumer decides)', () => {
    expect(parseDocref('s3:my-bucket/path/to/file')).toEqual({
      kind: 'scheme',
      scheme: 's3',
      body: 'my-bucket/path/to/file',
    });
    expect(parseDocref('bitbucket:org/repo@main')).toEqual({
      kind: 'scheme',
      scheme: 'bitbucket',
      body: 'org/repo@main',
    });
  });

  it('scheme is lowercased', () => {
    expect(parseDocref('GitHub:owner/repo')).toEqual({
      kind: 'scheme',
      scheme: 'github',
      body: 'owner/repo',
    });
  });

  it('scheme matches RFC-style alpha+digit+(+/-/.) chars', () => {
    expect(parseDocref('git+ssh:foo/bar')).toMatchObject({ scheme: 'git+ssh' });
    expect(parseDocref('a1.b-c+d:rest')).toMatchObject({ scheme: 'a1.b-c+d' });
  });

  it('rejects empty / unrecognized input', () => {
    expect(() => parseDocref('')).toThrow(/Invalid docref/);
    expect(() => parseDocref('not-a-docref')).toThrow(/Invalid docref/);
  });
});

describe('parseDocref — fragment dropping', () => {
  it('drops fragment from scheme docref', () => {
    expect(parseDocref('github:foo/bar@main#section1')).toEqual({
      kind: 'scheme',
      scheme: 'github',
      body: 'foo/bar@main',
    });
  });

  it('drops fragment from path docref', () => {
    expect(parseDocref('./docs/file.md#heading')).toEqual({
      kind: 'path',
      path: './docs/file.md',
      absolute: false,
      isDir: false,
    });
  });

  it('drops fragment-only suffix', () => {
    expect(parseDocref('https://x.com/y#z')).toEqual({
      kind: 'scheme',
      scheme: 'https',
      body: '//x.com/y',
    });
  });
});

describe('parseGitBody — convention for git-style schemes', () => {
  it('bare body — no ref or path', () => {
    expect(parseGitBody('jlevy/coding-guidelines')).toEqual({
      rest: 'jlevy/coding-guidelines',
      isDir: false,
    });
  });

  it('body with ref only', () => {
    expect(parseGitBody('jlevy/coding-guidelines@main')).toEqual({
      rest: 'jlevy/coding-guidelines',
      ref: 'main',
      isDir: false,
    });
  });

  it('body with ref and file path', () => {
    expect(parseGitBody('jlevy/coding-guidelines@main//guidelines/typescript.md')).toEqual({
      rest: 'jlevy/coding-guidelines',
      ref: 'main',
      path: 'guidelines/typescript.md',
      isDir: false,
    });
  });

  it('body with ref and directory path', () => {
    expect(parseGitBody('jlevy/coding-guidelines@main//guidelines/')).toEqual({
      rest: 'jlevy/coding-guidelines',
      ref: 'main',
      path: 'guidelines',
      isDir: true,
    });
  });

  it('body with tag ref', () => {
    expect(parseGitBody('jlevy/coding-guidelines@v1.2.0')).toEqual({
      rest: 'jlevy/coding-guidelines',
      ref: 'v1.2.0',
      isDir: false,
    });
  });

  it('body with commit ref', () => {
    expect(parseGitBody('jlevy/coding-guidelines@a1b2c3d')).toEqual({
      rest: 'jlevy/coding-guidelines',
      ref: 'a1b2c3d',
      isDir: false,
    });
  });

  it('body with nested group (GitLab)', () => {
    expect(parseGitBody('my-group/my-subgroup/my-project@main')).toEqual({
      rest: 'my-group/my-subgroup/my-project',
      ref: 'main',
      isDir: false,
    });
  });

  it('body wrapping HTTPS remote (git: scheme)', () => {
    expect(parseGitBody('https://self-hosted.example.com/org/repo.git@main')).toEqual({
      rest: 'https://self-hosted.example.com/org/repo.git',
      ref: 'main',
      isDir: false,
    });
  });

  it('body wrapping HTTPS remote with sub-path', () => {
    expect(parseGitBody('https://self-hosted.example.com/org/repo.git@main//src/foo.md')).toEqual({
      rest: 'https://self-hosted.example.com/org/repo.git',
      ref: 'main',
      path: 'src/foo.md',
      isDir: false,
    });
  });

  it('body wrapping SSH remote (git@host) with ref and dir path', () => {
    expect(parseGitBody('git@host.example.com:org/repo.git@main//src/')).toEqual({
      rest: 'git@host.example.com:org/repo.git',
      ref: 'main',
      path: 'src',
      isDir: true,
    });
  });

  it('body wrapping SSH remote without ref', () => {
    // The single @ here is part of git@host (before colon), NOT a ref separator.
    expect(parseGitBody('git@host.example.com:org/repo.git')).toEqual({
      rest: 'git@host.example.com:org/repo.git',
      isDir: false,
    });
  });
});
