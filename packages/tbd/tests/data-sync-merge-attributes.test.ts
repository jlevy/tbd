/**
 * `ensureDataSyncMergeAttributes`: the sync-time writer of the sync branch's merge rules.
 *
 * The data scaffold writes `issues/.gitattributes` and `mappings/.gitattributes` only when
 * a worktree is created, so a repository initialized before one of them existed never got
 * it. Sync now calls this before it merges, which makes "at most one commit, then nothing"
 * the property that matters: it runs on every sync.
 *
 * The end-to-end merge behavior on an upgraded repository is
 * cli-sync-merge-attributes-upgraded-repo.tryscript.md.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureDataSyncMergeAttributes } from '../src/file/git.js';

const execFileAsync = promisify(execFile);
const describeUnlessWindows = platform() === 'win32' ? describe.skip : describe;

const ISSUES_ATTRIBUTES = '.tbd/data-sync/issues/.gitattributes';
const MAPPINGS_ATTRIBUTES = '.tbd/data-sync/mappings/.gitattributes';

describeUnlessWindows('ensureDataSyncMergeAttributes', () => {
  let repo: string;

  async function git(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: repo });
    return stdout.trim();
  }

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'tbd-merge-attributes-'));
    await git('init', '-q', '-b', 'tbd-sync');
    await git('config', 'user.email', 't@e.com');
    await git('config', 'user.name', 'T');
    await git('config', 'commit.gpgsign', 'false');
    // The layout tbd 0.8.1 committed: no `issues/.gitattributes`.
    await mkdir(join(repo, '.tbd/data-sync/issues'), { recursive: true });
    await mkdir(join(repo, '.tbd/data-sync/mappings'), { recursive: true });
    await writeFile(join(repo, '.tbd/data-sync/meta.yml'), 'schema_version: 1\n');
    await writeFile(join(repo, '.tbd/data-sync/issues/.gitkeep'), '');
    await writeFile(join(repo, MAPPINGS_ATTRIBUTES), 'ids.yml merge=union\n');
    await git('add', '-A');
    await git('commit', '-q', '-m', 'Initialize tbd-sync data layout');
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('adds the missing bead attribute in one commit and leaves the present one alone', async () => {
    const head = await git('rev-parse', 'HEAD');

    expect(await ensureDataSyncMergeAttributes(repo)).toEqual([ISSUES_ATTRIBUTES]);

    expect(await readFile(join(repo, ISSUES_ATTRIBUTES), 'utf8')).toBe('*.md merge=binary\n');
    expect(await git('rev-list', '--count', `${head}..HEAD`)).toBe('1');
    expect(await git('diff', '--name-only', head, 'HEAD')).toBe(ISSUES_ATTRIBUTES);
    expect(await git('status', '--porcelain')).toBe('');
  });

  it('writes and commits nothing once the attributes are on the branch', async () => {
    await ensureDataSyncMergeAttributes(repo);
    const head = await git('rev-parse', 'HEAD');

    expect(await ensureDataSyncMergeAttributes(repo)).toEqual([]);
    expect(await git('rev-parse', 'HEAD')).toBe(head);
  });

  it('restores a committed attribute deleted from disk without an empty commit', async () => {
    await ensureDataSyncMergeAttributes(repo);
    const head = await git('rev-parse', 'HEAD');
    await unlink(join(repo, ISSUES_ATTRIBUTES));

    expect(await ensureDataSyncMergeAttributes(repo)).toEqual([ISSUES_ATTRIBUTES]);
    expect(await git('rev-parse', 'HEAD')).toBe(head);
    expect(await git('status', '--porcelain')).toBe('');
  });

  it('takes the published copy of a missing file, so the merge that follows is clean', async () => {
    // The remote already carries the file with other contents: a hand edit, or a later
    // release's rules. Writing the default here would make the merge an add/add conflict,
    // which the sync's conflict-marker check refuses to commit.
    const custom = '*.md merge=binary\n# kept by the team\n';
    await git('checkout', '-q', '-b', 'published');
    await writeFile(join(repo, ISSUES_ATTRIBUTES), custom);
    await git('add', ISSUES_ATTRIBUTES);
    await git('commit', '-q', '-m', 'Published with local additions');
    await git('checkout', '-q', 'tbd-sync');

    expect(await ensureDataSyncMergeAttributes(repo, 'published')).toEqual([ISSUES_ATTRIBUTES]);
    expect(await readFile(join(repo, ISSUES_ATTRIBUTES), 'utf8')).toBe(custom);

    await git('merge', '-q', '--no-edit', 'published');
    expect(await readFile(join(repo, ISSUES_ATTRIBUTES), 'utf8')).toBe(custom);
    expect(await git('status', '--porcelain')).toBe('');
  });

  it('writes the default when the published ref lacks the file or does not exist', async () => {
    await git('branch', 'published');

    expect(await ensureDataSyncMergeAttributes(repo, 'published')).toEqual([ISSUES_ATTRIBUTES]);
    expect(await readFile(join(repo, ISSUES_ATTRIBUTES), 'utf8')).toBe('*.md merge=binary\n');

    await unlink(join(repo, MAPPINGS_ATTRIBUTES));
    expect(await ensureDataSyncMergeAttributes(repo, 'origin/missing')).toEqual([
      MAPPINGS_ATTRIBUTES,
    ]);
    expect(await readFile(join(repo, MAPPINGS_ATTRIBUTES), 'utf8')).toBe('ids.yml merge=union\n');
  });

  it('does not commit unrelated staged work along with the attribute', async () => {
    await writeFile(join(repo, '.tbd/data-sync/issues/is-staged.md'), 'staged\n');
    await git('add', '.tbd/data-sync/issues/is-staged.md');

    await ensureDataSyncMergeAttributes(repo);

    expect(await git('show', '--name-only', '--format=', 'HEAD')).toBe(ISSUES_ATTRIBUTES);
    expect(await git('diff', '--cached', '--name-only')).toBe('.tbd/data-sync/issues/is-staged.md');
  });
});
