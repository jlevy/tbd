/**
 * The integration commands end to end: the REAL built CLI binary, a real git
 * repository with a real sync worktree, and the mock provider over HTTP.
 *
 * This is the layer unit tests cannot see: argv parsing, config loading,
 * credential resolution from the environment, exit codes, and the
 * non-interactive refusal paths.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Every test here spawns the real CLI binary, and the failure paths wait out
// the client's retry backoff on purpose. The default 5s budget is for unit
// tests; these need room, especially under full-suite parallelism.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

import { LinearMockServer } from './helpers/linear-mock-server.js';

const execFileAsync = promisify(execFile);
const BIN = join(import.meta.dirname, '..', 'dist', 'bin.mjs');

interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

describe('tbd integration, end to end via the built binary', () => {
  let dir: string;
  let server: LinearMockServer;

  async function cli(args: string[], env: Record<string, string> = {}): Promise<CliResult> {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [BIN, ...args], {
        cwd: dir,
        env: {
          ...process.env,
          LINEAR_API_KEY: 'lin_api_test',
          LINEAR_API_URL: server.endpoint,
          ...env,
        },
      });
      return { stdout, stderr, code: 0 };
    } catch (error) {
      const failed = error as { stdout?: string; stderr?: string; code?: number };
      return { stdout: failed.stdout ?? '', stderr: failed.stderr ?? '', code: failed.code ?? 1 };
    }
  }

  beforeAll(async () => {
    server = new LinearMockServer();
    await server.start();

    dir = await mkdtemp(join(tmpdir(), 'tbd-cli-e2e-'));
    const sh = async (cmd: string, args: string[]): Promise<void> => {
      await execFileAsync(cmd, args, { cwd: dir });
    };
    await sh('git', ['init', '-q', '--initial-branch=main']);
    await sh('git', ['config', 'user.email', 't@e.com']);
    await sh('git', ['config', 'user.name', 'T']);
    await sh('git', ['config', 'commit.gpgsign', 'false']);
    await writeFile(join(dir, 'README.md'), '# t\n');
    await writeFile(join(dir, '.gitignore'), '.env\n');
    await sh('git', ['add', '-A']);
    await sh('git', ['commit', '-q', '-m', 'init']);

    // Everything from here goes through the CLI, exactly as a user would; the
    // CLI materializes its own sync worktree on first use.
    const init = await cli(['init', '--prefix=ee', '--force']);
    expect(init.code).toBe(0);

    // Enable the integration; the mock's team is FIN.
    const config = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(dir, '.tbd', 'config.yml'), 'utf8'),
    );
    await writeFile(
      join(dir, '.tbd', 'config.yml'),
      `${config}\nintegrations:\n  linear:\n    enabled: true\n    team_key: FIN\n    policy: default\n`,
    );
    await mkdir(join(dir, '.tbd'), { recursive: true });
  }, 60_000);

  afterAll(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('status reaches the mock provider and reports the team', async () => {
    const result = await cli(['integration', 'status']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('reachable');
    expect(result.stdout).toContain('team FIN');
  });

  it('mirrors an epic, then sync settles to nothing-to-do', async () => {
    const created = await cli(['create', 'An epic to mirror', '-t', 'epic']);
    expect(created.code).toBe(0);

    const mirror = await cli(['integration', 'sync', '--push']);
    expect(mirror.code).toBe(0);
    expect(mirror.stdout).toContain('created 1');
    expect(server.issues.size).toBe(1);

    const sync = await cli(['integration', 'sync']);
    expect(sync.code).toBe(0);

    const settle = await cli(['integration', 'sync']);
    expect(settle.code).toBe(0);
    expect(settle.stdout).toContain('nothing to do');
  });

  it('pulls a tracker-side edit into the bead through the full CLI path', async () => {
    const [issue] = [...server.issues.values()];
    issue!.title = 'Retitled in the tracker';
    issue!.updatedAt = new Date(Date.now() + 60_000).toISOString();
    const sync = await cli(['integration', 'sync']);
    expect(sync.code).toBe(0);
    expect(sync.stdout).toContain('pull 1');

    const list = await cli(['list', '--json']);
    expect(list.stdout).toContain('Retitled in the tracker');
  });

  it('authors a comment offline and posts it on the next sync', async () => {
    const list = await cli(['list', '--json']);
    const match = /"id":\s*"([^"]+)"/.exec(list.stdout);
    expect(match).not.toBeNull();

    const comment = await cli(['integration', 'comment', match![1]!, 'from the CLI']);
    expect(comment.code).toBe(0);
    expect(comment.stdout + comment.stderr).toContain('next');

    const sync = await cli(['integration', 'sync']);
    expect(sync.code).toBe(0);
    expect(server.comments.some((c) => c.body === 'from the CLI')).toBe(true);
  });

  it('refuses to link the same external item to a second bead', async () => {
    const second = await cli(['create', 'Another bead']);
    expect(second.code).toBe(0);
    const list = await cli(['list', '--json']);
    const ids = [...list.stdout.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]!);
    const [linked] = [...server.issues.values()];

    const link = await cli(['integration', 'link', ids.at(-1)!, linked!.identifier]);
    expect(link.code).not.toBe(0);
    expect(link.stderr).toContain('already linked');
  });

  it('refuses a differing link non-interactively without --take', async () => {
    server.addIssue({
      id: 'other-uuid',
      identifier: 'FIN-50',
      title: 'A very different title',
      updatedAt: new Date().toISOString(),
    });
    const list = await cli(['list', '--json']);
    const ids = [...list.stdout.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]!);

    const bare = await cli(['integration', 'link', ids.at(-1)!, 'FIN-50']);
    expect(bare.code).not.toBe(0);
    expect(bare.stderr).toContain('--take');

    const taken = await cli(['integration', 'link', ids.at(-1)!, 'FIN-50', '--take', 'remote']);
    expect(taken.code).toBe(0);

    const show = await cli(['list', '--json']);
    expect(show.stdout).toContain('A very different title');
  });

  it('unlink severs the pair and sync leaves it alone', async () => {
    const list = await cli(['list', '--json']);
    const ids = [...list.stdout.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]!);

    const unlink = await cli(['integration', 'unlink', ids.at(-1)!]);
    expect(unlink.code).toBe(0);

    const sync = await cli(['integration', 'sync']);
    expect(sync.code).toBe(0);
    // FIN-50 is unlinked and untouched; it shows up as importable instead.
    expect(sync.stdout).toContain('importable');
  });

  it('a broken tracker does not stop docs or issues from syncing', async () => {
    // The session-end guarantee: `tbd sync` covers every surface, each runs
    // independently, failures roll up, and nothing a working surface would
    // have saved is lost because another surface broke.
    const created = await cli(['create', 'Bead written while the tracker is broken']);
    expect(created.code).toBe(0);

    // Credential present but pointed at a dead endpoint: the tracker surface
    // fails at the network, the others must not care.
    const result = await cli(['sync'], { LINEAR_API_URL: 'http://127.0.0.1:9/graphql' });

    const output = result.stdout + result.stderr;
    // Docs and issues still did their work...
    expect(output).toMatch(/[Dd]ocs/);
    // ...and the tracker failure is named, not swallowed.
    expect(output.toLowerCase()).toContain('integration');
    // The bead itself survived: no data lost to the broken surface.
    const list = await cli(['list', '--json']);
    expect(list.stdout).toContain('Bead written while the tracker is broken');
  });

  it('missing credential fails loudly with the remedy', async () => {
    const result = await cli(['integration', 'sync'], { LINEAR_API_KEY: '' });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('LINEAR_API_KEY');
  });
});
