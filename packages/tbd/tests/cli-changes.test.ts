/** End-to-end CLI contract tests for `tbd changes`. */

import { execFile, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { serializeIssue } from '../src/file/parser.js';
import { CURRENT_FORMAT } from '../src/lib/tbd-format.js';
import { stringifyYaml } from '../src/utils/yaml-utils.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL('..', import.meta.url));
const tbdBin = join(packageDir, 'dist', 'bin.mjs');
const cleanupPaths: string[] = [];
const ISSUE_ID = testId(TEST_ULIDS.ULID_1);

interface ChangesRepo {
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

async function createChangesRepo(): Promise<ChangesRepo> {
  const repoDir = await mkdtemp(join(tmpdir(), 'tbd-cli-changes-'));
  cleanupPaths.push(repoDir);
  await git(repoDir, 'init', '-b', 'main');
  await git(repoDir, 'config', 'user.email', 'test@example.com');
  await git(repoDir, 'config', 'user.name', 'Test User');
  await git(repoDir, 'config', 'commit.gpgsign', 'false');
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
  const before = createTestIssue({ id: ISSUE_ID, title: 'CLI change', notes: 'before' });
  await writeFile(join(issueDir, `${ISSUE_ID}.md`), serializeIssue(before));
  await writeFile(join(mappingDir, 'ids.yml'), stringifyYaml({ a1b2: TEST_ULIDS.ULID_1 }));
  await git(repoDir, 'add', '.tbd/data-sync');
  await git(repoDir, 'commit', '-m', 'base');
  const since = await git(repoDir, 'rev-parse', 'HEAD');

  await writeFile(
    join(issueDir, `${ISSUE_ID}.md`),
    serializeIssue({ ...before, notes: 'before\nafter', version: 2 }),
  );
  await git(repoDir, 'add', '.tbd/data-sync');
  await git(repoDir, 'commit', '-m', 'tip');
  const tip = await git(repoDir, 'rev-parse', 'HEAD');
  await git(repoDir, 'checkout', 'main');
  return { repoDir, since, tip };
}

beforeAll(() => {
  expect(tbdBin).toBeTruthy();
});

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) =>
      rm(path, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }),
    ),
  );
});

describe('tbd changes', () => {
  it('emits the stable JSON document and exits zero for a matching change', async () => {
    const fixture = await createChangesRepo();
    const result = runTbd(fixture.repoDir, [
      'changes',
      '--since',
      fixture.since,
      '--bead',
      'tbd-a1b2',
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
          internal_id: ISSUE_ID,
          change: 'updated',
          fields: [expect.objectContaining({ field: 'notes', after: 'before\nafter' })],
        },
      ],
    });
  });

  it('emits an empty JSON report and exits 3 when nothing matches', async () => {
    const fixture = await createChangesRepo();
    const result = runTbd(fixture.repoDir, ['changes', '--since', fixture.tip, '--json']);

    expect(result.status).toBe(3);
    expect(JSON.parse(result.stdout)).toEqual({
      since: fixture.tip,
      tip: fixture.tip,
      changes: [],
    });
  });

  it('renders human field hunks and honors quiet exit-status mode', async () => {
    const fixture = await createChangesRepo();
    const human = runTbd(fixture.repoDir, ['changes', '--since', fixture.since]);
    const quiet = runTbd(fixture.repoDir, ['changes', '--since', fixture.since, '--quiet']);

    expect(human.status).toBe(0);
    expect(human.stdout).toContain(`Changes ${fixture.since}..${fixture.tip}`);
    expect(human.stdout).toContain('tbd-a1b2 [updated] CLI change');
    expect(human.stdout).toContain('+after');
    expect(quiet.status).toBe(0);
    expect(quiet.stdout).toBe('');
    expect(quiet.stderr).toBe('');
  });

  it('rejects incompatible selectors as a usage error', async () => {
    const fixture = await createChangesRepo();
    const result = runTbd(fixture.repoDir, [
      'changes',
      '--since',
      fixture.since,
      '--all',
      '--label',
      'phase-1',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('cannot be combined');
  });

  it('suggests tbd sync when the local sync branch is missing', async () => {
    const fixture = await createChangesRepo();
    await git(fixture.repoDir, 'update-ref', '-d', 'refs/heads/tbd-sync');

    const result = runTbd(fixture.repoDir, ['changes', '--since', fixture.since, '--json']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Run tbd sync first');
  });
});
