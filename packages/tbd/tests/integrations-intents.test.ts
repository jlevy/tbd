/**
 * Write-ahead intents: journal round-trip and crash replay.
 *
 * The property under test: a crash after the intent commit but before the base
 * advance converges on the next run, without duplicating anything — creates
 * recover through client-UUID rejection, comments through the provider's
 * comment-id dedup (verified live), updates and attachments through natural
 * idempotency.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bridgeIntentsDir } from '../src/integrations/core/bridge-state.js';
import {
  deleteIntentFile,
  discardIntentOps,
  listIntentFiles,
  replayIntents,
  writeIntentFile,
  type IntentFile,
} from '../src/integrations/core/intents.js';
import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient, MAX_PAGE_SIZE } from '../src/integrations/linear/client.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';

const RUN_ID = '01hx5zzkbkactav9wevgemmvrz';
const BEAD_ID = 'is-01hx5zzkbkactav9wevgemmvrz';
const CLIENT_UUID = '9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b';
const COMMENT_UUID = '41f2c3d4-0000-4000-8000-000000000001';

function intentFile(ops: IntentFile['ops']): IntentFile {
  return {
    type: 'in',
    run_id: RUN_ID,
    provider: 'linear',
    created_at: '2026-08-10T22:00:00.000Z',
    ops,
  };
}

describe('the intent journal', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-intents-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a file and is empty after deletion', async () => {
    const file = intentFile([
      { kind: 'update_issue', bead_id: BEAD_ID, external_id: 'x', patch: { title: 'T' } },
    ]);
    await writeIntentFile(dir, file);
    expect(await listIntentFiles(dir, 'linear')).toEqual([file]);

    await deleteIntentFile(dir, 'linear', RUN_ID);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('removes only matching operations and deletes journals left empty', async () => {
    const keep = {
      kind: 'update_issue' as const,
      bead_id: BEAD_ID,
      external_id: 'keep',
      patch: { title: 'Keep' },
    };
    await writeIntentFile(
      dir,
      intentFile([
        {
          kind: 'update_issue',
          bead_id: BEAD_ID,
          external_id: 'remove',
          patch: { title: 'Remove' },
        },
        keep,
      ]),
    );
    await writeIntentFile(dir, {
      ...intentFile([
        {
          kind: 'post_comment',
          external_id: 'remove',
          bead_id: 'bead',
          local_id: 'local',
          comment_client_id: COMMENT_UUID,
          body: 'pending',
        },
      ]),
      run_id: '01hx5zzkbkactav9wevgemother',
    });

    const removed = await discardIntentOps(
      dir,
      'linear',
      (op) => 'external_id' in op && op.external_id === 'remove',
    );

    expect(removed).toBe(2);
    expect(await listIntentFiles(dir, 'linear')).toEqual([intentFile([keep])]);
  });

  it('fails closed on damaged YAML rather than losing a write-ahead operation', async () => {
    await writeIntentFile(dir, intentFile([]));
    await writeFile(join(bridgeIntentsDir(dir, 'linear'), 'broken.yml'), '[');
    await expect(listIntentFiles(dir, 'linear')).rejects.toThrow('broken.yml');
  });

  it('fails closed on a schema-invalid intent rather than silently skipping it', async () => {
    await mkdir(bridgeIntentsDir(dir, 'linear'), { recursive: true });
    await writeFile(
      join(bridgeIntentsDir(dir, 'linear'), 'invalid.yml'),
      'type: in\nrun_id: lost-client-id\nprovider: linear\ncreated_at: now\nops:\n  - kind: create_issue\n',
    );
    await expect(listIntentFiles(dir, 'linear')).rejects.toThrow('invalid.yml');
  });
});

describe('crash replay against the mock provider', () => {
  let dir: string;
  let server: LinearMockServer;
  let adapter: LinearAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-intents-'));
    server = new LinearMockServer();
    const endpoint = await server.start();
    const client = new LinearClient({
      apiKey: 'lin_api_test',
      endpoint,
      maxAttempts: 4,
      sleep: () => Promise.resolve(),
    });
    adapter = new LinearAdapter({ client, teamKey: 'FIN' });
  });

  afterEach(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('replays a create that never happened, then deletes the journal', async () => {
    await writeIntentFile(
      dir,
      intentFile([
        {
          kind: 'create_issue',
          client_id: CLIENT_UUID,
          bead_id: 'is-01hx5zzkbkactav9wevgemmvrz',
          patch: { title: 'From replay' },
        },
      ]),
    );

    const report = await replayIntents(dir, 'linear', adapter);

    expect(report.failures).toEqual([]);
    expect(report.recoveredCreates).toEqual([
      { beadId: 'is-01hx5zzkbkactav9wevgemmvrz', externalId: CLIENT_UUID },
    ]);
    expect(server.issues.get(CLIENT_UUID)?.title).toBe('From replay');
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('converges when the crash happened AFTER the create reached the provider', async () => {
    // The item already exists under the client UUID: the pre-crash attempt
    // landed. Replay must recover it as success, not create a duplicate.
    server.addIssue({ id: CLIENT_UUID, identifier: 'FIN-9', title: 'Already there' });

    await writeIntentFile(
      dir,
      intentFile([
        {
          kind: 'create_issue',
          client_id: CLIENT_UUID,
          bead_id: 'is-01hx5zzkbkactav9wevgemmvrz',
          patch: { title: 'Already there' },
        },
      ]),
    );

    const report = await replayIntents(dir, 'linear', adapter);

    expect(report.failures).toEqual([]);
    expect(report.recoveredCreates[0]?.externalId).toBe(CLIENT_UUID);
    expect(server.issues.size).toBe(1); // no duplicate
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('replays a comment exactly once across two replays', async () => {
    server.addIssue({ id: 'issue-1', identifier: 'FIN-1' });
    const file = intentFile([
      {
        kind: 'post_comment',
        external_id: 'issue-1',
        bead_id: 'is-01hx5zzkbkactav9wevgemmvrz',
        local_id: '01hx5zzkbkactav9wevgemmvrz',
        comment_client_id: COMMENT_UUID,
        body: 'conflict report',
      },
    ]);

    await writeIntentFile(dir, file);
    await replayIntents(dir, 'linear', adapter);
    // Simulate the same journal replaying again from another machine.
    await writeIntentFile(dir, file);
    const second = await replayIntents(dir, 'linear', adapter);

    expect(second.failures).toEqual([]);
    expect(server.comments).toHaveLength(1); // deduped by the client UUID
    expect(server.comments[0]?.id).toBe(COMMENT_UUID);
  });

  it('discards a comment replay whose local claim is no longer live', async () => {
    server.addIssue({ id: 'issue-1', identifier: 'FIN-1' });
    const file = intentFile([
      {
        kind: 'post_comment',
        external_id: 'issue-1',
        bead_id: 'is-01hx5zzkbkactav9wevgemmvrz',
        local_id: '01hx5zzkbkactav9wevgemmvrz',
        comment_client_id: COMMENT_UUID,
        body: 'must not outlive unlink',
      },
    ]);
    await writeIntentFile(dir, file);

    const report = await replayIntents(dir, 'linear', adapter, {
      blockedExternalIds: new Set(),
      blockedBeadIds: new Set(),
      shouldReplay: () => false,
    });

    expect(report.failures).toEqual([]);
    expect(report.replayedOps).toBe(0);
    expect(server.comments).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('keeps a replayed comment intent until its local identity is recorded', async () => {
    server.addIssue({ id: 'issue-1', identifier: 'FIN-1' });
    const file = intentFile([
      {
        kind: 'post_comment',
        external_id: 'issue-1',
        bead_id: 'is-01hx5zzkbkactav9wevgemmvrz',
        local_id: '01hx5zzkbkactav9wevgemmvrz',
        comment_client_id: COMMENT_UUID,
        body: 'survives local recovery failure',
      },
    ]);
    await writeIntentFile(dir, file);

    await expect(
      replayIntents(dir, 'linear', adapter, undefined, () =>
        Promise.reject(new Error('local commit failed')),
      ),
    ).rejects.toThrow('local commit failed');
    expect(server.comments).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toEqual([file]);

    const recoveries: unknown[] = [];
    await replayIntents(dir, 'linear', adapter, undefined, (recovery) => {
      recoveries.push(recovery);
      return Promise.resolve();
    });
    expect(server.comments).toHaveLength(1);
    expect(recoveries).toEqual([
      expect.objectContaining({
        recoveredComments: [
          {
            beadId: 'is-01hx5zzkbkactav9wevgemmvrz',
            localId: '01hx5zzkbkactav9wevgemmvrz',
            commentId: COMMENT_UUID,
          },
        ],
      }),
    ]);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('keeps the journal when an op fails, and reports it', async () => {
    await writeIntentFile(
      dir,
      intentFile([
        // No such issue in the mock: the update fails.
        {
          kind: 'update_issue',
          bead_id: BEAD_ID,
          external_id: 'missing',
          patch: { title: 'T' },
        },
      ]),
    );

    const report = await replayIntents(dir, 'linear', adapter);

    expect(report.failures).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1); // kept for retry
  });

  it('replays attachments and updates idempotently', async () => {
    server.addIssue({ id: 'issue-1', identifier: 'FIN-1', title: 'Old' });
    const file = intentFile([
      {
        kind: 'update_issue',
        bead_id: BEAD_ID,
        external_id: 'issue-1',
        patch: { title: 'New' },
      },
      {
        kind: 'upsert_attachments',
        bead_id: BEAD_ID,
        external_id: 'issue-1',
        attachments: [{ url: 'tbd://bead/tbd-1', title: 'tbd-1 · task' }],
      },
    ]);

    await writeIntentFile(dir, file);
    await replayIntents(dir, 'linear', adapter);
    await writeIntentFile(dir, file);
    await replayIntents(dir, 'linear', adapter);

    expect(server.issues.get('issue-1')?.title).toBe('New');
    expect(server.attachments).toHaveLength(1); // upserted, not duplicated
  });

  it('discards unsafe duplicate-link operations while replaying unrelated work', async () => {
    server.addIssue({ id: 'duplicate-item', identifier: 'FIN-1', title: 'Unsafe old' });
    server.addIssue({ id: 'safe-item', identifier: 'FIN-2', title: 'Safe old' });
    await writeIntentFile(
      dir,
      intentFile([
        {
          kind: 'update_issue',
          bead_id: BEAD_ID,
          external_id: 'duplicate-item',
          patch: { title: 'Unsafe new' },
        },
        {
          kind: 'update_issue',
          bead_id: BEAD_ID,
          external_id: 'safe-item',
          patch: { title: 'Safe new' },
        },
      ]),
    );

    const report = await replayIntents(dir, 'linear', adapter, {
      blockedExternalIds: new Set(['duplicate-item']),
      blockedBeadIds: new Set(),
    });

    expect(server.issues.get('duplicate-item')?.title).toBe('Unsafe old');
    expect(server.issues.get('safe-item')?.title).toBe('Safe new');
    expect(report.replayedOps).toBe(1);
    expect(report.failures).toEqual([
      expect.objectContaining({ error: expect.stringContaining('duplicate link') }),
    ]);
    // The bead is durable and will re-plan after unlink. Retaining this stale
    // op would let an unknown former holder write after the repair.
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0);
  });
});

describe('adapter comment and delta surfaces', () => {
  let server: LinearMockServer;
  let adapter: LinearAdapter;

  beforeEach(async () => {
    server = new LinearMockServer();
    const endpoint = await server.start();
    const client = new LinearClient({
      apiKey: 'lin_api_test',
      endpoint,
      maxAttempts: 4,
      sleep: () => Promise.resolve(),
    });
    adapter = new LinearAdapter({ client, teamKey: 'FIN' });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('lists comments oldest first with display-name authors only', async () => {
    server.addIssue({ id: 'issue-1', identifier: 'FIN-1' });
    await adapter.createComment('issue-1', 'first');
    await adapter.createComment('issue-1', 'second');

    const comments = await adapter.listComments('issue-1');
    expect(comments.map((c) => c.body)).toEqual(['first', 'second']);
    expect(comments[0]?.author).toBe('Mock User');
    expect(Object.keys(comments[0]!).sort()).toEqual([
      'author',
      'body',
      'createdAt',
      'id',
      'resolvedAt',
    ]);
  });

  it('paginates through every comment on a Linear issue', async () => {
    server.addIssue({ id: 'issue-many-comments', identifier: 'FIN-250' });
    for (let index = 0; index <= MAX_PAGE_SIZE; index += 1) {
      server.comments.push({
        id: `comment-${index}`,
        issueId: 'issue-many-comments',
        body: `body-${index}`,
        createdAt: new Date(Date.UTC(2026, 7, 10, 0, 0, index)).toISOString(),
        resolvedAt: null,
        user: { name: 'Mock User', displayName: 'Mock User' },
      });
    }

    const comments = await adapter.listComments('issue-many-comments');

    expect(comments).toHaveLength(MAX_PAGE_SIZE + 1);
    expect(comments.at(0)?.body).toBe('body-0');
    expect(comments.at(-1)?.body).toBe(`body-${MAX_PAGE_SIZE}`);
    expect(
      server.requests.filter((request) => request.query.includes('query IssueComments')),
    ).toHaveLength(2);
  });

  it('resolves a comment', async () => {
    server.addIssue({ id: 'issue-1', identifier: 'FIN-1' });
    const { commentId } = await adapter.createComment('issue-1', 'to resolve');
    await adapter.resolveComment(commentId);
    expect(server.comments[0]?.resolvedAt).not.toBeNull();
  });

  it('fetches only items updated after the watermark', async () => {
    server.addIssue({
      id: 'old',
      identifier: 'FIN-1',
      updatedAt: '2026-08-10T10:00:00.000Z',
    });
    server.addIssue({
      id: 'new',
      identifier: 'FIN-2',
      updatedAt: '2026-08-10T20:00:00.000Z',
    });

    const since = await adapter.fetchUpdatedSince('2026-08-10T15:00:00.000Z');
    expect(since.map((issue) => issue.id)).toEqual(['new']);
  });

  it('carries archived and trashed through to the canonical view', async () => {
    server.addIssue({
      id: 'gone',
      identifier: 'FIN-3',
      archivedAt: '2026-08-10T12:00:00.000Z',
      trashed: true,
    });
    const [issue] = await adapter.fetchIssues(['gone']);
    expect(issue?.archivedAt).toBe('2026-08-10T12:00:00.000Z');
    expect(issue?.trashed).toBe(true);
  });
});
