/** End-to-end CLI contract tests for `tbd watch`. */

import { execFile, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { serializeIssue } from '../src/file/parser.js';
import { CURRENT_FORMAT } from '../src/lib/tbd-format.js';
import { stringifyYaml } from '../src/utils/yaml-utils.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL('..', import.meta.url));
const tbdBin = join(packageDir, 'dist', 'bin.mjs');
const cleanupPaths: string[] = [];
const ISSUE_ID = testId(TEST_ULIDS.ULID_1);

interface WatchRepo {
  repoDir: string;
  since: string;
  tip: string;
}

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoDir });
  return stdout.trim();
}

function runTbd(repoDir: string, args: string[]) {
  return spawnSync(process.execPath, [tbdBin, ...args], {
    cwd: repoDir,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

async function createWatchRepo(advanceRemote: boolean): Promise<WatchRepo> {
  const root = await mkdtemp(join(tmpdir(), 'tbd-cli-watch-'));
  cleanupPaths.push(root);
  const remoteDir = join(root, 'remote.git');
  const repoDir = join(root, 'repo');
  await mkdir(remoteDir);
  await git(remoteDir, 'init', '--bare');
  await mkdir(repoDir);
  await git(repoDir, 'init', '-b', 'main');
  await git(repoDir, 'config', 'user.email', 'test@example.com');
  await git(repoDir, 'config', 'user.name', 'Test User');
  await git(repoDir, 'config', 'commit.gpgsign', 'false');
  await git(repoDir, 'remote', 'add', 'origin', remoteDir);
  await mkdir(join(repoDir, '.tbd'), { recursive: true });
  await writeFile(
    join(repoDir, '.tbd', 'config.yml'),
    stringifyYaml({
      tbd_format: CURRENT_FORMAT,
      tbd_version: '0.4.1',
      tbd_upgrades: [],
      display: { id_prefix: 'tbd' },
      sync: { branch: 'tbd-sync', remote: 'origin', storage: 'git-common-dir-v1' },
      settings: { auto_sync: false, doc_auto_sync_hours: 24, use_gh_cli: false },
    }),
  );
  await git(repoDir, 'add', '.tbd/config.yml');
  await git(repoDir, 'commit', '-m', 'main');
  await git(repoDir, 'checkout', '--orphan', 'tbd-sync');
  await git(repoDir, 'rm', '-rf', '.');
  const issueDir = join(repoDir, '.tbd', 'data-sync', 'issues');
  const mappingDir = join(repoDir, '.tbd', 'data-sync', 'mappings');
  await mkdir(issueDir, { recursive: true });
  await mkdir(mappingDir, { recursive: true });
  const before = createTestIssue({ id: ISSUE_ID, title: 'Watch CLI', notes: 'before' });
  await writeFile(join(issueDir, `${ISSUE_ID}.md`), serializeIssue(before));
  await writeFile(join(mappingDir, 'ids.yml'), stringifyYaml({ a1b2: TEST_ULIDS.ULID_1 }));
  await git(repoDir, 'add', '.tbd/data-sync');
  await git(repoDir, 'commit', '-m', 'base');
  const since = await git(repoDir, 'rev-parse', 'HEAD');
  await git(repoDir, 'push', 'origin', 'HEAD:refs/heads/tbd-sync');

  let tip = since;
  if (advanceRemote) {
    await writeFile(
      join(issueDir, `${ISSUE_ID}.md`),
      serializeIssue({ ...before, notes: 'before\nafter', version: 2 }),
    );
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'tip');
    tip = await git(repoDir, 'rev-parse', 'HEAD');
    await git(repoDir, 'push', 'origin', 'HEAD:refs/heads/tbd-sync');
  }
  await git(repoDir, 'checkout', 'main');
  await git(repoDir, 'update-ref', 'refs/heads/tbd-sync', since);
  return { repoDir, since, tip };
}

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('tbd watch', () => {
  it('immediately reports changes after --since using the stable JSON document', async () => {
    const fixture = await createWatchRepo(true);
    const result = runTbd(fixture.repoDir, [
      'watch',
      '--all',
      '--since',
      fixture.since,
      '--timeout',
      '1',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      since: fixture.since,
      tip: fixture.tip,
      changes: [
        {
          id: 'tbd-a1b2',
          fields: [expect.objectContaining({ field: 'notes', after: 'before\nafter' })],
        },
      ],
    });
  });

  it('exits 2 with no stdout when the timeout elapses', async () => {
    const fixture = await createWatchRepo(false);
    const result = runTbd(fixture.repoDir, ['watch', '--all', '--timeout', '0', '--json']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('requires a selector and enforces the minimum poll interval', async () => {
    const fixture = await createWatchRepo(false);
    const missing = runTbd(fixture.repoDir, ['watch', '--timeout', '0']);
    const tooFast = runTbd(fixture.repoDir, [
      'watch',
      '--all',
      '--interval',
      '1',
      '--timeout',
      '0',
    ]);

    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain('A selector is required');
    expect(tooFast.status).toBe(2);
    expect(tooFast.stderr).toContain('at least 10 seconds');
  });

  it('exits 1 when the configured remote branch is absent', async () => {
    const fixture = await createWatchRepo(false);
    await git(fixture.repoDir, 'push', 'origin', '--delete', 'tbd-sync');
    const result = runTbd(fixture.repoDir, ['watch', '--all', '--timeout', '0', '--json']);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: expect.stringContaining('Failed to read remote sync tip'),
    });
  });
});
