/** Spawned-process acceptance coverage for the published `tbd web` command. */

import { execFile, spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL('..', import.meta.url));
const tbdBin = join(packageDir, 'dist', 'bin.mjs');
const cleanupPaths: string[] = [];
const children = new Set<ChildProcess>();
const supportsHandledProcessSignals = process.platform !== 'win32';

interface WebDescriptor {
  url: string;
  port: number;
  pid: number;
  repo: string;
  syncBranch: string;
}

interface WebFixture {
  root: string;
  remoteDir: string;
  repoDir: string;
}

interface SseState {
  updateCount: number;
  movedIds: string[];
  observationPhase: string;
}

interface SafetySnapshot {
  callerStatus: string;
  localSyncTip: string;
  remoteTrackingTip: string;
  fetchHead: string | null;
  hiddenWorktreeHead: string;
  hiddenWorktreeStatus: string;
  syncLockPresent: boolean;
  privateWatchRefs: string;
}

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoDir });
  return stdout.trim();
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function safetySnapshot(repoDir: string): Promise<SafetySnapshot> {
  const commonDir = await git(repoDir, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const hiddenWorktree = join(commonDir, 'tbd', 'data-sync-worktree');
  const fetchHeadPath = await git(
    repoDir,
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    'FETCH_HEAD',
  );
  return {
    callerStatus: await git(repoDir, 'status', '--porcelain=v1', '--untracked-files=all'),
    localSyncTip: await git(repoDir, 'rev-parse', 'refs/heads/tbd-sync'),
    remoteTrackingTip: await git(repoDir, 'rev-parse', 'refs/remotes/origin/tbd-sync'),
    fetchHead: await readOptional(fetchHeadPath),
    hiddenWorktreeHead: await git(hiddenWorktree, 'rev-parse', 'HEAD'),
    hiddenWorktreeStatus: await git(
      hiddenWorktree,
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ),
    syncLockPresent: await pathExists(join(commonDir, 'tbd', 'locks', 'data-sync.lock')),
    privateWatchRefs: await git(repoDir, 'for-each-ref', '--format=%(refname)', 'refs/tbd/watch/'),
  };
}

async function tbd(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(process.execPath, [tbdBin, ...args], {
    cwd: repoDir,
    env: { ...process.env, NO_COLOR: '1' },
  });
  return stdout;
}

async function createRepo(): Promise<WebFixture> {
  const root = await mkdtemp(join(tmpdir(), 'tbd-web-cli-'));
  cleanupPaths.push(root);
  const remoteDir = join(root, 'remote.git');
  const repoDir = join(root, 'repo');
  await mkdir(remoteDir);
  await mkdir(repoDir);
  await git(remoteDir, 'init', '--bare', '--initial-branch=main');
  await git(repoDir, 'init', '-b', 'main');
  await git(repoDir, 'config', 'user.email', 'test@example.com');
  await git(repoDir, 'config', 'user.name', 'Test User');
  await git(repoDir, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(repoDir, 'README.md'), '# Web acceptance\n');
  await git(repoDir, 'add', 'README.md');
  await git(repoDir, 'commit', '-m', 'main');
  await git(repoDir, 'remote', 'add', 'origin', remoteDir);
  await tbd(repoDir, '--json', 'init', '--prefix', 'web');
  await git(repoDir, 'add', '.tbd/config.yml');
  await git(repoDir, 'commit', '-m', 'configure tbd');
  await git(repoDir, 'push', '--set-upstream', 'origin', 'main');
  await tbd(
    repoDir,
    '--json',
    'create',
    'Browser acceptance',
    '--description',
    'Loaded only from the detail endpoint',
    '--label',
    'acceptance',
  );
  await tbd(repoDir, '--json', 'sync');
  return { root, remoteDir, repoDir: await realpath(repoDir) };
}

async function createWriter(fixture: WebFixture): Promise<string> {
  const writerDir = join(fixture.root, 'writer');
  await git(fixture.root, 'clone', fixture.remoteDir, writerDir);
  await git(writerDir, 'config', 'user.email', 'writer@example.com');
  await git(writerDir, 'config', 'user.name', 'Web Writer');
  await git(writerDir, 'config', 'commit.gpgsign', 'false');
  return realpath(writerDir);
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP server address');
  }
  const { port } = address;
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  return port;
}

