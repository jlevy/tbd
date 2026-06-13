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
  type RawConfig,
} from '../src/lib/tbd-format.js';

describe('tbd-format', () => {
  describe('constants', () => {
    it('has current format', () => {
      expect(CURRENT_FORMAT).toBe('f06');
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

    it('returns true when format is f05 (one behind current)', () => {
      const config: RawConfig = {
        tbd_format: 'f05',
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
    it('migrates f01 to f06 through all format steps', () => {
      const config: RawConfig = {
        tbd_version: '0.1.0',
        display: { id_prefix: 'test' },
        sync: { branch: 'tbd-sync', remote: 'origin' },
        settings: { auto_sync: false },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f01');
      expect(result.toFormat).toBe('f06');
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe('f06');
      expect(result.config.sync?.storage).toBe('git-common-dir-v1');
      expect(result.config.settings?.doc_auto_sync_hours).toBe(24);
      expect(result.changes).toContain('Added tbd_format: f02');
      expect(result.changes).toContain('Added settings.doc_auto_sync_hours: 24');
      expect(result.changes).toContain('Updated tbd_format: f03');
      expect(result.changes).toContain('Updated tbd_format: f04');
      expect(result.changes).toContain('Added sync.storage: git-common-dir-v1');
      expect(result.changes).toContain('Updated tbd_format: f05');
      expect(result.changes).toContain('Updated tbd_format: f06');
      // f06 seeds the upgrade history from the existing tbd_version (no timestamp).
      expect(result.config.tbd_upgrades).toEqual([{ version: '0.1.0' }]);
    });

    it('migrates f02 to f06 (multi-revision jump, guards against a dropped rung)', () => {
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
      expect(result.toFormat).toBe('f06');
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe('f06');
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
        tbd_format: 'f06',
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

      expect(result.fromFormat).toBe('f06');
      expect(result.toFormat).toBe('f06');
      expect(result.changed).toBe(false);
      expect(result.changes).toHaveLength(0);
      expect(result.config.settings?.doc_auto_sync_hours).toBe(12);
      expect(result.config.sync?.storage).toBe('git-common-dir-v1');
    });

    it('migrates f03 through f04 (sync storage marker) to f06', () => {
      const config: RawConfig = {
        tbd_format: 'f03',
        tbd_version: '0.1.6',
        display: { id_prefix: 'test' },
        sync: { branch: 'custom-sync', remote: 'upstream' },
        settings: { auto_sync: false, doc_auto_sync_hours: 12 },
      };

      const result = migrateToLatest(config);

      expect(result.fromFormat).toBe('f03');
      expect(result.toFormat).toBe('f06');
      expect(result.changed).toBe(true);
      expect(result.config.tbd_format).toBe('f06');
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
      expect(result.toFormat).toBe('f06');
      expect(result.changed).toBe(true);
      expect(result.changes).toEqual([
        'Updated tbd_format: f06',
        'Seeded tbd_upgrades history from tbd_version',
      ]);
      // Only the format stamp and the seeded history change; everything else is verbatim.
      expect(result.config).toEqual({
        ...config,
        tbd_format: 'f06',
        tbd_upgrades: [{ version: '0.2.3' }],
      });
    });

    it('seeds an empty history when migrating a config that has no tbd_version', () => {
      const config: RawConfig = {
        tbd_format: 'f05',
        display: { id_prefix: 'test' },
      };

      const result = migrateToLatest(config);

      expect(result.toFormat).toBe('f06');
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

      expect(result.toFormat).toBe('f06');
      expect(result.config.tbd_upgrades).toEqual([
        { version: '0.2.0' },
        { version: '0.3.0', at: '2026-06-12T00:00:00.000Z' },
      ]);
      expect(result.changes).toEqual(['Updated tbd_format: f06']);
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
    it('describes f01 migration (five steps)', () => {
      const descriptions = describeMigration('f01');
      expect(descriptions).toHaveLength(5);
      expect(descriptions[0]).toContain('f01 → f02');
      expect(descriptions[1]).toContain('f02 → f03');
      expect(descriptions[2]).toContain('f03 → f04');
      expect(descriptions[3]).toContain('f04 → f05');
      expect(descriptions[4]).toContain('f05 → f06');
    });

    it('describes f02 migration', () => {
      const descriptions = describeMigration('f02');
      expect(descriptions).toHaveLength(4);
      expect(descriptions[0]).toContain('f02 → f03');
      expect(descriptions[1]).toContain('f03 → f04');
      expect(descriptions[2]).toContain('f04 → f05');
      expect(descriptions[3]).toContain('f05 → f06');
    });

    it('describes f05 migration (one step)', () => {
      const descriptions = describeMigration('f05');
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0]).toContain('f05 → f06');
    });

    it('returns empty for current format', () => {
      const descriptions = describeMigration('f06');
      expect(descriptions).toHaveLength(0);
    });
  });
});
