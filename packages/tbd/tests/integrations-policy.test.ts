/**
 * Linking-policy resolution: presets, inline definitions, and the legacy
 * `select` fold.
 *
 * The property that matters most: resolution is total and Phase 1 configs
 * resolve to exactly the behavior they had before policies existed.
 */

import { describe, expect, it } from 'vitest';

import { presetPolicy, resolvePolicy } from '../src/integrations/core/policy.js';
import { LinearIntegrationSchema, PolicyDefinitionSchema, PolicyName } from '../src/lib/schemas.js';

describe('the default preset', () => {
  it('mirrors epics and active-spec beads, reports inbound, merges fields', () => {
    const policy = presetPolicy('default');

    expect(policy.outbound.kinds).toEqual(['epic']);
    expect(policy.outbound.specs).toBe('active');
    expect(policy.outbound.statuses).toEqual(['open', 'in_progress', 'blocked']);
    expect(policy.outbound.linked).toBe(true);

    expect(policy.inbound.mode).toBe('report');
    expect(policy.inbound.as_kind).toBe('task');

    expect(policy.field_sync.fields).toEqual({
      title: 'merge',
      description: 'merge',
      status: 'merge',
      priority: 'merge',
      labels: 'local',
      assignee: 'local',
    });
    expect(policy.field_sync.comments).toBe('two_way');
    expect(policy.field_sync.tie_break).toBe('newest');
  });
});

describe('resolvePolicy', () => {
  it('expands a preset name', () => {
    expect(resolvePolicy({ policy: 'default' })).toEqual(presetPolicy('default'));
  });

  it('uses an inline definition as given, with defaults filled', () => {
    const inline = PolicyDefinitionSchema.parse({
      inbound: { mode: 'auto', labels: ['agent-work'] },
      field_sync: { fields: { title: 'local' }, comments: 'off' },
    });

    const policy = resolvePolicy({ policy: inline });

    expect(policy.inbound.mode).toBe('auto');
    expect(policy.inbound.labels).toEqual(['agent-work']);
    expect(policy.field_sync.fields.title).toBe('local');
    // Unspecified fields still take their defaults.
    expect(policy.field_sync.fields.status).toBe('merge');
    expect(policy.field_sync.comments).toBe('off');
    expect(policy.outbound.kinds).toEqual(['epic']);
  });

  it('folds a legacy select into the outbound clause when policy is absent', () => {
    const policy = resolvePolicy({
      select: { kinds: [], statuses: ['open'], labels: ['pilot'], specs: 'any', linked: false },
    });

    // Phase 1 behavior preserved exactly: select IS the outbound clause.
    expect(policy.outbound.kinds).toEqual([]);
    expect(policy.outbound.statuses).toEqual(['open']);
    expect(policy.outbound.labels).toEqual(['pilot']);
    expect(policy.outbound.specs).toBe('any');
    expect(policy.outbound.linked).toBe(false);

    // Everything Phase 1 had no concept of takes defaults.
    expect(policy.inbound.mode).toBe('report');
    expect(policy.field_sync.tie_break).toBe('newest');
  });

  it('resolves a bare config to schema defaults (legacy select defaults)', () => {
    const policy = resolvePolicy({});

    // Note: NOT the default preset — the legacy fold keeps select's schema
    // default of specs: none, so an un-migrated config does not silently widen.
    expect(policy.outbound.specs).toBe('none');
    expect(policy.outbound.kinds).toEqual(['epic']);
  });

  it('an explicit preset widens specs where the legacy fold does not', () => {
    expect(resolvePolicy({}).outbound.specs).toBe('none');
    expect(resolvePolicy({ policy: 'default' }).outbound.specs).toBe('active');
  });
});

describe('config round-trip', () => {
  it('parses a provider config carrying a preset name', () => {
    const parsed = LinearIntegrationSchema.parse({
      enabled: true,
      team_key: 'TBD',
      policy: 'default',
    });
    expect(parsed.policy).toBe('default');
  });

  it('parses a provider config carrying an inline policy', () => {
    const parsed = LinearIntegrationSchema.parse({
      enabled: true,
      team_key: 'TBD',
      policy: { inbound: { mode: 'auto' } },
    });
    expect(resolvePolicy(parsed).inbound.mode).toBe('auto');
  });

  it('rejects an unknown preset name', () => {
    expect(PolicyName.safeParse('triage-only').success).toBe(false);
    const result = LinearIntegrationSchema.safeParse({
      enabled: true,
      team_key: 'TBD',
      policy: 'no-such-preset',
    });
    expect(result.success).toBe(false);
  });

  it('round-trips an inline policy through parse without loss', () => {
    const inline = {
      outbound: {
        kinds: ['epic', 'feature'],
        statuses: ['open'],
        labels: [],
        specs: 'any',
        linked: true,
      },
      inbound: { mode: 'report', labels: ['triage'], as_kind: 'bug' },
      field_sync: {
        fields: {
          title: 'local',
          description: 'local',
          status: 'remote',
          priority: 'merge',
          labels: 'local',
          assignee: 'local',
        },
        comments: 'inbound',
        tie_break: 'local',
      },
    };
    expect(PolicyDefinitionSchema.parse(inline)).toEqual(inline);
  });
});
