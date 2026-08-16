/**
 * Config-driven `max_nesting`, through the real CLI.
 *
 * The engine honored its `maxNesting` option and the mirror-only `--push` path
 * forwarded it, but the full synchronization never passed it — so the engine's
 * fallback default (2) silently overrode any configured value, and the two
 * modes disagreed about which beads even qualify. A unit test on the engine
 * cannot see that: the defect was one missing property at the call site, which
 * only a run through the CLI exercises. Found live on a repo set to 3 that kept
 * reporting `past max_nesting 2`.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LinearMockServer } from './helpers/linear-mock-server.js';

const execFileAsync = promisify(execFile);
const BIN = join(import.meta.dirname, '..', 'dist', 'bin.mjs');

describe('config-driven max_nesting via the CLI', () => {
  let dir: string;
  let remoteDir: string;
  let server: LinearMockServer;

  async function cli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [BIN, ...args], {
        cwd: dir,
        env: {
          ...process.env,
          LINEAR_API_KEY: 'lin_api_test',
          LINEAR_API_URL: server.endpoint,
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

    dir = await mkdtemp(join(tmpdir(), 'tbd-nesting-e2e-'));
    remoteDir = await mkdtemp(join(tmpdir(), 'tbd-nesting-e2e-origin-'));
    const sh = async (cmd: string, args: string[]): Promise<void> => {
      await execFileAsync(cmd, args, { cwd: dir });
    };
    await execFileAsync('git', ['init', '--bare', '-q', remoteDir]);
    await sh('git', ['init', '-q', '--initial-branch=main']);
    await sh('git', ['config', 'user.email', 't@e.com']);
    await sh('git', ['config', 'user.name', 'T']);
    await sh('git', ['config', 'commit.gpgsign', 'false']);
    await writeFile(join(dir, 'README.md'), '# t\n');
    await writeFile(join(dir, '.gitignore'), '.env\n');
    await sh('git', ['add', '-A']);
    await sh('git', ['commit', '-q', '-m', 'init']);
    await sh('git', ['remote', 'add', 'origin', remoteDir]);
    await sh('git', ['push', '-q', '-u', 'origin', 'main']);

    const init = await cli(['init', '--prefix=nst', '--force']);
    expect(init.code).toBe(0);

    // The grouped f08 form, exactly as a configured repo carries it. The value
    // under test: max_nesting 3, one past the engine's fallback default.
    const config = await readFile(join(dir, '.tbd', 'config.yml'), 'utf8');
    await writeFile(
      join(dir, '.tbd', 'config.yml'),
      `${config}
integrations:
  on_tbd_sync: 'off'
  linear:
    enabled: true
    target:
      team_key: FIN
    policy:
      outbound:
        kinds: [epic, task]
        statuses: [open]
        max_nesting: 3
`,
    );

    // A three-level chain: epic > task > task. Depth 3 is exactly what the
    // default would exclude and the configured value must include.
    const root = await cli(['create', 'Root epic', '-t', 'epic']);
    expect(root.code).toBe(0);
    const rootId = /Created (\S+):/.exec(root.stdout)![1]!;
    const mid = await cli(['create', 'Mid task', '-t', 'task', '--parent', rootId]);
    expect(mid.code).toBe(0);
    const midId = /Created (\S+):/.exec(mid.stdout)![1]!;
    const leaf = await cli(['create', 'Leaf task', '-t', 'task', '--parent', midId]);
    expect(leaf.code).toBe(0);
  }, 60_000);

  afterAll(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
    await rm(remoteDir, { recursive: true, force: true });
  });

  it('the full sync honors configured max_nesting instead of the engine default', async () => {
    const result = await cli(['integration', 'sync', '--dry-run']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('would create 3');
    expect(result.stdout).not.toContain('past max_nesting');
  });
});
