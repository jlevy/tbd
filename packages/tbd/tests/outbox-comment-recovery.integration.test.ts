/**
 * Automatic outbox recovery through the real CLI and a local Git remote.
 */

import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { writeFile } from 'atomically';
import { describe, expect, it } from 'vitest';

import { listIssues, writeIssue } from '../src/file/storage.js';
import { workspaceExists } from '../src/file/workspace.js';
import type { Issue } from '../src/lib/types.js';
import { subprocessTestTimeout } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const cliPath = join(import.meta.dirname, '..', 'dist', 'bin.mjs');
const describeUnlessWindows = process.platform === 'win32' ? describe.skip : describe;

interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

function cleanGitEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_PREFIX;
  return env;
}

async function runFile(cwd: string, file: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(file, args, {
    cwd,
    env: cleanGitEnvironment(),
  });
  return stdout.trim();
}

async function runCli(cwd: string, args: string[]): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd,
      env: cleanGitEnvironment(),
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: failed.stdout ?? '', stderr: failed.stderr ?? '', code: failed.code ?? 1 };
  }
}

function withComments(
  issue: Issue,
  version: number,
  updatedAt: string,
  sideCommentLocalId: string,
): Issue {
  return {
    ...issue,
    version,
    updated_at: updatedAt,
    extensions: {
      ...(issue.extensions ?? {}),
      linear: {
        id: 'linear-comment-recovery',
        comments: [
          { id: 'comment-common', at: '2099-01-01T00:00:00.000Z', body: 'common' },
          { local_id: sideCommentLocalId, at: updatedAt, body: sideCommentLocalId },
        ],
      },
    },
  };
}

describeUnlessWindows('automatic outbox comment recovery', () => {
  it(
    'unions divergent comments, pushes the recovered issue, and only then clears the outbox',
    async () => {
      const testRoot = await mkdtemp(join(tmpdir(), 'tbd-outbox-comment-recovery-'));
      const remoteDir = join(testRoot, 'origin.git');
      const repoDir = join(testRoot, 'repo');

      try {
        await mkdir(repoDir, { recursive: true });
        await runFile(testRoot, 'git', ['init', '--bare', '-q', remoteDir]);
        await runFile(repoDir, 'git', ['init', '-q', '--initial-branch=main']);
        await runFile(repoDir, 'git', ['config', 'user.email', 'test@example.com']);
        await runFile(repoDir, 'git', ['config', 'user.name', 'Test User']);
        await runFile(repoDir, 'git', ['config', 'commit.gpgsign', 'false']);
        await writeFile(join(repoDir, 'README.md'), '# Test repository\n');
        await runFile(repoDir, 'git', ['add', 'README.md']);
        await runFile(repoDir, 'git', ['commit', '-q', '-m', 'Initial commit']);
        await runFile(repoDir, 'git', ['remote', 'add', 'origin', remoteDir]);
        await runFile(repoDir, 'git', ['push', '-q', '-u', 'origin', 'main']);

        expect((await runCli(repoDir, ['init', '--prefix=orc', '--force'])).code).toBe(0);
        expect((await runCli(repoDir, ['create', 'Coordinate agents'])).code).toBe(0);
        expect((await runCli(repoDir, ['sync', '--issues'])).code).toBe(0);

        const status = JSON.parse((await runCli(repoDir, ['status', '--json'])).stdout) as {
          worktree_path: string;
        };
        const dataSyncDir = join(status.worktree_path, '.tbd', 'data-sync');
        const [baseIssue] = await listIssues(dataSyncDir);
        expect(baseIssue).toBeDefined();

        const outboxDir = join(repoDir, '.tbd', 'workspaces', 'outbox');
        await mkdir(join(outboxDir, 'issues'), { recursive: true });
        await writeIssue(
          outboxDir,
          withComments(baseIssue!, 2, '2099-01-01T02:00:00.000Z', 'comment-outbox'),
        );
        await writeIssue(
          dataSyncDir,
          withComments(baseIssue!, 3, '2099-01-01T03:00:00.000Z', 'comment-worktree'),
        );

        const hookPath = join(remoteDir, 'hooks', 'pre-receive');
        await writeFile(
          hookPath,
          '#!/bin/sh\nmarker="$GIT_DIR/reject-after-one"\nif test -e "$marker"; then\n  exit 1\nfi\ntouch "$marker"\n',
        );
        await chmod(hookPath, 0o755);

        const interrupted = await runCli(repoDir, ['sync', '--issues']);

        expect(interrupted.code, interrupted.stderr).toBe(0);
        expect(interrupted.stdout + interrupted.stderr).toContain('Outbox preserved');
        const [recovered] = await listIssues(dataSyncDir);
        const linear = recovered?.extensions?.linear as {
          comments: { id?: string; local_id?: string }[];
        };
        expect(linear.comments.map((comment) => comment.id ?? comment.local_id)).toEqual([
          'comment-common',
          'comment-outbox',
          'comment-worktree',
        ]);
        expect(await workspaceExists(repoDir, 'outbox')).toBe(true);

        const issuePath = `.tbd/data-sync/issues/${baseIssue!.id}.md`;
        const beforeRetry = await runFile(remoteDir, 'git', [
          'show',
          `refs/heads/tbd-sync:${issuePath}`,
        ]);
        expect(beforeRetry).not.toContain('comment-outbox');
        expect(beforeRetry).toContain('comment-worktree');

        await rm(hookPath);
        const retry = await runCli(repoDir, ['sync', '--issues']);

        expect(retry.code, retry.stderr).toBe(0);
        expect(await workspaceExists(repoDir, 'outbox')).toBe(false);
        const afterRetry = await runFile(remoteDir, 'git', [
          'show',
          `refs/heads/tbd-sync:${issuePath}`,
        ]);
        expect(afterRetry).toContain('comment-outbox');
        expect(afterRetry).toContain('comment-worktree');
      } finally {
        await rm(testRoot, { recursive: true, force: true });
      }
    },
    subprocessTestTimeout(45_000),
  );
});
