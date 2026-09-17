/**
 * End-to-end coverage for `tbd doctor --fix`'s orphaned-dependency repair.
 *
 * The repair has no platform-specific behaviour (`atomically`, `join`, LF
 * serialization, like every other writer), so this suite runs on every platform.
 * Only the two cases that need POSIX file permissions or worktree surgery are
 * skipped on Windows, each for its own stated reason.
 *
 * Covers, besides the happy path: an edge whose target file is present but does not
 * parse is kept (the target is broken, not deleted); the repair is not claimed when
 * the shared store is not ready for writes (corrupted worktree, newer config format);
 * a failed write is reported per file with the store left repairable; and an id
 * claimed by two files is reported instead of rewritten.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

import { deleteIssue, listIssues } from '../src/file/storage.js';
import { withSharedDataSyncLock } from '../src/file/common-dir-layout.js';

// Every case here drives the real CLI a dozen times over real git repositories, and
// the setup hook alone runs `git init`, `tbd init`, three creates and two `dep add`s.
// Under full-suite parallel load that exceeds both default budgets, so give the file
// the same generous budget the other CLI end-to-end suites use.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

interface DoctorCheck {
  name: string;
  status: string;
  message?: string;
  details?: string[];
  fixable?: boolean;
}

async function gitIn(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

function runTbd(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [tbdBin, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 1,
  };
}

/**
 * Async variant, for the one case that must drive doctor while this process holds the
 * shared writer lock; `runTbd` uses `spawnSync` and would deadlock against it.
 */
async function runTbdAsync(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; status: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return { stdout: stdout ?? '', stderr: stderr ?? '', status: 0 };
  } catch (error) {
    // doctor exits non-zero whenever it reports an error finding, which several of
    // these cases expect; the JSON report is still on stdout.
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      status: failure.code ?? 1,
    };
  }
}

