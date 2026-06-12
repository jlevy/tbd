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
  listLocalForkFiles,
  computeForkDriftSummary,
  regenerateForkDirReadme,
  ForkConflictError,
} from '../src/file/doc-fork.js';
import { emptyManifest, findFork, readBaseContent } from '../src/file/fork-manifest.js';

import { FORK_DIR } from '../src/lib/paths.js';
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

  it('blocks a refresh when the fork point was set by a newer tbd (S4 version-skew)', async () => {
    // The first fork records its fork point at a tbd newer than the one we now run.
    const first = await forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: emptyManifest(),
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content: UPSTREAM,
      tbdVersion: '0.9.0',
    });

    const OLDER_BUNDLE = '# Python Rules\n\nOlder bundled content.\n';
    const reForkOlder = (force = false) =>
      forkDoc({
        tbdRoot: root,
        forkDir: FORK_DIR,
        manifest: first.manifest,
        kind: 'guideline',
        name: 'python-rules',
        source: 'internal:guidelines/python-rules.md',
        content: OLDER_BUNDLE,
        tbdVersion: '0.3.0', // older than the 0.9.0 fork point
        force,
      });

    // Refreshing here would silently downgrade the doc to our older bundle — blocked.
    const err = await reForkOlder().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForkConflictError);
    expect((err as ForkConflictError).code).toBe('version-skew');
    // The base snapshot is untouched by the blocked refresh.
    expect(await readBaseContent(root, 'guideline', 'python-rules')).toBe(UPSTREAM);

    // --force is the explicit downgrade escape hatch.
    const forced = await reForkOlder(true);
    expect(forced.action).toBe('refreshed');
    expect(await readBaseContent(root, 'guideline', 'python-rules')).toBe(OLDER_BUNDLE);
  });

  it('allows a refresh when the running tbd is the same or newer than the fork point', async () => {
    const first = await forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: emptyManifest(),
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content: UPSTREAM,
      tbdVersion: '0.9.0',
    });
    const NEWER = '# Python Rules\n\nNewer upstream.\n';
    const refreshed = await forkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest: first.manifest,
      kind: 'guideline',
      name: 'python-rules',
      source: 'internal:guidelines/python-rules.md',
      content: NEWER,
      tbdVersion: '1.0.0', // newer than the fork point
    });
    expect(refreshed.action).toBe('refreshed');
    expect(await readBaseContent(root, 'guideline', 'python-rules')).toBe(NEWER);
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

describe('drift helpers (local files, summary, README index)', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-doc-drift-'));
    // A minimal upstream cache copy so staleness can be computed.
    await import('node:fs/promises').then((fs) =>
      fs.mkdir(join(root, '.tbd', 'docs', 'guidelines'), { recursive: true }),
    );
    await writeFile(join(root, '.tbd', 'docs', 'guidelines', 'python-rules.md'), UPSTREAM);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function forkOne() {
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

  it('listLocalForkFiles finds stray files but ignores nested folders', async () => {
    const { manifest } = await forkOne();
    const dir = join(root, FORK_DIR, 'guidelines');
    await writeFile(join(dir, 'team-rules.md'), '# Team\n');
    await import('node:fs/promises').then((fs) =>
      fs.mkdir(join(dir, 'nested'), { recursive: true }),
    );
    await writeFile(join(dir, 'nested', 'hidden.md'), '# Hidden\n');

    const locals = await listLocalForkFiles(root, FORK_DIR, manifest);
    expect(locals).toEqual([
      { kind: 'guideline', name: 'team-rules', relPath: 'docs/tbd/guidelines/team-rules.md' },
    ]);
  });

  it('computeForkDriftSummary reports stale, missing, and local counts', async () => {
    const { manifest } = await forkOne();

    // Fresh fork, cache matches base: no drift.
    let s = await computeForkDriftSummary(root, FORK_DIR, manifest);
    expect(s).toMatchObject({ forks: 1, stale: 0, missing: 0, local: 0 });

    // Upstream (cache) moves: stale.
    await writeFile(join(root, '.tbd', 'docs', 'guidelines', 'python-rules.md'), UPSTREAM + 'v2\n');
    s = await computeForkDriftSummary(root, FORK_DIR, manifest);
    expect(s.stale).toBe(1);

    // Forked file deleted out-of-band: missing. A stray file: local.
    await rm(join(root, FORK_DIR, 'guidelines', 'python-rules.md'));
    await writeFile(join(root, FORK_DIR, 'guidelines', 'team-rules.md'), '# Team\n');
    s = await computeForkDriftSummary(root, FORK_DIR, manifest);
    expect(s).toMatchObject({ missing: 1, local: 1 });
  });

  it('regenerateForkDirReadme writes the index and prunes when empty', async () => {
    const { manifest } = await forkOne();
    await regenerateForkDirReadme(root, FORK_DIR, manifest);
    const readme = await readFile(join(root, FORK_DIR, 'README.md'), 'utf-8');
    expect(readme).toContain('DO NOT EDIT');
    expect(readme).toContain('python-rules');
    expect(readme).toContain('nested\n  folders are not scanned');

    // Unfork everything: README and empty dirs are pruned.
    const { manifest: empty } = await unforkDoc({
      tbdRoot: root,
      forkDir: FORK_DIR,
      manifest,
      name: 'python-rules',
    });
    await regenerateForkDirReadme(root, FORK_DIR, empty);
    await expect(readFile(join(root, FORK_DIR, 'README.md'), 'utf-8')).rejects.toThrow();
  });

  it('sanitizes a local doc’s blurb and link target in the README index (S6)', async () => {
    const { manifest } = await forkOne();

    // A hand-authored local doc (no manifest entry, so its name is NOT
    // isSafeDocName-validated): a filename with a space and a frontmatter
    // description carrying markdown/HTML/link injection.
    const evil = '---\n' + 'description: "Evil <b>x</b> [l](http://e) | `c`"\n' + '---\n# Local\n';
    await writeFile(join(root, FORK_DIR, 'guidelines', 'team rules.md'), evil);

    await regenerateForkDirReadme(root, FORK_DIR, manifest);
    const readme = await readFile(join(root, FORK_DIR, 'README.md'), 'utf-8');

    // The blurb's structure-breaking characters are stripped: no raw HTML, no
    // injected link/code span, no table pipe.
    expect(readme).not.toContain('<b>');
    expect(readme).not.toContain('</b>');
    expect(readme).not.toContain('[l]');
    expect(readme).not.toContain('`c`');
    // The link target for the spaced filename is percent-encoded so it stays a
    // single valid link.
    expect(readme).toContain('team%20rules.md');
  });
});
