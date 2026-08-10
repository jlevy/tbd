/**
 * Per-namespace merge behavior for `extensions`.
 *
 * `extensions` previously merged as one opaque last-writer-wins value, so two
 * writers touching different namespaces silently lost one side. That matters
 * more now that external tracker links live in these namespaces: losing one
 * would orphan a mirrored issue and cause the next mirror to duplicate it.
 */

import { describe, expect, it } from 'vitest';

import { mergeIssues } from '../src/file/git.js';
import type { Issue } from '../src/lib/types.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id: 'is-01test',
    version: 1,
    title: 'Test',
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    ...overrides,
  } as Issue;
}

describe('extensions per-namespace merge', () => {
  it('keeps both namespaces when each side writes a different one', () => {
    const base = issue({ extensions: {} });
    const local = issue({
      version: 2,
      updated_at: '2026-08-10T01:00:00.000Z',
      extensions: { github: { prs: ['https://example.com/pull/1'] } },
    });
    const remote = issue({
      version: 2,
      updated_at: '2026-08-10T02:00:00.000Z',
      extensions: { linear: { team: 'FIN' } },
    });

    const { merged, conflicts } = mergeIssues(base, local, remote);

    expect(merged.extensions).toEqual({
      github: { prs: ['https://example.com/pull/1'] },
      linear: { team: 'FIN' },
    });
    expect(conflicts).toHaveLength(0);
  });

  it('reports a conflict only for the namespace both sides changed', () => {
    const base = issue({ extensions: { github: { prs: [] }, linear: { team: 'OLD' } } });
    const local = issue({
      version: 2,
      updated_at: '2026-08-10T02:00:00.000Z',
      extensions: { github: { prs: ['local'] }, linear: { team: 'LOCAL' } },
    });
    const remote = issue({
      version: 2,
      updated_at: '2026-08-10T01:00:00.000Z',
      extensions: { github: { prs: [] }, linear: { team: 'REMOTE' } },
    });

    const { merged, conflicts } = mergeIssues(base, local, remote);

    const extensions = merged.extensions!;
    // Only github changed on one side, so it merges silently.
    expect(extensions.github).toEqual({ prs: ['local'] });
    // linear changed on both; local is newer so it wins and remote is archived.
    expect(extensions.linear).toEqual({ team: 'LOCAL' });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.field).toBe('extensions.linear');
    expect(conflicts[0]?.lost_value).toEqual({ team: 'REMOTE' });
  });

  it('takes the changed side when the other is unchanged from base', () => {
    const base = issue({ extensions: { github: { prs: ['old'] } } });
    const local = issue({ version: 2, extensions: { github: { prs: ['old'] } } });
    const remote = issue({
      version: 2,
      updated_at: '2026-08-10T03:00:00.000Z',
      extensions: { github: { prs: ['new'] } },
    });

    const { merged, conflicts } = mergeIssues(base, local, remote);

    expect(merged.extensions).toEqual({ github: { prs: ['new'] } });
    expect(conflicts).toHaveLength(0);
  });
});
