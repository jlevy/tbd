/**
 * Project provisioning in `tbd integration setup`.
 *
 * `resolveProjectId` fails a sync outright when `target.project` names nothing,
 * so a setup that provisioned only labels walked the operator into a guaranteed
 * first-sync error: setup printed success, the very next `tbd integration sync`
 * died with `Linear project not found`. Found live while wiring the second
 * repository of a multi-repo team, where one project per repository is the
 * intended shape.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient } from '../src/integrations/linear/client.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';

describe('project provisioning', () => {
  let server: LinearMockServer;
  let adapter: LinearAdapter;

  beforeEach(async () => {
    server = new LinearMockServer();
    const endpoint = await server.start();
    adapter = new LinearAdapter({
      client: new LinearClient({ apiKey: 'k', endpoint, sleep: () => Promise.resolve() }),
      teamKey: 'FIN',
      project: 'metaproc',
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('reports a missing project on a dry run, creating nothing', async () => {
    const report = await adapter.provision({ originLabels: [], apply: false });

    expect(report.items).toContainEqual(
      expect.objectContaining({ kind: 'project', name: 'metaproc', state: 'missing' }),
    );
    expect(server.projects).toHaveLength(0);
  });

  it('creates the missing project on apply, and is idempotent', async () => {
    const first = await adapter.provision({ originLabels: [], apply: true });
    expect(first.items).toContainEqual(
      expect.objectContaining({ kind: 'project', name: 'metaproc', state: 'created' }),
    );
    expect(server.projects.map((p) => p.name)).toEqual(['metaproc']);

    // A fresh adapter, as a re-run of setup would construct: the project now
    // exists, so nothing is created and nothing is duplicated.
    const again = new LinearAdapter({
      client: new LinearClient({
        apiKey: 'k',
        endpoint: server.endpoint,
        sleep: () => Promise.resolve(),
      }),
      teamKey: 'FIN',
      project: 'metaproc',
    });
    const second = await again.provision({ originLabels: [], apply: true });
    expect(second.items).toContainEqual(
      expect.objectContaining({ kind: 'project', name: 'metaproc', state: 'present' }),
    );
    expect(server.projects).toHaveLength(1);
  });

  it('matches an existing project by name or slug, case-insensitively', async () => {
    server.projects.push({ id: 'project-9', name: 'Metaproc', slugId: 'abc123' });

    const report = await adapter.provision({ originLabels: [], apply: true });

    expect(report.items).toContainEqual(
      expect.objectContaining({ kind: 'project', name: 'metaproc', state: 'present' }),
    );
    expect(server.projects).toHaveLength(1);
  });

  it('reports nothing about projects when none is configured', async () => {
    const bare = new LinearAdapter({
      client: new LinearClient({
        apiKey: 'k',
        endpoint: server.endpoint,
        sleep: () => Promise.resolve(),
      }),
      teamKey: 'FIN',
    });

    const report = await bare.provision({ originLabels: [], apply: true });

    expect(report.items.filter((item) => item.kind === 'project')).toHaveLength(0);
  });

  it('a create straight after provisioning files into the project setup just made', async () => {
    // The failure this feature exists to prevent, end to end: before it, setup
    // printed success and the very next outbound write died with `Linear
    // project not found`. createIssue exercises resolveProjectId on the same
    // adapter, which must find the project — via the cached id, not a re-list.
    await adapter.provision({ originLabels: [], apply: true });
    const requestsAfterProvision = server.requests.length;

    const ref = await adapter.createIssue({
      title: 'First bead of the newly integrated repo',
      status: 'open',
      priority: 2,
    });

    const stored = server.issues.get(ref.id);
    expect(stored?.projectId).toBe(server.projects[0]!.id);
    // No `query Projects` after provisioning: the created id was cached.
    const later = server.requests.slice(requestsAfterProvision);
    expect(later.filter((request) => request.query.includes('query Projects'))).toHaveLength(0);
  });
});
