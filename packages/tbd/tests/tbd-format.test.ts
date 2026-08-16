/**
 * Tests for tbd-format.ts - format versioning and migration infrastructure.
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENT_FORMAT,
  INITIAL_FORMAT,
  FORMAT_HISTORY,
  detectFormat,
  needsMigration,
  migrateToLatest,
  isCompatibleFormat,
  describeMigration,
  formatUpgradeMessage,
  isFormatCompatibleWithSupported,
  supportedFormatForVersion,
  type RawConfig,
} from '../src/lib/tbd-format.js';

describe('tbd-format', () => {
  describe('constants', () => {
    it('has current format', () => {
      expect(CURRENT_FORMAT).toBe('f08');
    });

    it('has initial format', () => {
      expect(INITIAL_FORMAT).toBe('f01');
    });

    it('has format history', () => {
      expect(FORMAT_HISTORY.f01).toBeDefined();
      expect(FORMAT_HISTORY.f02).toBeDefined();
      expect(FORMAT_HISTORY.f03).toBeDefined();
      expect(FORMAT_HISTORY.f04).toBeDefined();
      expect(FORMAT_HISTORY.f05).toBeDefined();
      expect(FORMAT_HISTORY.f06).toBeDefined();
      expect(FORMAT_HISTORY.f07).toBeDefined();
      expect(FORMAT_HISTORY.f08).toBeDefined();
    });
  });

  describe('detectFormat', () => {
    it('returns INITIAL_FORMAT when no tbd_format field', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
      };
      expect(detectFormat(config)).toBe('f01');
    });

    it('returns the tbd_format value when present', () => {
      const config: RawConfig = {
        tbd_format: 'f02',
        tbd_version: '0.2.0',
      };
      expect(detectFormat(config)).toBe('f02');
    });

    it('returns CURRENT_FORMAT for unknown format', () => {
      const config: RawConfig = {
        tbd_format: 'f99',
        tbd_version: '9.0.0',
      };
      expect(detectFormat(config)).toBe(CURRENT_FORMAT);
    });
  });

  describe('needsMigration', () => {
    it('returns true when format is f01', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
      };
      expect(needsMigration(config)).toBe(true);
    });

    it('returns true when format is f06 (one behind current)', () => {
      const config: RawConfig = {
        tbd_format: 'f06',
        tbd_version: '0.3.0',
      };
      expect(needsMigration(config)).toBe(true);
    });

    it('returns false when format is current', () => {
      const config: RawConfig = {
        tbd_format: CURRENT_FORMAT,
        tbd_version: '0.2.0',
      };
      expect(needsMigration(config)).toBe(false);
    });
  });

  describe('migrateToLatest', () => {
    it('migrates f01 to the current format through all format steps', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
        display: { id_prefix: 'test' },
        sync: { branch: 'tbd-sync', remote: 'origin' },
        settings: { auto_sync: false },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f01');
      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe(CURRENT_FORMAT);
      expect(result.config.sync?.storage).toBe('git-common-dir-v1');
      expect(result.config.settings?.doc_auto_sync_hours).toBe(24);
      expect(result.changes).toContain('Added tbd_format: f02');
      expect(result.changes).toContain('Added settings.doc_auto_sync_hours: 24');
      expect(result.changes).toContain('Updated tbd_format: f03');
      expect(result.changes).toContain('Updated tbd_format: f04');
      expect(result.changes).toContain('Added sync.storage: git-common-dir-v1');
      expect(result.changes).toContain('Updated tbd_format: f05');
      expect(result.changes).toContain('Updated tbd_format: f06');
      expect(result.changes).toContain('Updated tbd_format: f07');
      // f06 seeds the upgrade history from the existing tbd_version (no timestamp).
      expect(result.config.tbd_upgrades).toEqual([{ version: '0.1.0' }]);
    });

    it('migrates f02 to the current format (multi-revision jump, guards against a dropped rung)', () => {
      const config: RawConfig = {
        tbd_format: 'f02',
        tbd_version: '0.1.5',
        display: { id_prefix: 'test' },
        settings: { auto_sync: false, doc_auto_sync_hours: 12 },
        doc_cache: { 'shortcuts/test.md': 'internal:shortcuts/test.md' },
        docs: { paths: ['.tbd/docs/custom', '.tbd/docs/standard'] },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f02');
      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe(CURRENT_FORMAT);
      expect(result.config.sync?.storage).toBe('git-common-dir-v1');
      // doc_cache moved to docs_cache.files
      expect(result.config.doc_cache).toBeUndefined();
      expect(result.config.docs_cache?.files).toEqual({
        'shortcuts/test.md': 'internal:shortcuts/test.md',
      });
      // docs.paths moved to docs_cache.lookup_path
      expect(result.config.docs).toBeUndefined();
      expect(result.config.docs_cache?.lookup_path).toEqual([
        '.tbd/docs/custom',
        '.tbd/docs/standard',
      ]);
      // History seeded from the install-time stamp, even across a multi-format jump.
      expect(result.config.tbd_upgrades).toEqual([{ version: '0.1.5' }]);
    });

    it('does not modify already current config', () => {
      const config: RawConfig = {
        tbd_format: CURRENT_FORMAT,
        tbd_version: '0.3.0',
        tbd_upgrades: [{ version: '0.3.0', at: '2026-06-12T09:10:00.000Z' }],
        sync: { branch: 'tbd-sync', remote: 'origin', storage: 'git-common-dir-v1' },
        display: { id_prefix: 'test' },
        settings: { auto_sync: false, doc_auto_sync_hours: 12 },
        docs_cache: {
          files: { 'shortcuts/test.md': 'internal:shortcuts/test.md' },
          lookup_path: ['.tbd/docs/shortcuts/system'],
        },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe(CURRENT_FORMAT);
      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.changed).toBe(false);
      expect(result.changes).toHaveLength(0);
      expect(result.config.settings?.doc_auto_sync_hours).toBe(12);
      expect(result.config.sync?.storage).toBe('git-common-dir-v1');
    });

    it('migrates f03 through f04 (sync storage marker) to the current format', () => {
      const config: RawConfig = {
        tbd_format: 'f03',
        tbd_version: '0.1.6',
        display: { id_prefix: 'test' },
        sync: { branch: 'custom-sync', remote: 'upstream' },
        settings: { auto_sync: false, doc_auto_sync_hours: 12 },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f03');
      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe(CURRENT_FORMAT);
      expect(result.config.sync).toEqual({
        branch: 'custom-sync',
        remote: 'upstream',
        storage: 'git-common-dir-v1',
      });
    });

    it('migrates f05 to f06, seeding the upgrade history from tbd_version', () => {
      const config: RawConfig = {
        tbd_format: 'f05',
        tbd_version: '0.2.3',
        display: { id_prefix: 'test' },
        sync: { branch: 'tbd-sync', remote: 'origin', storage: 'git-common-dir-v1' },
        settings: { auto_sync: false, doc_auto_sync_hours: 24 },
        docs_cache: {
          files: { 'guidelines/x.md': 'internal:guidelines/x.md' },
          lookup_path: ['.tbd/docs/shortcuts/system'],
        },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f05');
      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.changed).toBe(true);
      expect(result.changes).toEqual([
        'Updated tbd_format: f06',
        'Seeded tbd_upgrades history from tbd_version',
        'Updated tbd_format: f07',
        'Updated tbd_format: f08',
      ]);
      // Only the format stamps and the seeded history change; everything else is
      // verbatim. f08 is a pure stamp here because there is no integrations block to
      // regroup.
      expect(result.config).toEqual({
        ...config,
        tbd_format: CURRENT_FORMAT,
        tbd_upgrades: [{ version: '0.2.3' }],
      });
    });

    it('seeds an empty history when migrating a config that has no tbd_version', () => {
      const config: RawConfig = {
        tbd_format: 'f05',
        display: { id_prefix: 'test' },
      };

      const result = migrateToLatest(config);

      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.config.tbd_upgrades).toEqual([]);
    });

    it('does not re-seed an existing tbd_upgrades history', () => {
      const config: RawConfig = {
        tbd_format: 'f05',
        tbd_version: '0.3.0',
        tbd_upgrades: [{ version: '0.2.0' }, { version: '0.3.0', at: '2026-06-12T00:00:00.000Z' }],
        display: { id_prefix: 'test' },
      };

      const result = migrateToLatest(config);

      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.config.tbd_upgrades).toEqual([
        { version: '0.2.0' },
        { version: '0.3.0', at: '2026-06-12T00:00:00.000Z' },
      ]);
      expect(result.changes).toEqual([
        'Updated tbd_format: f06',
        'Updated tbd_format: f07',
        'Updated tbd_format: f08',
      ]);
    });

    it('migrates f06 to f07 as a stamp, then f08 regroups the integrations block', () => {
      const config: RawConfig = {
        tbd_format: 'f06',
        tbd_version: '0.5.0',
        tbd_upgrades: [{ version: '0.5.0', at: '2026-08-11T01:21:24.535Z' }],
        display: { id_prefix: 'test' },
        sync: { branch: 'tbd-sync', remote: 'origin', storage: 'git-common-dir-v1' },
        settings: { auto_sync: false, doc_auto_sync_hours: 24 },
        integrations: { linear: { enabled: true, team_key: 'FIN' } },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f06');
      expect(result.toFormat).toBe(CURRENT_FORMAT);
      expect(result.changes).toEqual([
        'Updated tbd_format: f07',
        'Moved linear.team_key into linear.target',
        'Updated tbd_format: f08',
      ]);
      // f07 is a pure stamp; f08 moves team_key into the target group and nothing else.
      expect(result.config).toEqual({
        ...config,
        tbd_format: 'f08',
        integrations: { linear: { enabled: true, target: { team_key: 'FIN' } } },
      });
    });

    it('is idempotent: re-migrating a current-format config changes nothing', () => {
      const once = migrateToLatest({
        tbd_format: 'f06',
        tbd_version: '0.5.0',
        display: { id_prefix: 'test' },
      });
      const twice = migrateToLatest(once.config);

      expect(twice.changed).toBe(false);
      expect(twice.changes).toHaveLength(0);
      expect(twice.config).toEqual(once.config);
    });

    it('preserves existing settings when migrating', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
        display: { id_prefix: 'myapp' },
        sync: { branch: 'custom-sync', remote: 'upstream' },
        settings: { auto_sync: true },
      };

      const result = migrateToLatest(config);

      expect(result.config.display?.id_prefix).toBe('myapp');
      expect(result.config.sync?.branch).toBe('custom-sync');
      expect(result.config.sync?.remote).toBe('upstream');
      expect(result.config.settings?.auto_sync).toBe(true);
    });
  });

  describe('isCompatibleFormat', () => {
    it('returns true for f01', () => {
      expect(isCompatibleFormat('f01')).toBe(true);
    });

    it('returns true for f02', () => {
      expect(isCompatibleFormat('f02')).toBe(true);
    });

    it('returns true for f03', () => {
      expect(isCompatibleFormat('f03')).toBe(true);
    });

    it('returns true for f04', () => {
      expect(isCompatibleFormat('f04')).toBe(true);
    });

    it('returns true for f05', () => {
      expect(isCompatibleFormat('f05')).toBe(true);
    });

    it('returns true for f06', () => {
      expect(isCompatibleFormat('f06')).toBe(true);
    });

    it('returns true for f07', () => {
      expect(isCompatibleFormat('f07')).toBe(true);
    });

    it('returns false for unknown future format', () => {
      expect(isCompatibleFormat('f99')).toBe(false);
    });
  });

  describe('isFormatCompatibleWithSupported', () => {
    it('models old f03 clients rejecting f04 repositories', () => {
      expect(isFormatCompatibleWithSupported('f04', 'f03')).toBe(false);
    });

    it('models old f04 clients rejecting f05 repositories (the forkable-docs gate)', () => {
      expect(isFormatCompatibleWithSupported('f05', 'f04')).toBe(false);
    });

    it('models old f05 clients rejecting f06 repositories (the upgrade-history gate)', () => {
      expect(isFormatCompatibleWithSupported('f06', 'f05')).toBe(false);
    });

    it('models pre-0.6.0 clients rejecting f07 repositories (the integrations-config gate)', () => {
      // The whole point of f07: a client that parses config in strip mode must fail
      // closed rather than silently dropping the integrations block on its next write.
      expect(isFormatCompatibleWithSupported('f07', 'f06')).toBe(false);
    });

    it('allows old clients to read older formats they know how to migrate', () => {
      expect(isFormatCompatibleWithSupported('f01', 'f03')).toBe(true);
      expect(isFormatCompatibleWithSupported('f03', 'f03')).toBe(true);
      expect(isFormatCompatibleWithSupported('f04', 'f05')).toBe(true);
      expect(isFormatCompatibleWithSupported('f05', 'f06')).toBe(true);
    });
  });

  describe('formatUpgradeMessage', () => {
    it('clearly tells users when a repository needs a newer tbd', () => {
      expect(formatUpgradeMessage('Config', 'f04', 'f03')).toBe(
        'This repository requires a newer version of tbd.\n' +
          "Config format 'f04' is from a newer tbd version.\n" +
          "This tbd version supports up to format 'f03'.\n" +
          'Upgrade tbd: npm install -g get-tbd@latest',
      );
    });
  });

  describe('describeMigration', () => {
    it('describes f01 migration (seven steps)', () => {
      const descriptions = describeMigration('f01');
      expect(descriptions).toHaveLength(7);
      expect(descriptions[0]).toContain('f01 → f02');
      expect(descriptions[1]).toContain('f02 → f03');
      expect(descriptions[2]).toContain('f03 → f04');
      expect(descriptions[3]).toContain('f04 → f05');
      expect(descriptions[4]).toContain('f05 → f06');
      expect(descriptions[5]).toContain('f06 → f07');
      expect(descriptions[6]).toContain('f07 → f08');
    });

    it('describes f02 migration', () => {
      const descriptions = describeMigration('f02');
      expect(descriptions).toHaveLength(6);
      expect(descriptions[0]).toContain('f02 → f03');
      expect(descriptions[1]).toContain('f03 → f04');
      expect(descriptions[2]).toContain('f04 → f05');
      expect(descriptions[3]).toContain('f05 → f06');
      expect(descriptions[4]).toContain('f06 → f07');
      expect(descriptions[5]).toContain('f07 → f08');
    });

    it('describes f06 migration (two steps)', () => {
      const descriptions = describeMigration('f06');
      expect(descriptions).toHaveLength(2);
      expect(descriptions[0]).toContain('f06 → f07');
      expect(descriptions[1]).toContain('f07 → f08');
    });

    it('returns empty for current format', () => {
      const descriptions = describeMigration(CURRENT_FORMAT);
      expect(descriptions).toHaveLength(0);
    });
  });

  describe('f07 → f08 integration config regroup', () => {
    function f07WithLinear(linear: Record<string, unknown>): RawConfig {
      return {
        tbd_format: 'f07',
        tbd_version: '0.6.5',
        display: { id_prefix: 'test' },
        integrations: { sync_on_tbd_sync: true, linear },
      };
    }

    function linearAfter(config: RawConfig): Record<string, unknown> {
      const linear = config.integrations?.linear;
      if (linear === undefined) {
        throw new Error('expected an integrations.linear block after migration');
      }
      return linear as Record<string, unknown>;
    }

    it('groups the flat provider keys by concern', () => {
      const result = migrateToLatest(
        f07WithLinear({
          enabled: true,
          team_key: 'TBD',
          project: 'tbd',
          mirror_labels: false,
          create_labels: true,
          user_map: { alice: 'alice@example.com' },
        }),
      );

      expect(linearAfter(result.config)).toEqual({
        enabled: true,
        target: { team_key: 'TBD', project: 'tbd' },
        labels: { mirror: 'none', create: 'all' },
        identity: { user_map: { alice: 'alice@example.com' } },
      });
    });

    it('folds the legacy select alias into policy.outbound, then lands max_nesting beside it', () => {
      // Order matters here and got this wrong once: handling max_nesting before the
      // select fold left it stranded at the top level next to a policy that had just
      // been created for it.
      const result = migrateToLatest(
        f07WithLinear({
          enabled: true,
          select: { kinds: ['epic'], specs: 'active' },
          max_nesting: 3,
        }),
      );

      expect(linearAfter(result.config)).toEqual({
        enabled: true,
        policy: { outbound: { kinds: ['epic'], specs: 'active', max_nesting: 3 } },
      });
    });

    it('leaves max_nesting alone under a named policy preset', () => {
      // Folding it into `policy: default` would silently redefine that preset for this
      // repository, which is a different thing than moving a local setting.
      const result = migrateToLatest(
        f07WithLinear({ enabled: true, policy: 'default', max_nesting: 4 }),
      );

      expect(linearAfter(result.config)).toEqual({
        enabled: true,
        policy: 'default',
        max_nesting: 4,
      });
    });

    it('translates the boolean label keys into their enum modes, not just moves them', () => {
      // Both keys became enums in f08. Copying the boolean across would produce a config
      // that no longer parses — the migration would report success and leave the
      // repository broken, which is worse than refusing to run.
      const result = migrateToLatest(
        f07WithLinear({ enabled: true, mirror_labels: true, create_labels: false }),
      );

      expect(linearAfter(result.config).labels).toEqual({ mirror: 'prefixed', create: 'none' });
    });

    it('maps the other boolean pairing the same way', () => {
      const result = migrateToLatest(
        f07WithLinear({ enabled: true, mirror_labels: false, create_labels: true }),
      );

      expect(linearAfter(result.config).labels).toEqual({ mirror: 'none', create: 'all' });
    });

    it('leaves an already-migrated enum value alone', () => {
      const result = migrateToLatest(
        f07WithLinear({ enabled: true, labels: { mirror: 'verbatim', create: 'tbd' } }),
      );

      expect(linearAfter(result.config).labels).toEqual({ mirror: 'verbatim', create: 'tbd' });
    });

    it('carries through a provider key this version does not know', () => {
      const result = migrateToLatest(
        f07WithLinear({ enabled: true, team_key: 'TBD', a_newer_tbds_key: 'survives' }),
      );

      expect(linearAfter(result.config).a_newer_tbds_key).toBe('survives');
    });

    it('leaves the fold gate at the integrations level, not swept into a provider group', () => {
      // `f07WithLinear` sets the boolean gate, which f08 translates in place. The point
      // of this test is where it lands, not what it is called: a scalar sibling of the
      // provider blocks must not be pulled into one of the new groups.
      const result = migrateToLatest(f07WithLinear({ enabled: true, team_key: 'TBD' }));

      expect(result.config.integrations!.on_tbd_sync).toBe('auto');
      expect(linearAfter(result.config).on_tbd_sync).toBeUndefined();
    });

    it('is a pure stamp when there is no integrations block', () => {
      const result = migrateToLatest({
        tbd_format: 'f07',
        tbd_version: '0.6.5',
        display: { id_prefix: 'test' },
      });

      expect(result.changes).toEqual(['Updated tbd_format: f08']);
    });

    it('is idempotent: regrouping an already-grouped block moves nothing', () => {
      const once = migrateToLatest(
        f07WithLinear({ enabled: true, team_key: 'TBD', max_nesting: 2, user_map: {} }),
      );
      const twice = migrateToLatest(once.config);

      expect(twice.changed).toBe(false);
      expect(twice.config).toEqual(once.config);
    });

    it('does not overwrite a group the config already carries', () => {
      // A hand-written config that already uses the new shape must win over the flat
      // key, rather than being clobbered by a stale sibling.
      const result = migrateToLatest(
        f07WithLinear({ enabled: true, team_key: 'OLD', target: { team_key: 'NEW' } }),
      );

      expect(linearAfter(result.config).target).toEqual({ team_key: 'NEW' });
    });
  });

  describe('supportedFormatForVersion', () => {
    it('maps a published version to the newest format it can read', () => {
      expect(supportedFormatForVersion('0.6.0')).toBe('f07');
      expect(supportedFormatForVersion('0.6.5')).toBe('f07');
      expect(supportedFormatForVersion('0.7.0')).toBe('f08');
    });

    it('treats a prerelease build as its base version', () => {
      expect(supportedFormatForVersion('0.7.0-dev.4.abc1234')).toBe('f08');
    });

    it('returns undefined for an unparseable version rather than guessing', () => {
      expect(supportedFormatForVersion('latest')).toBeUndefined();
      expect(supportedFormatForVersion('')).toBeUndefined();
    });

    it('catches the stale launcher pin an upgrade leaves behind', () => {
      // The real hazard: a format bump does not refresh tbd_fallback_version, so the
      // launcher would install a CLI that refuses the repository it was meant to serve.
      const pinned = supportedFormatForVersion('0.6.3');
      expect(pinned).toBe('f07');
      expect(isFormatCompatibleWithSupported('f08', pinned!)).toBe(false);
    });
  });
});

describe('f07 → f08 sync fold gate', () => {
  function f07WithGate(integrations: Record<string, unknown>): RawConfig {
    return {
      tbd_format: 'f07',
      tbd_version: '0.6.5',
      display: { id_prefix: 'test' },
      integrations,
    };
  }

  it('translates the boolean gate into a fold mode, not just renames the key', () => {
    // Carrying `false` verbatim into an enum field would write a config the next
    // release cannot parse — the same trap the label keys hit.
    const result = migrateToLatest(
      f07WithGate({ sync_on_tbd_sync: false, linear: { enabled: true } }),
    );
    const integrations = result.config.integrations!;
    expect(integrations.on_tbd_sync).toBe('off');
    expect(integrations.sync_on_tbd_sync).toBeUndefined();
  });

  it('maps the enabled gate to auto, preserving the affirmed bulk thresholds', () => {
    const result = migrateToLatest(
      f07WithGate({ sync_on_tbd_sync: true, linear: { enabled: true } }),
    );
    const integrations = result.config.integrations!;
    expect(integrations.on_tbd_sync).toBe('auto');
    expect(integrations.sync_on_tbd_sync).toBeUndefined();
  });

  it('leaves an already-migrated fold mode alone', () => {
    const result = migrateToLatest(
      f07WithGate({ on_tbd_sync: 'report', linear: { enabled: true } }),
    );
    const integrations = result.config.integrations!;
    expect(integrations.on_tbd_sync).toBe('report');
  });

  it('still regroups provider blocks alongside the gate translation', () => {
    // The gate translation mutates the same object the provider loop walks, so this
    // pins that regrouping still happens rather than being skipped by the rewrite.
    const result = migrateToLatest(
      f07WithGate({ sync_on_tbd_sync: true, linear: { enabled: true, team_key: 'TBD' } }),
    );
    const integrations = result.config.integrations!;
    const linear = integrations.linear as Record<string, unknown>;
    expect(linear.target).toEqual({ team_key: 'TBD' });
    expect(integrations.on_tbd_sync).toBe('auto');
  });
});