function parseDoctorReport(result: { stdout: string; stderr: string }): DoctorCheck[] {
  try {
    return (JSON.parse(result.stdout) as { healthChecks: DoctorCheck[] }).healthChecks;
  } catch (error) {
    throw new Error(
      `doctor produced no JSON report (${String(error)}).\n` +
        `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }
}

/** Run doctor with `--json` and return the named health check. */
function doctorCheck(
  cwd: string,
  args: string[],
  name: string,
): { check: DoctorCheck | undefined; status: number } {
  const result = runTbd(cwd, [...args, '--json']);
  return {
    check: parseDoctorReport(result).find((finding) => finding.name === name),
    status: result.status,
  };
}

function createIssue(dir: string, title: string): void {
  const result = runTbd(dir, ['create', title, '--type', 'task', '--json']);
  expect(result.status, `create ${title}: ${result.stderr}`).toBe(0);
}

/** Resolve the internal (file-name) id of an issue by title. */
async function internalId(dataSyncDir: string, title: string): Promise<string> {
  const issues = await listIssues(dataSyncDir);
  const found = issues.find((issue) => issue.title === title);
  expect(found, `no issue titled ${title}`).toBeDefined();
  return found!.id;
}

/** Display ids by title: what the CLI accepts, and what doctor reports. */
function displayIds(dir: string): Map<string, string> {
  const result = runTbd(dir, ['list', '--json']);
  expect(result.status, result.stderr).toBe(0);
  const issues = JSON.parse(result.stdout) as { id: string; title: string }[];
  return new Map(issues.map((issue) => [issue.title, issue.id]));
}

async function readIssueFiles(dataSyncDir: string): Promise<Map<string, string>> {
  const issuesDir = join(dataSyncDir, 'issues');
  const files = (await readdir(issuesDir)).filter((file) => file.endsWith('.md'));
  const contents = new Map<string, string>();
  for (const file of files) {
    contents.set(file, await readFile(join(issuesDir, file), 'utf-8'));
  }
  return contents;
}

describe('doctor --fix orphaned dependency repair', () => {
  let dir: string;
  let dataSyncDir: string;
  let issuesDir: string;
  /** Display ids captured before any issue is deleted. */
  let display: Map<string, string>;

  /**
   * A repo with three issues: `Blocker` blocks both `Doomed target` and `Live target`,
   * so one file holds one edge that will dangle and one that must survive.
   */
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-orphan-deps-'));
    await gitIn(dir, 'init', '--initial-branch=main');
    await gitIn(dir, 'config', 'user.email', 'test@test.com');
    await gitIn(dir, 'config', 'user.name', 'Test');
    expect(runTbd(dir, ['init', '--prefix=test']).status).toBe(0);
    dataSyncDir = join(dir, '.git', 'tbd', 'data-sync-worktree', '.tbd', 'data-sync');
    issuesDir = join(dataSyncDir, 'issues');

    createIssue(dir, 'Doomed target');
    createIssue(dir, 'Live target');
    createIssue(dir, 'Blocker');
    display = displayIds(dir);
    expect(
      runTbd(dir, ['dep', 'add', display.get('Doomed target')!, display.get('Blocker')!]).status,
    ).toBe(0);
    expect(
      runTbd(dir, ['dep', 'add', display.get('Live target')!, display.get('Blocker')!]).status,
    ).toBe(0);
  });

  afterEach(async () => {
    // The write-failure case makes the issues directory read-only; restore it so the
    // temp tree can be removed even when that test failed part way through.
    await chmod(issuesDir, 0o755).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  });

  it('removes only the dangling edge and leaves every other file byte-identical', async () => {
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    const liveId = await internalId(dataSyncDir, 'Live target');
    const blockerId = await internalId(dataSyncDir, 'Blocker');
    await deleteIssue(dataSyncDir, doomedId);
    const before = await readIssueFiles(dataSyncDir);

    const diagnosed = doctorCheck(dir, ['doctor'], 'Dependencies');
    expect(diagnosed.check).toMatchObject({ status: 'warn', fixable: true });
    expect(diagnosed.check?.details).toContain(
      `${display.get('Blocker')!} -> ${display.get('Doomed target')!} (missing)`,
    );
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);

    const dryRun = runTbd(dir, ['--dry-run', 'doctor', '--fix']);
    expect(dryRun.status).toBe(0);
    expect(dryRun.stdout).toContain('[DRY-RUN] Remove orphaned dependency references');
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);

    const fixed = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(fixed.status).toBe(0);
    expect(fixed.check).toMatchObject({
      status: 'ok',
      message: 'removed 1 orphaned reference(s)',
    });
    // The destructive repair names every edge it dropped, not just a count.
    expect(fixed.check?.details).toEqual([
      `${display.get('Blocker')!} -> ${display.get('Doomed target')!}`,
    ]);

    const after = await readIssueFiles(dataSyncDir);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [file, content] of after) {
      if (file !== `${blockerId}.md`) {
        expect(content, `${file} must not be rewritten`).toBe(before.get(file));
      }
    }

    // The rewritten file differs from its previous contents in exactly three places:
    // the dropped edge, the version bump, and the update time.
    const blockerBefore = before.get(`${blockerId}.md`)!;
    const blockerAfter = after.get(`${blockerId}.md`)!;
    const version = Number(/^version: (\d+)$/m.exec(blockerBefore)![1]);
    const updatedAt = /^updated_at: .*$/m.exec(blockerAfter)![0];
    expect(blockerAfter).toBe(
      blockerBefore
        .replace(`  - type: blocks\n    target: ${doomedId}\n`, '')
        .replace(/^version: \d+$/m, `version: ${version + 1}`)
        .replace(/^updated_at: .*$/m, updatedAt),
    );
    expect(blockerAfter).toContain(`target: ${liveId}`);

    const reverified = doctorCheck(dir, ['doctor'], 'Dependencies');
    expect(reverified.check).toMatchObject({ status: 'ok' });
  });

  it('reports the store the repair decided from, not the pre-lock snapshot', async () => {
    // A writer that lands between doctor's snapshot and its lock is what the re-read
    // under the lock exists for, so the report has to follow the re-read: the checks
    // after the repair take both halves of that listing, the issues and the files that
    // did not parse. Otherwise doctor keeps an edge (correctly, its target file is
    // there) and then calls that same edge a missing orphan, and `Issue validity` says
    // nothing about the file that made it so.
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    const liveId = await internalId(dataSyncDir, 'Live target');
    await deleteIssue(dataSyncDir, doomedId);
    const livePath = join(issuesDir, `${liveId}.md`);
    const conflicted = (await readFile(livePath, 'utf-8')).replace(
      /^title: .*$/m,
      '<<<<<<< HEAD\ntitle: Ours\n=======\ntitle: Theirs\n>>>>>>> theirs',
    );

    // Hold the writer lock, so doctor loads its snapshot (both targets still readable)
    // and then blocks in the Dependencies repair until the file is conflicted. The
    // doctor promise is deliberately not awaited until the lock is released: doctor
    // cannot finish while this process holds it.
    let doctor: Promise<{ stdout: string; stderr: string; status: number }> | undefined;
    await withSharedDataSyncLock(dir, async () => {
      doctor = runTbdAsync(dir, ['doctor', '--fix', '--json']);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await writeFile(livePath, conflicted);
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    const report = parseDoctorReport(await doctor!);

    const dependencies = report.find((finding) => finding.name === 'Dependencies');
    const validity = report.find((finding) => finding.name === 'Issue validity');
    // The genuine orphan is repaired, and the edge into the newly conflicted file is
    // kept: that part was already right, it is the reporting that follows the re-read.
    expect(dependencies?.message).toContain('removed 1 orphaned reference(s)');
    expect(
      await readFile(join(issuesDir, `${await internalId(dataSyncDir, 'Blocker')}.md`), 'utf-8'),
    ).toContain(`target: ${liveId}`);
    expect(dependencies?.message).toContain('reference(s) into invalid issue file(s)');
    expect(dependencies?.details?.join('\n')).toContain('(target file present but invalid)');
    expect(dependencies?.fixable).not.toBe(true);
    expect(validity?.status).toBe('error');
    expect(validity?.details?.join('\n')).toContain(liveId);
  });

  it('keeps an edge whose target file is present but does not parse', async () => {
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    // The state an aborted merge leaves behind: the file exists and doctor reports it
    // under Issue validity, so it is a broken target, not a deleted one.
    const doomedPath = join(issuesDir, `${doomedId}.md`);
    const conflicted = (await readFile(doomedPath, 'utf-8')).replace(
      /^title: .*$/m,
      '<<<<<<< HEAD\ntitle: Ours\n=======\ntitle: Theirs\n>>>>>>> theirs',
    );
    await writeFile(doomedPath, conflicted);
    const before = await readIssueFiles(dataSyncDir);

    const diagnosed = doctorCheck(dir, ['doctor'], 'Dependencies');
    expect(diagnosed.check?.status).toBe('warn');
    expect(diagnosed.check?.fixable).not.toBe(true);
    expect(diagnosed.check?.details).toContain(
      `${display.get('Blocker')!} -> ${display.get('Doomed target')!} (target file present but invalid)`,
    );

    const fixed = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(fixed.check?.message ?? '').not.toContain('removed');
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);

    // The file is still reported as the broken file it is, by the check that owns it.
    const validity = doctorCheck(dir, ['doctor'], 'Issue validity');
    expect(validity.check?.status).toBe('error');
    expect(validity.check?.details?.join('\n')).toContain(doomedId);
  });

  it('reports every write failure and leaves the store repairable', async () => {
    if (isWindows) {
      // A read-only directory does not stop a rename on Windows.
      return;
    }
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    await deleteIssue(dataSyncDir, doomedId);
    const before = await readIssueFiles(dataSyncDir);
    await chmod(issuesDir, 0o555);

    const failed = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(failed.status).not.toBe(0);
    expect(failed.check?.status).toBe('error');
    expect(failed.check?.message).toContain('1 issue file(s) could not be written');
    expect(failed.check?.details?.join('\n')).toContain(display.get('Blocker')!);
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);

    await chmod(issuesDir, 0o755);
    const repaired = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(repaired.check).toMatchObject({
      status: 'ok',
      message: 'removed 1 orphaned reference(s)',
    });
  });

  it('does not rewrite an issue whose id is claimed by two files', async () => {
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    const blockerId = await internalId(dataSyncDir, 'Blocker');
    await deleteIssue(dataSyncDir, doomedId);
    await copyFile(join(issuesDir, `${blockerId}.md`), join(issuesDir, 'copy-of-blocker.md'));
    const before = await readIssueFiles(dataSyncDir);

    const fixed = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(fixed.check?.status).toBe('warn');
    expect(fixed.check?.message).toContain('removed 0 orphaned reference(s), kept');
    expect(fixed.check?.details?.join('\n')).toContain(
      `${display.get('Blocker')!} -> ${display.get('Doomed target')!}`,
    );
    // Neither file is rewritten while it is ambiguous which one owns the id.
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);
    expect(doctorCheck(dir, ['doctor'], 'Unique IDs').check?.status).toBe('error');

    await rm(join(issuesDir, 'copy-of-blocker.md'));
    const repaired = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(repaired.check).toMatchObject({
      status: 'ok',
      message: 'removed 1 orphaned reference(s)',
    });
  });

  it('repairs the orphan and still fails on a cycle reported with it', async () => {
    // The two checks meet in one finding: `--fix` owns the orphaned edge, a cycle
    // stays a manual decision, and the run must still exit nonzero because of it.
    createIssue(dir, 'Cycle A');
    createIssue(dir, 'Cycle B');
    const withCycles = displayIds(dir);
    const cycleA = withCycles.get('Cycle A')!;
    const cycleB = withCycles.get('Cycle B')!;
    expect(runTbd(dir, ['dep', 'add', cycleA, cycleB]).status).toBe(0);
    expect(runTbd(dir, ['dep', 'add', cycleB, cycleA]).status).toBe(0);
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    const blockerId = await internalId(dataSyncDir, 'Blocker');
    await deleteIssue(dataSyncDir, doomedId);

    const diagnosed = doctorCheck(dir, ['doctor'], 'Dependencies');
    expect(diagnosed.status).toBe(1);
    expect(diagnosed.check).toMatchObject({
      status: 'error',
      message: '1 directed cycle(s) and 1 orphaned reference(s)',
      fixable: true,
    });

    const fixed = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(fixed.status).toBe(1);
    expect(fixed.check?.status).toBe('error');
    expect(fixed.check?.message).toContain('1 directed cycle(s)');
    expect(fixed.check?.message).toContain('removed 1 orphaned reference(s)');
    expect(fixed.check?.details?.join('\n')).toContain('depends-on cycle:');

    // The orphan is gone for good; the cycle is still there, and still an error.
    const after = doctorCheck(dir, ['doctor'], 'Dependencies');
    expect(after.status).toBe(1);
    expect(after.check).toMatchObject({ status: 'error', message: '1 directed cycle(s)' });
    expect(after.check?.details?.join('\n')).not.toContain(doomedId);
    expect(await readFile(join(issuesDir, `${blockerId}.md`), 'utf-8')).not.toContain(doomedId);
  });

  it('does not claim a repair when the store is from a newer tbd', async () => {
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    await deleteIssue(dataSyncDir, doomedId);
    const before = await readIssueFiles(dataSyncDir);
    const configPath = join(dir, '.tbd', 'config.yml');
    const config = await readFile(configPath, 'utf-8');
    await writeFile(configPath, config.replace(/^tbd_format: .*$/m, 'tbd_format: f99'));

    // `tbd dep remove` refuses to touch this store; doctor must not be the exception.
    const fixed = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(fixed.check?.message ?? '').not.toContain('removed');
    expect(fixed.check?.fixable).toBe(true);
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);
    expect(doctorCheck(dir, ['doctor'], 'Config file').check?.status).toBe('error');
  });

  it('does not claim a repair while the shared worktree is corrupted', async () => {
    if (isWindows) {
      // `repairWorktree` removes and recreates the worktree directory, which races
      // open handles on Windows; the repair path itself is platform-neutral.
      return;
    }
    const worktree = join(dir, '.git', 'tbd', 'data-sync-worktree');
    const doomedId = await internalId(dataSyncDir, 'Doomed target');
    await deleteIssue(dataSyncDir, doomedId);
    // Commit the orphaned state on the sync branch so worktree repair, which restores
    // the worktree from that branch, cannot quietly resolve the orphan for us.
    await gitIn(worktree, 'add', '-A');
    await gitIn(worktree, 'commit', '-m', 'seed orphaned edge');
    const before = await readIssueFiles(dataSyncDir);
    await gitIn(worktree, 'checkout', '--detach');

    const attempted = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(attempted.check?.message ?? '').not.toContain('removed');
    expect(attempted.check?.fixable).toBe(true);
    expect(doctorCheck(dir, ['doctor'], 'Worktree').check?.status).toBe('ok');
    // Whatever the worktree repair did, it did not discard a repair doctor claimed.
    expect(await readIssueFiles(dataSyncDir)).toEqual(before);

    const repaired = doctorCheck(dir, ['doctor', '--fix'], 'Dependencies');
    expect(repaired.check).toMatchObject({
      status: 'ok',
      message: 'removed 1 orphaned reference(s)',
    });
  });
});