function waitForDescriptor(child: ChildProcess): Promise<WebDescriptor> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      reject(
        new Error(`Timed out waiting for tbd web readiness\nstdout: ${stdout}\nstderr: ${stderr}`),
      );
    }, 15_000);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      try {
        const parsed = JSON.parse(stdout) as WebDescriptor;
        clearTimeout(timer);
        resolve(parsed);
      } catch {
        // JSON output is pretty-printed and may arrive across several chunks.
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(
        new Error(
          `tbd web exited before readiness (code ${String(code)}, signal ${String(signal)})\n` +
            `stdout: ${stdout}\nstderr: ${stderr}`,
        ),
      );
    });
  });
}

function waitForExit(
  child: ChildProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function waitForSseState(
  url: string,
  predicate: (state: SseState) => boolean,
  controller: AbortController,
): Promise<SseState> {
  const response = await fetch(`${url}/api/events`, { signal: controller.signal });
  if (!response.ok || response.body === null) {
    throw new Error(`Unable to open SSE stream: HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const timeout = setTimeout(() => {
    controller.abort();
  }, 20_000);
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        throw new Error('SSE stream ended before the expected state');
      }
      if (!(chunk.value instanceof Uint8Array)) {
        throw new Error('SSE stream returned a non-byte chunk');
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice('data: '.length))
          .join('\n');
        if (data !== '') {
          const state = JSON.parse(data) as SseState;
          if (predicate(state)) {
            return state;
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Timed out waiting for the expected SSE state', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }
  children.clear();
  await Promise.all(
    cleanupPaths
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

describe('tbd web CLI', () => {
  it('serves the packaged page and APIs with isolated, platform-safe lifecycle cleanup', async () => {
    const { repoDir } = await createRepo();
    const port = await availablePort();
    const safetyBefore = await safetySnapshot(repoDir);
    const child = spawn(process.execPath, [tbdBin, '--json', 'web', '--port', String(port)], {
      cwd: repoDir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    const descriptor = await waitForDescriptor(child);
    expect(descriptor).toMatchObject({
      url: `http://127.0.0.1:${port}`,
      port,
      pid: child.pid,
      repo: repoDir,
      syncBranch: 'tbd-sync',
    });

    const page = await fetch(descriptor.url);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    const html = await page.text();
    expect(html).toContain('new EventSource');
    expect(html).not.toContain('__TBD_WEB_');

    const board = await fetch(`${descriptor.url}/api/board?pretty=1`);
    expect(await board.json()).toMatchObject({
      rows: [{ title: 'Browser acceptance', labels: ['acceptance'] }],
    });
    expect(await safetySnapshot(repoDir)).toEqual(safetyBefore);

    const exited = waitForExit(child);
    expect(child.kill(supportsHandledProcessSignals ? 'SIGTERM' : 'SIGKILL')).toBe(true);
    const outcome = await exited;
    if (supportsHandledProcessSignals) {
      expect(outcome).toEqual({ code: 0, signal: null });
    }
    children.delete(child);
    await expect(fetch(descriptor.url)).rejects.toThrow();

    // On Windows child.kill() maps these names to forceful TerminateProcess rather
    // than delivering console control events. The handle-close unit test still runs
    // there; process-level SIGINT/SIGTERM contracts are asserted on POSIX runners.
    if (supportsHandledProcessSignals) {
      const interruptPort = await availablePort();
      const interruptedChild = spawn(
        process.execPath,
        [tbdBin, '--json', 'web', '--port', String(interruptPort)],
        {
          cwd: repoDir,
          env: { ...process.env, NO_COLOR: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      children.add(interruptedChild);
      await waitForDescriptor(interruptedChild);
      const interrupted = waitForExit(interruptedChild);
      expect(interruptedChild.kill('SIGINT')).toBe(true);
      await expect(interrupted).resolves.toEqual({ code: 130, signal: null });
      children.delete(interruptedChild);
      expect(await safetySnapshot(repoDir)).toEqual(safetyBefore);
    }
  }, 40_000);

  it('leaves remote state alone until explicit tbd sync, then publishes the local result', async () => {
    const fixture = await createRepo();
    const writerDir = await createWriter(fixture);
    const port = await availablePort();
    const child = spawn(process.execPath, [tbdBin, '--json', 'web', '--port', String(port)], {
      cwd: fixture.repoDir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    const descriptor = await waitForDescriptor(child);
    const initialBoard = (await (await fetch(`${descriptor.url}/api/board`)).json()) as {
      rows: { id: string; title: string }[];
    };
    const issue = initialBoard.rows.find((row) => row.title === 'Browser acceptance');
    expect(issue).toBeDefined();

    const safetyBeforeRemoteChange = await safetySnapshot(fixture.repoDir);
    await tbd(writerDir, '--json', 'update', issue!.id, '--notes', 'explicit sync applied');
    await tbd(writerDir, '--json', 'sync');

    // The viewer is not a second sync client. A remote commit alone cannot mutate any
    // local ref, FETCH_HEAD, hidden-worktree file, or rendered bead.
    await new Promise((resolve) => setTimeout(resolve, 1_250));
    expect(await safetySnapshot(fixture.repoDir)).toEqual(safetyBeforeRemoteChange);
    const beforeSync = await fetch(`${descriptor.url}/api/bead?id=${issue!.id}`);
    expect(await beforeSync.json()).toMatchObject({ notes: null });

    const sseController = new AbortController();
    const update = waitForSseState(
      descriptor.url,
      (state) => state.updateCount > 0 && state.movedIds.includes(issue!.id),
      sseController,
    );
    await tbd(fixture.repoDir, '--json', 'sync');
    const updateState = await update;
    sseController.abort();
    expect(updateState.observationPhase).toBe('watching');

    const body = await fetch(`${descriptor.url}/api/bead?id=${issue!.id}`);
    expect(await body.json()).toMatchObject({ notes: 'explicit sync applied' });

    const exited = waitForExit(child);
    expect(child.kill(supportsHandledProcessSignals ? 'SIGTERM' : 'SIGKILL')).toBe(true);
    const outcome = await exited;
    if (supportsHandledProcessSignals) {
      expect(outcome).toEqual({ code: 0, signal: null });
    }
    children.delete(child);
  }, 45_000);

  it('never publishes a partial snapshot while the shared writer lock is held', async () => {
    const fixture = await createRepo();
    const port = await availablePort();
    const child = spawn(process.execPath, [tbdBin, '--json', 'web', '--port', String(port)], {
      cwd: fixture.repoDir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    const descriptor = await waitForDescriptor(child);
    const initialBoard = (await (await fetch(`${descriptor.url}/api/board`)).json()) as {
      rows: { id: string; internalId: string; title: string }[];
    };
    const issue = initialBoard.rows.find((row) => row.title === 'Browser acceptance');
    expect(issue).toBeDefined();

    const commonDir = await git(
      fixture.repoDir,
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    );
    const lockPath = join(commonDir, 'tbd', 'locks', 'data-sync.lock');
    const issuePath = join(
      commonDir,
      'tbd',
      'data-sync-worktree',
      '.tbd',
      'data-sync',
      'issues',
      `${issue!.internalId}.md`,
    );
    await mkdir(lockPath);
    const original = await readFile(issuePath, 'utf8');
    const changed = original
      .replace(/^title: .*$/mu, 'title: Locked transaction')
      .replace(/^version: 1$/mu, 'version: 2');
    expect(changed).not.toBe(original);

    const sseController = new AbortController();
    const update = waitForSseState(
      descriptor.url,
      (state) => state.updateCount > 0 && state.movedIds.includes(issue!.id),
      sseController,
    );
    await writeFile(issuePath, changed);
    await new Promise((resolve) => setTimeout(resolve, 1_250));

    const whileLocked = await fetch(`${descriptor.url}/api/bead?id=${issue!.id}`);
    expect(await whileLocked.json()).toMatchObject({ title: 'Browser acceptance', version: 1 });

    await rm(lockPath, { recursive: true });
    const updateState = await update;
    sseController.abort();
    expect(updateState.observationPhase).toBe('watching');
    const afterRelease = await fetch(`${descriptor.url}/api/bead?id=${issue!.id}`);
    expect(await afterRelease.json()).toMatchObject({ title: 'Locked transaction', version: 2 });

    const exited = waitForExit(child);
    expect(child.kill(supportsHandledProcessSignals ? 'SIGTERM' : 'SIGKILL')).toBe(true);
    await exited;
    children.delete(child);
  }, 45_000);

  it('reports deterministic dry-run metadata without binding a port', async () => {
    const { repoDir } = await createRepo();
    const port = await availablePort();
    const output = await tbd(repoDir, '--json', '--dry-run', 'web', '--port', String(port));
    expect(JSON.parse(output)).toMatchObject({
      url: `http://127.0.0.1:${port}`,
      port,
      repo: repoDir,
      syncBranch: 'tbd-sync',
    });
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    const occupied = spawnSync(process.execPath, [tbdBin, 'web', '--port', String(port)], {
      cwd: repoDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    expect(occupied.status).toBe(1);
    expect(occupied.stderr).toContain(`Port ${port} is already in use`);
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

    const invalid = spawnSync(process.execPath, [tbdBin, 'web', '--interval', '10'], {
      cwd: repoDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("unknown option '--interval'");
  }, 30_000);
});
