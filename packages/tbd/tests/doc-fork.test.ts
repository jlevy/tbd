/**
 * Tests for fork operations (forkDoc / unforkDoc / forkStatusFor) against a temp dir.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  forkDoc,
  unforkDoc,
  forkStatusFor,
  forkFilePath,
  forkRelPath,
  ForkConflictError,
  DEFAULT_FORK_DIR,
} from '../src/file/doc-fork.js';
import { emptyManifest, findFork, readBaseContent } from '../src/file/fork-manifest.js';

const FORK_DIR = DEFAULT_FORK_DIR;
const UPSTREAM = '# Python Rules\n\nUpstream content.\n';

describe('forkDoc', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-doc-fork-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function fork(content = UPSTREAM, force = false) {
    return forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: emptyManifest(),
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content,
      force,
    });
  }

  it('writes the forked file, base snapshot, and manifest entry', async () => {
    const result = await fork();
    expect(result.action).toBe('created');
    expect(result.relPath).toBe('docs/tbd/guidelines/python-rules.md');

    const fileContent = await readFile(
      forkFilePath(root, FORK_DIR, 'guideline', 'python-rules'),
      'utf-8',
    );
    expect(fileContent).toBe(UPSTREAM);
    expect(await readBaseContent(root, 'guideline', 'python-rules')).toBe(UPSTREAM);

    const entry = findFork(result.manifest, 'python-rules');
    expect(entry).toMatchObject({
      name: 'python-rules',
      kind: 'guideline',
      path: 'docs/tbd/guidelines/python-rules.md',
      source: 'internal:guidelines/python-rules.md',
    });
  });

  it('refuses to overwrite a pre-existing non-fork file', async () => {
    const abs = forkFilePath(root, FORK_DIR, 'guideline', 'python-rules');
    await import('node:fs/promises').then((fs) =>
      fs.mkdir(join(root, FORK_DIR, 'guidelines'), { recursive: true }),
    );
    await writeFile(abs, 'pre-existing user content\n');

    await expect(fork()).rejects.toThrow(ForkConflictError);
    // --force overwrites.
    const forced = await fork(UPSTREAM, true);
    expect(forced.action).toBe('created');
    expect(await readFile(abs, 'utf-8')).toBe(UPSTREAM);
  });

  it('refreshes an unmodified fork to new upstream and advances the base', async () => {
    const first = await fork();
    const NEW_UPSTREAM = '# Python Rules\n\nNew upstream.\n';
    const refreshed = await forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: first.manifest,
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content: NEW_UPSTREAM,
    });
    expect(refreshed.action).toBe('refreshed');
    expect(await readBaseContent(root, 'guideline', 'python-rules')).toBe(NEW_UPSTREAM);
  });
});

describe('forkStatusFor', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-doc-fork-status-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reports forked / customized / stale / missing correctly', async () => {
    const { manifest } = await forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: emptyManifest(),
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content: UPSTREAM,
    });
    const entry = findFork(manifest, 'python-rules')!;
    const abs = forkFilePath(root, FORK_DIR, 'guideline', 'python-rules');

    // Unmodified, upstream unchanged -> forked.
    expect((await forkStatusFor(root, FORK_DIR, entry, UPSTREAM)).state).toBe('forked');

    // Upstream moved, file unmodified -> stale.
    expect((await forkStatusFor(root, FORK_DIR, entry, UPSTREAM + 'more\n')).state).toBe('stale');

    // Edit the file -> customized.
    await writeFile(abs, UPSTREAM + 'my edit\n');
    const customized = await forkStatusFor(root, FORK_DIR, entry, UPSTREAM);
    expect(customized.state).toBe('customized');
    expect(customized.customized).toBe(true);

    // Source gone from cache -> orphaned.
    expect((await forkStatusFor(root, FORK_DIR, entry, null)).state).toBe('orphaned');

    // Delete the file out-of-band -> missing.
    await rm(abs, { force: true });
    expect((await forkStatusFor(root, FORK_DIR, entry, UPSTREAM)).state).toBe('missing');
  });
});

describe('unforkDoc', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-doc-unfork-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function setup() {
    return forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: emptyManifest(),
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content: UPSTREAM,
    });
  }

  it('removes file, base, and entry for an unmodified fork', async () => {
    const { manifest } = await setup();
    const result = await unforkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest,
      name: 'python-rules',
    });
    expect(result.fileRemoved).toBe(true);
    expect(findFork(result.manifest, 'python-rules')).toBeUndefined();
    expect(await readBaseContent(root, 'guideline', 'python-rules')).toBeNull();
  });

  it('refuses to unfork a customized doc unless forced', async () => {
    const { manifest } = await setup();
    const abs = forkFilePath(root, FORK_DIR, 'guideline', 'python-rules');
    await writeFile(abs, UPSTREAM + 'edits\n');

    await expect(
      unforkDoc({ tbdRoot: root, forkDir: FORK_DIR, manifest, name: 'python-rules' }),
    ).rejects.toThrow(ForkConflictError);

    const forced = await unforkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest,
      name: 'python-rules',
      force: true,
    });
    expect(forced.fileRemoved).toBe(true);
  });

  it('cleans up a missing-file entry without complaint', async () => {
    const { manifest } = await setup();
    await rm(forkFilePath(root, FORK_DIR, 'guideline', 'python-rules'), { force: true });
    const result = await unforkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest,
      name: 'python-rules',
    });
    expect(result.fileRemoved).toBe(false);
    expect(findFork(result.manifest, 'python-rules')).toBeUndefined();
  });

  it('errors when the doc is not forked', async () => {
    await expect(
      unforkDoc({ tbdRoot: root, forkDir: FORK_DIR, manifest: emptyManifest(), name: 'nope' }),
    ).rejects.toThrow(ForkConflictError);
  });

  it('forkRelPath uses plural kind dirs', () => {
    expect(forkRelPath(FORK_DIR, 'shortcut', 'review-code')).toBe(
      'docs/tbd/shortcuts/review-code.md',
    );
  });
});
