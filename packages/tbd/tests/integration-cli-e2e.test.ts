/**
 * The integration commands end to end: the REAL built CLI binary, a real git
 * repository with a real sync worktree, and the mock provider over HTTP.
 *
 * This is the layer unit tests cannot see: argv parsing, config loading,
 * credential resolution from the environment, exit codes, and the
 * non-interactive refusal paths.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Every test here spawns the real CLI binary, and the failure paths wait out
// the client's retry backoff on purpose. The default 5s budget is for unit
// tests; these need room, especially under full-suite parallelism.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

import { LinearMockServer } from './helpers/linear-mock-server.js';
import { clearLink, readLink, writeLink } from '../src/integrations/core/link-store.js';
import { bridgeIntentsDir } from '../src/integrations/core/bridge-state.js';
import { listIntentFiles, writeIntentFile } from '../src/integrations/core/intents.js';
import { readIssue, writeIssue } from '../src/file/storage.js';

const execFileAsync = promisify(execFile);
const BIN = join(import.meta.dirname, '..', 'dist', 'bin.mjs');

interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

describe('tbd integration, end to end via the built binary', () => {
  let dir: string;
  let remoteDir: string;
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
    remoteDir = await mkdtemp(join(tmpdir(), 'tbd-cli-e2e-origin-'));
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

    // Everything from here goes through the CLI, exactly as a user would; the
    // CLI materializes its own sync worktree on first use.
    // Digits are valid in a forced prefix; every command must parse the same
    // display IDs that init emits.
    const init = await cli(['init', '--prefix=e2e', '--force']);
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
    await rm(remoteDir, { recursive: true, force: true });
  });

  it('status reaches the mock provider and reports the team', async () => {
    const result = await cli(['integration', 'status']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('reachable');
    expect(result.stdout).toContain('team FIN');
  });

  it('setup --dry-run reports the missing scaffolding without creating it', async () => {
    const before = server.labels.length;
    const result = await cli(['integration', 'setup', '--dry-run']);

    expect(result.code).toBe(0);
    // Same command, flag in the global leading position: both must be inert.
    const leading = await cli(['--dry-run', 'integration', 'setup']);
    expect(leading.code).toBe(0);
    expect(leading.stdout).toContain('would create');
    expect(result.stdout).toContain('label repo:');
    expect(result.stdout).toContain('would create');
    expect(result.stdout).toContain('Re-run without --dry-run to apply');
    // A dry run that writes is worse than no dry run at all.
    expect(server.labels.length).toBe(before);
  });

  it('setup creates both origin labels flat, and is idempotent', async () => {
    const first = await cli(['integration', 'setup']);
    expect(first.code).toBe(0);
    expect(first.stdout).toContain('created');

    // Both flat, and the marker is bare: a `repo` group with bare children would put
    // `repo/<name>` and the marker in conflict for any repo sharing the marker's name.
    expect(server.labels.find((l) => l.name === 'tbd' && !l.parent)).toBeDefined();
    expect(server.labels.find((l) => l.name.startsWith('repo:') && !l.parent)).toBeDefined();
    expect(server.labels.some((l) => l.isGroup)).toBe(false);
    // And never a flat label with a slash in its name.
    expect(server.labels.find((l) => l.name.includes('/'))).toBeUndefined();

    const countAfterFirst = server.labels.length;
    const second = await cli(['integration', 'setup']);

    expect(second.code).toBe(0);
    expect(second.stdout).toContain('Already provisioned');
    expect(server.labels.length).toBe(countAfterFirst);
  });

  it('rejects outbound selectors unless --push is present', async () => {
    const result = await cli(['--dry-run', 'integration', 'sync', '--limit', '1']);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('--limit is only valid with --push');
  });

  it('mirrors exactly a named bead, then full sync settles to nothing-to-do', async () => {
    const first = await cli(['create', 'An epic to mirror', '-t', 'epic']);
    const second = await cli(['create', 'A second epic outside the staged push', '-t', 'epic']);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const list = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      title: string;
    }[];
    const firstId = list.find((row) => row.title === 'An epic to mirror')!.id;

    const mirror = await cli(['integration', 'sync', '--push', '--bead', firstId]);
    expect(mirror.code).toBe(0);
    expect(mirror.stdout).toContain('created 1');
    expect(server.issues.size).toBe(1);

    // The configured policy picks up the second epic only when the ordinary
    // full synchronization runs; the explicit staged projection touched one.
    const sync = await cli(['integration', 'sync']);
    expect(sync.code).toBe(0);
    expect(server.issues.size).toBe(2);

    const settle = await cli(['integration', 'sync']);
    expect(settle.code).toBe(0);
    expect(settle.stdout).toContain('nothing to do');
  });

  it('--explain names the diverging field for a pair the sync would touch', async () => {
    // The answer to "why does this pair report work on every run?", which #265 could
    // only get by reading .tbd/data-sync/bridge/ by hand.
    expect((await cli(['create', 'Explain sentinel', '-t', 'epic'])).code).toBe(0);
    const rows = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      title: string;
    }[];
    const sentinel = rows.find((row) => row.title === 'Explain sentinel')!;
    expect((await cli(['integration', 'sync', '--push', '--bead', sentinel.id])).code).toBe(0);
    expect((await cli(['integration', 'sync'])).code).toBe(0);

    const remote = [...server.issues.values()].find((issue) => issue.title === 'Explain sentinel')!;
    remote.title = 'Retitled on the tracker';
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const explained = await cli(['--dry-run', 'integration', 'sync', '--explain']);

    expect(explained.code).toBe(0);
    expect(explained.stdout).toContain('title pull');
    expect(explained.stdout).toContain('rule: merge');
  });

  it('names the tracker surface on an ordinary tbd sync, without --verbose', async () => {
    // The silent failure behind #265. `tbd sync` documents itself as covering docs,
    // issues AND enabled trackers, but the tracker line went through `output.info`,
    // which prints only under --verbose. So a sync that reconciled the tracker and
    // wrote to it reported nothing about it, and an operator following the documented
    // session-closing protocol believed the mirror was reconciled when it was not.
    expect((await cli(['create', 'Tracker line sentinel', '-t', 'epic'])).code).toBe(0);

    const first = await cli(['sync']);
    expect(first.code).toBe(0);
    expect(first.stdout).toContain('Integrations (linear)');

    // And it keeps saying so once settled: "ran, nothing to do" and "did not run" are
    // different answers, and silence cannot tell them apart.
    const settled = await cli(['sync']);
    expect(settled.code).toBe(0);
    expect(settled.stdout).toContain('Integrations (linear): nothing to do');
  });

  it('keeps tbd sync --push away from the tracker entirely', async () => {
    // `--push` used to reach the outbound-only projection, writing local state over the
    // tracker without reconciling first — the operation `setup-linear` warns joiners
    // never to run. A natural-looking flag must not be the dangerous one, so `--push`
    // now narrows away from the tracker like any other surface flag and leaves both
    // sides untouched. The projection stays behind `tbd integration sync --push`.
    expect((await cli(['create', 'Push direction sentinel', '-t', 'epic'])).code).toBe(0);
    const rows = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      title: string;
    }[];
    const bead = rows.find((row) => row.title === 'Push direction sentinel')!;
    expect((await cli(['integration', 'sync', '--push', '--bead', bead.id])).code).toBe(0);
    expect((await cli(['integration', 'sync'])).code).toBe(0);
    const remote = [...server.issues.values()].find(
      (issue) => issue.title === 'Push direction sentinel',
    )!;
    remote.title = 'Remote edit must survive a --push';
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const pushed = await cli(['sync', '--push']);

    expect(pushed.code).toBe(0);
    const after = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      title: string;
    }[];
    // Nothing pulled: the local bead is unchanged.
    expect(after.find((row) => row.id === bead.id)?.title).toBe('Push direction sentinel');
    // And nothing projected: the tracker-side edit is still there, where the old
    // behavior would have silently overwritten it.
    expect(server.issues.get(remote.id)?.title).toBe('Remote edit must survive a --push');

    // Naming both the surface and the direction is still a deliberate request for the
    // projection, and still performs it.
    expect((await cli(['sync', '--push', '--integrations'])).code).toBe(0);
    expect(server.issues.get(remote.id)?.title).toBe('Push direction sentinel');
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

  it('imports exactly named external items with --pull --external and writes nothing outward', async () => {
    server.addIssue({
      id: 'external-selected',
      identifier: 'FIN-88',
      title: 'Selected inbound issue',
      updatedAt: new Date(Date.now() + 120_000).toISOString(),
    });
    const attachmentsBefore = server.attachments.length;
    const commentsBefore = server.comments.length;

    const result = await cli(['integration', 'sync', '--pull', '--external', 'FIN-88']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('import 1');
    expect((await cli(['list', '--json'])).stdout).toContain('Selected inbound issue');
    expect(server.attachments).toHaveLength(attachmentsBefore);
    expect(server.comments).toHaveLength(commentsBefore);
  });

  it('imports a Linear sub-issue under its linked bead parent with inherited spec and order', async () => {
    await mkdir(join(dir, 'docs'), { recursive: true });
    await writeFile(join(dir, 'docs', 'hierarchy.md'), '# Hierarchy\n');
    expect(
      (
        await cli([
          'create',
          'Linked hierarchy parent',
          '-t',
          'epic',
          '--spec',
          'docs/hierarchy.md',
        ])
      ).code,
    ).toBe(0);
    let rows = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      internalId: string;
      title: string;
      parentId?: string;
      spec_path?: string;
      child_order_hints?: string[];
    }[];
    const parent = rows.find((row) => row.title === 'Linked hierarchy parent')!;
    expect((await cli(['integration', 'sync', '--push', '--bead', parent.id, '--yes'])).code).toBe(
      0,
    );
    const remoteParent = [...server.issues.values()].find(
      (issue) => issue.title === 'Linked hierarchy parent',
    )!;
    server.addIssue({
      id: 'external-hierarchy-child',
      identifier: 'FIN-89',
      title: 'Imported hierarchy child',
      parent: { id: remoteParent.id, identifier: remoteParent.identifier },
      updatedAt: new Date(Date.now() + 180_000).toISOString(),
    });

    const imported = await cli(['integration', 'sync', '--pull', '--external', 'FIN-89', '--yes']);

    expect(imported.code).toBe(0);
    rows = JSON.parse((await cli(['list', '--json'])).stdout) as typeof rows;
    const child = rows.find((row) => row.title === 'Imported hierarchy child')!;
    const updatedParent = rows.find((row) => row.id === parent.id)!;
    expect(child.parentId).toBe(parent.id);
    expect(child.spec_path).toBe('docs/hierarchy.md');
    expect(updatedParent.child_order_hints).toContain(child.internalId);
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

  it('rejects an empty local comment before recording it', async () => {
    expect((await cli(['create', 'Empty comment sentinel'])).code).toBe(0);
    const list = await cli(['list', '--json']);
    const rows = JSON.parse(list.stdout) as { id: string; title: string }[];
    const bead = rows.find((row) => row.title === 'Empty comment sentinel');
    expect(bead).toBeDefined();

    const result = await cli(['integration', 'comment', bead!.id, '   ']);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('Comment text cannot be empty');
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

  it('doctor and sync fail pre-existing duplicate links closed with a clear remedy', async () => {
    const status = await cli(['status', '--json']);
    const worktreePath = (JSON.parse(status.stdout) as { worktree_path: string }).worktree_path;
    const dataSyncDir = join(worktreePath, '.tbd', 'data-sync');
    const list = await cli(['list', '--json']);
    const rows = JSON.parse(list.stdout) as { id: string; internalId: string; title: string }[];
    const linkedRow = rows.find((row) => row.title === 'Retitled in the tracker')!;
    const secondRow = rows.find((row) => row.title === 'Another bead')!;
    const linkedIssue = await readIssue(dataSyncDir, linkedRow.internalId);
    const secondIssue = await readIssue(dataSyncDir, secondRow.internalId);
    const externalLink = readLink(linkedIssue, 'linear')!;

    await writeIssue(dataSyncDir, writeLink(secondIssue, externalLink));
    try {
      const doctor = await cli(['doctor', '--json']);
      expect(doctor.code).not.toBe(0);
      expect(doctor.stdout).toContain('linked by multiple beads');
      expect(doctor.stdout).toContain(linkedRow.id);
      expect(doctor.stdout).toContain(secondRow.id);

      const before = server.issues.get(externalLink.id)?.title;
      const sync = await cli(['integration', 'sync']);
      expect(sync.code).not.toBe(0);
      expect(sync.stdout).toContain('integration unlink');
      expect(sync.stdout).toContain(linkedRow.id);
      expect(sync.stdout).toContain(secondRow.id);
      expect(server.issues.get(externalLink.id)?.title).toBe(before);
    } finally {
      await writeIssue(dataSyncDir, clearLink(secondIssue, 'linear'));
    }
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

  it('refuses a remote tbd claim unless link --force is explicit', async () => {
    server.addIssue({
      id: 'claimed-for-link',
      identifier: 'FIN-51',
      title: 'Claimed elsewhere',
      updatedAt: new Date().toISOString(),
    });
    server.attachments.push({
      id: 'foreign-claim',
      issueId: 'claimed-for-link',
      url: 'tbd://bead/other-9999',
      title: 'other-9999',
    });
    const created = await cli(['create', 'Local counterpart']);
    expect(created.code).toBe(0);
    const rows = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      title: string;
    }[];
    const beadId = rows.find((row) => row.title === 'Local counterpart')!.id;

    const refused = await cli(['integration', 'link', beadId, 'FIN-51', '--take', 'remote']);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('another tbd repository');

    const forced = await cli([
      'integration',
      'link',
      beadId,
      'FIN-51',
      '--take',
      'remote',
      '--force',
    ]);
    expect(forced.code).toBe(0);
    expect(
      server.attachments.some(
        (attachment) =>
          attachment.issueId === 'claimed-for-link' && attachment.url === `tbd://bead/${beadId}`,
      ),
    ).toBe(true);
  });

  it('replays a failed manual-link claim without losing or duplicating the link', async () => {
    server.addIssue({
      id: 'claim-retry-link',
      identifier: 'FIN-52',
      title: 'Manual claim retry',
      updatedAt: new Date().toISOString(),
    });
    expect((await cli(['create', 'Manual claim retry'])).code).toBe(0);
    const rows = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      internalId: string;
      title: string;
    }[];
    const bead = rows.find((row) => row.title === 'Manual claim retry')!;
    server.attachmentFailures = 1;

    const interrupted = await cli(['integration', 'link', bead.id, 'FIN-52']);
    expect(interrupted.code).not.toBe(0);
    expect(interrupted.stderr).toContain('attachment transport died');

    const status = JSON.parse((await cli(['status', '--json'])).stdout) as {
      worktree_path: string;
    };
    const dataSyncDir = join(status.worktree_path, '.tbd', 'data-sync');
    expect(readLink(await readIssue(dataSyncDir, bead.internalId), 'linear')?.id).toBe(
      'claim-retry-link',
    );
    expect(await listIntentFiles(dataSyncDir, 'linear')).toHaveLength(1);
    expect(
      server.attachments.filter((attachment) => attachment.issueId === 'claim-retry-link'),
    ).toHaveLength(0);

    const recovered = await cli(['integration', 'sync']);
    expect(recovered.code).toBe(0);
    expect(recovered.stdout).toContain('replayed 1');
    expect(await listIntentFiles(dataSyncDir, 'linear')).toHaveLength(0);
    expect(
      server.attachments.filter((attachment) => attachment.issueId === 'claim-retry-link'),
    ).toHaveLength(1);
  });

  it('unlink cancels pending writes, severs the pair, and sync leaves it alone', async () => {
    const rows = JSON.parse((await cli(['list', '--json'])).stdout) as {
      id: string;
      internalId: string;
      title: string;
    }[];
    const bead = rows.find((row) => row.title === 'Manual claim retry')!;
    const status = JSON.parse((await cli(['status', '--json'])).stdout) as {
      worktree_path: string;
    };
    const dataSyncDir = join(status.worktree_path, '.tbd', 'data-sync');
    const link = readLink(await readIssue(dataSyncDir, bead.internalId), 'linear')!;
    const remoteTitle = server.issues.get(link.id)?.title;
    await writeIntentFile(dataSyncDir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevunlink1',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'update_issue',
          bead_id: bead.internalId,
          external_id: link.id,
          patch: { title: 'must not land' },
        },
      ],
    });

    // A malformed second journal makes cancellation fail closed. The unlink
    // itself must remain retryable instead of clearing its only relationship
    // identity before the cancellation phase succeeds.
    const damagedIntent = join(bridgeIntentsDir(dataSyncDir, 'linear'), 'damaged.yml');
    await writeFile(damagedIntent, '[');
    const interrupted = await cli(['integration', 'unlink', bead.id]);
    expect(interrupted.code).not.toBe(0);
    expect(readLink(await readIssue(dataSyncDir, bead.internalId), 'linear')?.id).toBe(link.id);
    expect(server.issues.get(link.id)?.title).toBe(remoteTitle);
    await rm(damagedIntent);

    const unlink = await cli(['integration', 'unlink', bead.id]);
    expect(unlink.code).toBe(0);
    expect(await listIntentFiles(dataSyncDir, 'linear')).toEqual([]);

    const sync = await cli(['integration', 'sync']);
    expect(sync.code).toBe(0);
    expect(server.issues.get(link.id)?.title).toBe(remoteTitle);
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
    expect(result.code).not.toBe(0);
    // Docs and issues still did their work...
    expect(output).toMatch(/[Dd]ocs/);
    // ...and the tracker failure is named, not swallowed.
    expect(output.toLowerCase()).toContain('integration');
    // The bead itself survived: no data lost to the broken surface.
    const list = await cli(['list', '--json']);
    expect(list.stdout).toContain('Bead written while the tracker is broken');
  });

  it('fails closed when integration config cannot be parsed', async () => {
    const configPath = join(dir, '.tbd', 'config.yml');
    const config = await readFile(configPath, 'utf8');
    try {
      await writeFile(configPath, 'integrations: [unterminated\n');
      const result = await cli(['sync', '--integrations']);

      expect(result.code).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/parse|yaml|flow sequence/i);
    } finally {
      await writeFile(configPath, config);
    }
  });

  it('missing credential fails loudly with the remedy', async () => {
    const result = await cli(['integration', 'sync'], { LINEAR_API_KEY: '' });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('LINEAR_API_KEY');
  });
});
