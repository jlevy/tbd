/**
 * Tests for config operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readConfig,
  writeConfig,
  initConfig,
  stampSetupVersion,
  readLocalState,
  updateLocalState,
  hasSeenWelcome,
  markWelcomeSeen,
  IncompatibleFormatError,
  droppedConfigKeys,
} from '../src/file/config.js';
import { CONFIG_FILE } from '../src/lib/paths.js';
import { CURRENT_FORMAT } from '../src/lib/tbd-format.js';
import type { Config } from '../src/lib/types.js';

describe('config operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initConfig', () => {
    it('creates config file with defaults', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const configPath = join(tempDir, CONFIG_FILE);
      const content = await readFile(configPath, 'utf-8');

      expect(content).toContain('tbd_version: 3.0.0');
      expect(content).toContain('branch: tbd-sync');
      expect(content).toContain('storage: git-common-dir-v1');
      expect(content).toContain('id_prefix: test');
    });

    it('creates .tbd directory', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const { stat } = await import('node:fs/promises');
      const tbdDir = await stat(join(tempDir, '.tbd'));
      expect(tbdDir.isDirectory()).toBe(true);
    });

    it('seeds the upgrade history with the creating version', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const config = await readConfig(tempDir);
      expect(config.tbd_upgrades).toHaveLength(1);
      expect(config.tbd_upgrades[0]?.version).toBe('3.0.0');
      // The first entry created at init carries a timestamp.
      expect(config.tbd_upgrades[0]?.at).toBeTruthy();
    });
  });

  describe('stampSetupVersion', () => {
    const base: Config = {
      tbd_format: CURRENT_FORMAT,
      tbd_version: '0.3.0',
      tbd_upgrades: [{ version: '0.3.0', at: '2026-06-12T00:00:00.000Z' }],
      sync: { branch: 'tbd-sync', remote: 'origin', storage: 'git-common-dir-v1' },
      display: { id_prefix: 'test' },
      settings: { auto_sync: false, doc_auto_sync_hours: 24, use_gh_cli: true },
    };

    it('appends a new entry and updates tbd_version when the version changed', () => {
      const stamped = stampSetupVersion(base, '0.3.1', '2026-06-13T00:00:00.000Z');

      expect(stamped).not.toBe(base);
      expect(stamped.tbd_version).toBe('0.3.1');
      expect(stamped.tbd_upgrades).toEqual([
        { version: '0.3.0', at: '2026-06-12T00:00:00.000Z' },
        { version: '0.3.1', at: '2026-06-13T00:00:00.000Z' },
      ]);
    });

    it('is a no-op (same reference) when the version already heads the history', () => {
      const stamped = stampSetupVersion(base, '0.3.0', '2026-06-13T00:00:00.000Z');

      expect(stamped).toBe(base);
      expect(stamped.tbd_upgrades).toHaveLength(1);
    });

    it('seeds the first entry for a config with no history', () => {
      const noHistory: Config = { ...base, tbd_upgrades: [] };
      const stamped = stampSetupVersion(noHistory, '0.3.0', '2026-06-13T00:00:00.000Z');

      expect(stamped.tbd_version).toBe('0.3.0');
      expect(stamped.tbd_upgrades).toEqual([{ version: '0.3.0', at: '2026-06-13T00:00:00.000Z' }]);
    });
  });

  describe('readConfig', () => {
    it('reads existing config', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const config = await readConfig(tempDir);

      expect(config.tbd_version).toBe('3.0.0');
      expect(config.sync.branch).toBe('tbd-sync');
      expect(config.sync.remote).toBe('origin');
      expect(config.display.id_prefix).toBe('test');
    });

    it('throws when config does not exist', async () => {
      await expect(readConfig(tempDir)).rejects.toThrow();
    });

    it('uses a clear newer-version message for future config formats', async () => {
      await mkdir(join(tempDir, '.tbd'), { recursive: true });
      await writeFile(
        join(tempDir, CONFIG_FILE),
        [
          'tbd_format: f99',
          'tbd_version: future',
          'display:',
          '  id_prefix: test',
          'sync:',
          '  branch: tbd-sync',
          '  remote: origin',
          'settings:',
          '  auto_sync: false',
          '',
        ].join('\n'),
      );

      await expect(readConfig(tempDir)).rejects.toThrow(IncompatibleFormatError);
      await expect(readConfig(tempDir)).rejects.toThrow(
        'This repository requires a newer version of tbd.\n' +
          "Config format 'f99' is from a newer tbd version.\n" +
          "This tbd version supports up to format 'f07'.\n" +
          'Upgrade tbd: npm install -g get-tbd@latest',
      );
    });
  });

  describe('writeConfig', () => {
    it('writes config to file', async () => {
      await initConfig(tempDir, '3.0.0', 'test');

      const config: Config = {
        tbd_format: CURRENT_FORMAT,
        tbd_version: '3.1.0',
        tbd_upgrades: [{ version: '3.0.0' }, { version: '3.1.0', at: '2026-06-12T00:00:00.000Z' }],
        sync: { branch: 'custom-branch', remote: 'upstream', storage: 'git-common-dir-v1' },
        display: { id_prefix: 'td' },
        settings: { auto_sync: true, doc_auto_sync_hours: 24, use_gh_cli: true },
        docs_cache: { lookup_path: ['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard'] },
      };

      await writeConfig(tempDir, config);
      const read = await readConfig(tempDir);

      expect(read.tbd_version).toBe('3.1.0');
      expect(read.tbd_upgrades).toEqual([
        { version: '3.0.0' },
        { version: '3.1.0', at: '2026-06-12T00:00:00.000Z' },
      ]);
      expect(read.sync.branch).toBe('custom-branch');
      expect(read.sync.remote).toBe('upstream');
      expect(read.sync.storage).toBe('git-common-dir-v1');
      expect(read.display.id_prefix).toBe('td');
      expect(read.settings.auto_sync).toBe(true);
    });

    /**
     * The f07 forward-compatibility contract. Before f07 the config schema parsed in
     * strip mode, so a tbd that did not know a block silently discarded it on its next
     * write — how the integrations block was lost three times during the Linear pilot.
     */
    it('preserves an unknown top-level block across a read/write round trip', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      const configPath = join(tempDir, CONFIG_FILE);

      const original = await readFile(configPath, 'utf-8');
      await writeFile(
        configPath,
        `${original}future_block:\n  written_by: a newer tbd\n  keep: true\n`,
      );

      const read = await readConfig(tempDir);
      await writeConfig(tempDir, read);

      const rewritten = await readFile(configPath, 'utf-8');
      expect(rewritten).toContain('future_block:');
      expect(rewritten).toContain('written_by: a newer tbd');
    });

    it('preserves an unknown provider and provider setting inside integrations', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      const configPath = join(tempDir, CONFIG_FILE);

      const original = await readFile(configPath, 'utf-8');
      await writeFile(
        configPath,
        `${original}integrations:\n` +
          '  linear:\n' +
          '    enabled: true\n' +
          '    team_key: FIN\n' +
          '    future_setting: keep me\n' +
          '  jira:\n' +
          '    enabled: true\n',
      );

      await writeConfig(tempDir, await readConfig(tempDir));

      const rewritten = await readFile(configPath, 'utf-8');
      expect(rewritten).toContain('future_setting: keep me');
      expect(rewritten).toContain('jira:');
      expect(rewritten).toContain('team_key: FIN');
    });
  });

  describe('local state with welcome_seen', () => {
    it('returns empty state when no state file exists', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBeUndefined();
    });

    it('stores and reads welcome_seen', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await updateLocalState(tempDir, { welcome_seen: true });

      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBe(true);
    });

    it('preserves other state fields when updating welcome_seen', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await updateLocalState(tempDir, { last_sync_at: '2026-01-01T00:00:00Z' });
      await updateLocalState(tempDir, { welcome_seen: true });

      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBe(true);
      expect(state.last_sync_at).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('welcome tracking utilities', () => {
    it('hasSeenWelcome returns false when no state exists', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      expect(await hasSeenWelcome(tempDir)).toBe(false);
    });

    it('markWelcomeSeen sets welcome_seen to true', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await markWelcomeSeen(tempDir);
      expect(await hasSeenWelcome(tempDir)).toBe(true);
    });

    it('markWelcomeSeen preserves existing state', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      await updateLocalState(tempDir, { last_sync_at: '2026-01-01T00:00:00Z' });
      await markWelcomeSeen(tempDir);

      const state = await readLocalState(tempDir);
      expect(state.welcome_seen).toBe(true);
      expect(state.last_sync_at).toBe('2026-01-01T00:00:00Z');
    });
  });

  /**
   * Detects the silent loss directly rather than by its downstream symptom: a block
   * that is committed but absent locally was dropped by a client that did not know it.
   */
  describe('droppedConfigKeys', () => {
    const gitInit = (dir: string) => {
      execFileSync('git', ['init', '--initial-branch=main'], { cwd: dir, stdio: 'pipe' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
      execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
    };
    const commitAll = (dir: string, message: string) => {
      execFileSync('git', ['add', '-A'], { cwd: dir });
      execFileSync('git', ['commit', '-m', message], { cwd: dir, stdio: 'pipe' });
    };

    const writeConfigWith = async (extra: string) => {
      const configPath = join(tempDir, CONFIG_FILE);
      const base = await readFile(configPath, 'utf-8');
      await writeFile(configPath, base + extra);
    };

    it('reports a committed integrations block that the working copy lost', async () => {
      gitInit(tempDir);
      await initConfig(tempDir, '3.0.0', 'test');
      await writeConfigWith('integrations:\n  linear:\n    enabled: true\n    team_key: FIN\n');
      commitAll(tempDir, 'Configure Linear');

      // Simulate a pre-f07 client rewriting config: the block it did not know is gone.
      const configPath = join(tempDir, CONFIG_FILE);
      const stripped = (await readFile(configPath, 'utf-8')).split('integrations:')[0] ?? '';
      await writeFile(configPath, stripped);

      expect(await droppedConfigKeys(tempDir)).toEqual(['integrations']);
    });

    it('reports nothing when the working copy matches the commit', async () => {
      gitInit(tempDir);
      await initConfig(tempDir, '3.0.0', 'test');
      await writeConfigWith('integrations:\n  linear:\n    enabled: true\n');
      commitAll(tempDir, 'Configure Linear');

      expect(await droppedConfigKeys(tempDir)).toEqual([]);
    });

    it('stays quiet when the format changed, since a migration adds and removes keys', async () => {
      gitInit(tempDir);
      await initConfig(tempDir, '3.0.0', 'test');
      await writeConfigWith('integrations:\n  linear:\n    enabled: true\n');
      commitAll(tempDir, 'Configure Linear');

      const configPath = join(tempDir, CONFIG_FILE);
      const stripped = (await readFile(configPath, 'utf-8'))
        .split('integrations:')[0]
        ?.replace(`tbd_format: ${CURRENT_FORMAT}`, 'tbd_format: f99');
      await writeFile(configPath, stripped ?? '');

      expect(await droppedConfigKeys(tempDir)).toEqual([]);
    });

    it('stays quiet outside a git repository', async () => {
      await initConfig(tempDir, '3.0.0', 'test');
      expect(await droppedConfigKeys(tempDir)).toEqual([]);
    });

    it('stays quiet when config.yml has never been committed', async () => {
      gitInit(tempDir);
      await writeFile(join(tempDir, 'README.md'), '# fixture\n');
      commitAll(tempDir, 'Initial commit');
      await initConfig(tempDir, '3.0.0', 'test');

      expect(await droppedConfigKeys(tempDir)).toEqual([]);
    });
  });
});
