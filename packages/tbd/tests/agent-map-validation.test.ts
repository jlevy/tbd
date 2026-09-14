/**
 * A malformed `identity.agent_map` has to be reported by its config key.
 *
 * The map used to be dropped on the floor — `resolveProviderSettings` never forwarded it
 * — so any value was accepted and ignored. Once it reached the adapter, a placeholder
 * left in a repository started failing `tbd integration sync`, `integration setup` and
 * `integration link` after an upgrade, and `tbd sync` reported the tracker fold as
 * failed, with nothing in any of those messages naming the key at fault.
 *
 * Worse, the adapter is constructed only after a credential resolves, so on a machine
 * without `LINEAR_API_KEY` the credential error masked the config error entirely: the
 * user saw "not found" and never learned their config was invalid.
 *
 * So the check belongs where it needs neither credentials nor network — beside the
 * `target.team_key` check that already reports this way — and both `tbd doctor` and
 * `tbd integration status` surface it there.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
let repo: string;

/** Run the CLI, returning stdout+stderr whatever the exit code: doctor exits non-zero. */
function tbd(args: string[], env: Record<string, string> = {}): string {
  try {
    return execFileSync(process.execPath, [BIN, ...args], {
      cwd: repo,
      encoding: 'utf-8',
      env: { ...process.env, ...env, NO_COLOR: '1', HOME: repo },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
  }
}

async function setAgentMap(entries: string): Promise<void> {
  const path = join(repo, '.tbd', 'config.yml');
  const base = (await readFile(path, 'utf-8')).replace(/\nintegrations:[\s\S]*$/u, '\n');
  await writeFile(
    path,
    `${base}integrations:\n  linear:\n    enabled: true\n    target:\n      team_key: OS\n` +
      `    identity:\n      agent_map:\n${entries}`,
  );
}

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'tbd-agent-map-'));
  execFileSync('git', ['init', '-q', '.'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: repo });
  execFileSync(process.execPath, [BIN, 'init', '--prefix=agt'], { cwd: repo, stdio: 'ignore' });
}, 120_000);

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('a non-UUID app user id', () => {
  it('is reported by `tbd doctor` with the key, without a credential', async () => {
    await setAgentMap('        bot: not-a-uuid\n');

    // No LINEAR_API_KEY: the credential error must not be the only thing the user sees.
    const output = tbd(['doctor'], { LINEAR_API_KEY: '' });

    expect(output).toContain('integrations.linear.identity.agent_map.bot');
    expect(output).toContain('must be an app-user UUID');
  });

  it('is reported by `tbd integration status` the same way', async () => {
    await setAgentMap('        bot: not-a-uuid\n');

    const output = tbd(['integration', 'status'], { LINEAR_API_KEY: '' });

    expect(output).toContain('integrations.linear.identity.agent_map.bot');
  });

  it('names an empty agent name rather than the value', async () => {
    await setAgentMap('        "": 6f0d8f2a-0000-4000-8000-000000000001\n');

    const output = tbd(['doctor'], { LINEAR_API_KEY: '' });

    expect(output).toContain('integrations.linear.identity.agent_map contains an empty agent name');
  });
});

describe('a well-formed map', () => {
  it('raises nothing', async () => {
    await setAgentMap('        bot: 6f0d8f2a-0000-4000-8000-000000000001\n');

    const output = tbd(['doctor'], { LINEAR_API_KEY: '' });

    expect(output).not.toContain('agent_map');
  });
});
