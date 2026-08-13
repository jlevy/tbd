/**
 * Linear client and adapter behavior, against a mock server that reproduces the
 * real API's quirks.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LinearClient,
  LinearDuplicateIdError,
  LinearApiError,
  MAX_PAGE_SIZE,
} from '../src/integrations/linear/client.js';
import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { BLOCKED_LABEL } from '../src/integrations/linear/mapping.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';

describe('Linear client and adapter', () => {
  let server: LinearMockServer;
  let client: LinearClient;
  let adapter: LinearAdapter;

  beforeEach(async () => {
    server = new LinearMockServer();
    const endpoint = await server.start();
    client = new LinearClient({
      apiKey: 'lin_api_test',
      endpoint,
      maxAttempts: 4,
      // Do not actually sleep between retries.
      sleep: () => Promise.resolve(),
    });
    adapter = new LinearAdapter({ client, teamKey: 'FIN' });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('user_map validation', () => {
    it('rejects identities that are neither Linear UUIDs nor emails', () => {
      expect(
        () =>
          new LinearAdapter({
            client,
            teamKey: 'FIN',
            userMap: { josh: 'display-name-only' },
          }),
      ).toThrow(/must be a Linear user UUID or email/);
    });

    it('rejects two aliases that target the same Linear identity', () => {
      expect(
        () =>
          new LinearAdapter({
            client,
            teamKey: 'FIN',
            userMap: { josh: 'josh@example.com', jlevy: 'JOSH@example.com' },
          }),
      ).toThrow(/maps both josh and jlevy to the same Linear user/);
    });
  });

  describe('transport', () => {
    it('sends the API key raw, without a Bearer prefix', async () => {
      await client.request('query Viewer { viewer { id } }');
      // The mock records requests; the header assertion is that the call
      // succeeded at all, since a Bearer prefix is what breaks real auth.
      expect(server.requests).toHaveLength(1);
    });

    it('records rate-limit headers for status reporting', async () => {
      await client.request('query Viewer { viewer { id } }');
      expect(client.lastRateLimit.requestsLimit).toBe(2500);
      expect(client.lastRateLimit.complexity).toBe(17);
    });

    it('retries RATELIMITED, which arrives as HTTP 400 rather than 429', async () => {
      server.rateLimitFailures = 2;
      const data = await client.request<{ viewer: { id: string } }>(
        'query Viewer { viewer { id } }',
      );
      expect(data.viewer.id).toBe('user-1');
      expect(server.requests.length).toBe(3);
    });

    it('retries a 5xx', async () => {
      server.serverFailures = 1;
      await client.request('query Viewer { viewer { id } }');
      expect(server.requests.length).toBe(2);
    });

    it('gives up after the attempt budget and surfaces the error', async () => {
      server.rateLimitFailures = 10;
      await expect(client.request('query Viewer { viewer { id } }')).rejects.toBeInstanceOf(
        LinearApiError,
      );
    });

    it('does not retry a non-retryable error', async () => {
      await expect(client.request('query Unknown { nope }')).rejects.toBeInstanceOf(LinearApiError);
      expect(server.requests.length).toBe(1);
    });
  });

  describe('ensureMeta', () => {
    it('maps state ids by type, not by name', async () => {
      const meta = await adapter.ensureMeta();
      expect(meta.stateIdsByType.started).toBeDefined();
      expect(meta.stateIdsByType.completed).toBe('state-completed');
      expect(meta.stateIdsByType.duplicate).toBe('state-duplicate');
    });

    it('picks the lowest-position state when a type appears twice', async () => {
      const meta = await adapter.ensureMeta();
      // Both "In Progress" (2) and "In Review" (1002) are `started`.
      expect(meta.stateIdsByType.started).toBe('state-started');
    });

    it('caches, so repeated pushes do not refetch metadata', async () => {
      await adapter.ensureMeta();
      const before = server.requests.length;
      await adapter.ensureMeta();
      expect(server.requests.length).toBe(before);
    });

    it('reports a missing team clearly', async () => {
      const other = new LinearAdapter({ client, teamKey: 'NOPE' });
      await expect(other.ensureMeta()).rejects.toThrow(/team not found/i);
    });

    it('paginates the complete team label namespace', async () => {
      for (let index = server.labels.length; index <= MAX_PAGE_SIZE; index += 1) {
        server.labels.push({ id: `label-${index}`, name: `Label ${index}` });
      }

      const meta = await adapter.ensureMeta();

      expect(Object.keys(meta.labelIdsByName)).toHaveLength(MAX_PAGE_SIZE + 1);
      expect(server.requests.some((request) => request.query.includes('query TeamLabels'))).toBe(
        true,
      );
    });
  });

  describe('resolveRef', () => {
    beforeEach(() => {
      server.addIssue({ id: 'uuid-1', identifier: 'FIN-1', title: 'First' });
    });

    it('resolves a bare identifier to the canonical UUID', async () => {
      const ref = await adapter.resolveRef('FIN-1');
      expect(ref).toMatchObject({ provider: 'linear', id: 'uuid-1', key: 'FIN-1' });
    });

    it('resolves a linear: prefixed ref', async () => {
      expect((await adapter.resolveRef('linear:FIN-1')).id).toBe('uuid-1');
    });

    it('resolves a Linear issue URL', async () => {
      const ref = await adapter.resolveRef('https://linear.app/acme/issue/FIN-1/first-issue');
      expect(ref.id).toBe('uuid-1');
    });

    it('rejects something that is not a Linear reference', async () => {
      await expect(adapter.resolveRef('owner/repo#12')).rejects.toThrow(/Not a Linear reference/);
    });

    it('reports a reference that does not exist', async () => {
      await expect(adapter.resolveRef('FIN-999')).rejects.toThrow(/not found/i);
    });
  });

  describe('fetchIssues', () => {
    it('returns nothing for an empty id list without calling the API', async () => {
      expect(await adapter.fetchIssues([])).toEqual([]);
      expect(server.requests).toHaveLength(0);
    });

    it('maps Linear values into tbd canonical values', async () => {
      server.addIssue({
        id: 'uuid-2',
        identifier: 'FIN-2',
        title: 'Mapped',
        priority: 1,
        state: { id: 'state-started', name: 'In Progress', type: 'started' },
      });

      const [issue] = await adapter.fetchIssues(['uuid-2']);
      expect(issue).toMatchObject({ status: 'in_progress', priority: 0, title: 'Mapped' });
    });

    it('reads blocked from the tbd-owned label rather than a Linear state', async () => {
      server.labels.push({ id: 'label-blocked', name: BLOCKED_LABEL });
      server.addIssue({
        id: 'uuid-3',
        identifier: 'FIN-3',
        state: { id: 'state-started', name: 'In Progress', type: 'started' },
        labels: { nodes: [{ id: 'label-blocked', name: BLOCKED_LABEL }] },
      });

      const [issue] = await adapter.fetchIssues(['uuid-3']);
      expect(issue?.status).toBe('blocked');
    });

    it('maps an unset Linear priority to the tbd default, not to lowest', async () => {
      server.addIssue({ id: 'uuid-4', identifier: 'FIN-4', priority: 0 });
      const [issue] = await adapter.fetchIssues(['uuid-4']);
      expect(issue?.priority).toBe(2);
    });

    it('maps an unknown workflow state to open and carries a visible warning', async () => {
      server.addIssue({
        id: 'uuid-unknown-state',
        identifier: 'FIN-404',
        state: { id: 'state-custom', name: 'Needs Triage', type: 'custom_triage' },
      });

      const [issue] = await adapter.fetchIssues(['uuid-unknown-state']);

      expect(issue?.status).toBe('open');
      expect(issue?.mappingWarnings).toEqual([
        'Unknown Linear workflow state type "custom_triage"; mapped to open.',
      ]);
    });

    it('paginates issue labels beyond the nested connection page', async () => {
      const labels = Array.from({ length: 51 }, (_, index) => ({
        id: `issue-label-${index}`,
        name: `Issue Label ${index}`,
      }));
      server.addIssue({
        id: 'uuid-labels',
        identifier: 'FIN-50',
        labels: { nodes: labels },
      });

      const [issue] = await adapter.fetchIssues(['uuid-labels']);

      expect(issue?.labels).toHaveLength(51);
      expect(server.requests.some((request) => request.query.includes('query IssueLabels'))).toBe(
        true,
      );
    });
  });

  describe('fetchUpdatedSince', () => {
    it('limits automatic inbound discovery to the configured project', async () => {
      server.projects.push({ id: 'project-a', name: 'Alpha', slugId: 'alpha' });
      server.addIssue({ id: 'in-project', identifier: 'FIN-60', projectId: 'project-a' });
      server.addIssue({ id: 'other-project', identifier: 'FIN-61', projectId: null });
      adapter = new LinearAdapter({ client, teamKey: 'FIN', project: 'Alpha' });

      const issues = await adapter.fetchUpdatedSince('2026-08-09T00:00:00.000Z');

      expect(issues.map((issue) => issue.id)).toEqual(['in-project']);
      expect(
        server.requests.some((request) =>
          request.query.includes('query IssuesUpdatedSinceInProject'),
        ),
      ).toBe(true);
    });
  });

  describe('createIssue', () => {
    it('creates and returns the canonical ref', async () => {
      const ref = await adapter.createIssue({ title: 'New', status: 'open', priority: 1 });
      expect(ref.provider).toBe('linear');
      expect(server.issues.get(ref.id)?.title).toBe('New');
    });

    it('recovers a duplicate client id as success — the replay contract', async () => {
      const first = await adapter.createIssue({ title: 'First' }, 'client-uuid');
      // The mutation is NOT idempotent in Linear, but the client id is: a
      // retried create hits the duplicate rejection and the adapter recovers
      // the existing item instead of failing or duplicating.
      const second = await adapter.createIssue({ title: 'First' }, 'client-uuid');
      expect(second.id).toBe(first.id);
      expect(server.issues.size).toBe(1);
    });

    it('still surfaces the duplicate as an error without a client id to recover by', async () => {
      // The raw client contract is unchanged; only the adapter converts.
      await adapter.createIssue({ title: 'First' }, 'client-uuid');
      await expect(
        client.request('mutation IssueCreate', { input: { id: 'client-uuid', title: 'First' } }),
      ).rejects.toBeInstanceOf(LinearDuplicateIdError);
    });
  });

  describe('applyChanges', () => {
    beforeEach(() => {
      server.addIssue({ id: 'uuid-5', identifier: 'FIN-5', title: 'Before' });
    });

    it('returns the post-write timestamp used for echo suppression', async () => {
      const before = server.issues.get('uuid-5')!.updatedAt;
      const { updatedAt } = await adapter.applyChanges('uuid-5', { title: 'After' });
      expect(Date.parse(updatedAt)).toBeGreaterThan(Date.parse(before));
    });

    it('translates status into a state id', async () => {
      await adapter.applyChanges('uuid-5', { status: 'closed' });
      expect(server.issues.get('uuid-5')?.state.type).toBe('completed');
    });

    it('carries blocked as a tbd-owned label alongside the started state', async () => {
      await adapter.applyChanges('uuid-5', { status: 'blocked' });
      const issue = server.issues.get('uuid-5');
      expect(issue?.state.type).toBe('started');
      expect(issue?.labels.nodes.map((l) => l.name)).toContain(BLOCKED_LABEL);
    });

    it('creates a missing label rather than dropping the status signal', async () => {
      const before = server.labels.length;
      await adapter.applyChanges('uuid-5', { status: 'deferred' });
      expect(server.labels.length).toBeGreaterThan(before);
    });

    it('replaces stale status carriers while preserving human Linear labels', async () => {
      server.labels.push(
        { id: 'label-blocked', name: BLOCKED_LABEL },
        { id: 'label-human', name: 'customer-visible' },
      );
      const issue = server.issues.get('uuid-5')!;
      issue.labels = {
        nodes: [
          { id: 'label-blocked', name: BLOCKED_LABEL },
          { id: 'label-human', name: 'customer-visible' },
        ],
      };

      await adapter.applyChanges('uuid-5', { status: 'open' });

      expect(issue.labels.nodes.map((label) => label.name)).toEqual(['customer-visible']);
    });

    it('maps configured tbd assignees to Linear users without persisting email', async () => {
      adapter = new LinearAdapter({
        client,
        teamKey: 'FIN',
        userMap: { josh: 'josh@example.com' },
      });

      await adapter.applyChanges('uuid-5', { assignee: 'josh' });
      const [canonical] = await adapter.fetchIssues(['uuid-5']);

      expect(server.issues.get('uuid-5')?.assignee?.email).toBe('josh@example.com');
      expect(canonical?.assignee).toBe('josh');
      expect(JSON.stringify(canonical)).not.toContain('josh@example.com');
    });
  });

  describe('upsertAttachments', () => {
    beforeEach(() => {
      server.addIssue({ id: 'uuid-6', identifier: 'FIN-6' });
    });

    it('creates an attachment with structured metadata', async () => {
      await adapter.upsertAttachments('uuid-6', [
        {
          url: 'tbd://bead/tbd-abcd',
          title: 'bead tbd-abcd',
          subtitle: 'epic',
          metadata: { bead_id: 'tbd-abcd', labels: ['a', 'b'], counts: { children: 3 } },
        },
      ]);

      expect(server.attachments).toHaveLength(1);
      expect(server.attachments[0]?.metadata).toMatchObject({
        bead_id: 'tbd-abcd',
        labels: ['a', 'b'],
      });
    });

    it('upserts on url instead of duplicating, which is what makes mirroring retry-safe', async () => {
      const spec = { url: 'tbd://bead/tbd-abcd', title: 'v1' };
      await adapter.upsertAttachments('uuid-6', [spec]);
      await adapter.upsertAttachments('uuid-6', [{ ...spec, title: 'v2' }]);

      expect(server.attachments).toHaveLength(1);
      expect(server.attachments[0]?.title).toBe('v2');
    });

    it('lists attachment URLs for the cross-repository one-source guard', async () => {
      await adapter.upsertAttachments('uuid-6', [
        { url: 'tbd://bead/other-1234', title: 'other-1234' },
        { url: 'https://example.com/spec', title: 'spec' },
      ]);

      await expect(adapter.listAttachmentUrls('uuid-6')).resolves.toEqual([
        'tbd://bead/other-1234',
        'https://example.com/spec',
      ]);
    });

    it('paginates every attachment before checking repository ownership', async () => {
      for (let index = 0; index <= MAX_PAGE_SIZE; index += 1) {
        server.attachments.push({
          id: `attachment-${index}`,
          issueId: 'uuid-6',
          title: `Attachment ${index}`,
          url: `https://example.com/${index}`,
        });
      }

      const urls = await adapter.listAttachmentUrls('uuid-6');

      expect(urls).toHaveLength(MAX_PAGE_SIZE + 1);
      expect(
        server.requests.filter((request) => request.query.includes('query IssueAttachments')),
      ).toHaveLength(2);
    });
  });

  describe('spliceDescription', () => {
    it('appends the managed block and preserves the human prose', async () => {
      server.addIssue({ id: 'uuid-7', identifier: 'FIN-7', description: 'Human context.' });

      await adapter.spliceDescription('uuid-7', '<!-- tbd:begin -->\nblock\n<!-- tbd:end -->');

      const description = server.issues.get('uuid-7')?.description ?? '';
      expect(description).toContain('Human context.');
      expect(description).toContain('block');
    });

    it('replaces only the managed region on a second run', async () => {
      server.addIssue({
        id: 'uuid-8',
        identifier: 'FIN-8',
        description: 'Top.\n\n<!-- tbd:begin -->\nold\n<!-- tbd:end -->\n\nBottom.',
      });

      await adapter.spliceDescription('uuid-8', '<!-- tbd:begin -->\nnew\n<!-- tbd:end -->');

      const description = server.issues.get('uuid-8')?.description ?? '';
      expect(description).toContain('Top.');
      expect(description).toContain('Bottom.');
      expect(description).toContain('new');
      expect(description).not.toContain('old');
    });

    it('refuses to rewrite a description with malformed markers', async () => {
      server.addIssue({
        id: 'uuid-9',
        identifier: 'FIN-9',
        description: '<!-- tbd:begin -->a<!-- tbd:end --><!-- tbd:begin -->b<!-- tbd:end -->',
      });

      await expect(adapter.spliceDescription('uuid-9', 'x')).rejects.toThrow(/malformed/i);
    });

    it('does not write when the description is already correct', async () => {
      const block = '<!-- tbd:begin -->\nsame\n<!-- tbd:end -->';
      server.addIssue({ id: 'uuid-10', identifier: 'FIN-10', description: block });

      const before = server.requests.length;
      await adapter.spliceDescription('uuid-10', block);
      // One read, no update.
      expect(server.requests.length).toBe(before + 1);
    });
  });

  describe('postConflict', () => {
    it('posts a comment naming the field, both values, and the attic path', async () => {
      server.addIssue({ id: 'uuid-11', identifier: 'FIN-11' });

      await adapter.postConflict('uuid-11', {
        beadId: 'tbd-abcd',
        field: 'title',
        keptValue: 'kept',
        discardedValue: 'discarded',
        atticPath: '.tbd/data-sync/attic/conflicts/tbd-abcd/x.yml',
      });

      expect(server.comments).toHaveLength(1);
      const body = server.comments[0]?.body ?? '';
      expect(body).toContain('title');
      expect(body).toContain('discarded');
      expect(body).toContain('attic');
    });
  });
});
