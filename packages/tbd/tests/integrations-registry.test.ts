/**
 * Provider registry and `.env` gitignore safety.
 */

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { git } from '../src/file/git.js';
import { checkEnvIgnored } from '../src/lib/env-file.js';
import {
  PROVIDERS,
  configuredProviders,
  enabledProviders,
  integrationsInert,
  providerConfig,
} from '../src/integrations/core/registry.js';
import type { Config } from '../src/lib/types.js';

function config(integrations?: Config['integrations']): Config {
  return {
    version: 1,
    display: { id_prefix: 'tbd' },
    settings: { auto_sync: false, doc_auto_sync_hours: 24, use_gh_cli: true },
    sync: { branch: 'tbd-sync' },
    integrations,
  } as unknown as Config;
}

const SELECT = { kinds: ['epic'], statuses: ['open'], labels: [], linked: true } as const;

describe('provider registry', () => {
  it('lists both providers in a stable order', () => {
    expect(PROVIDERS).toEqual(['linear', 'github']);
  });

  it('returns undefined for a provider with no config block', () => {
    expect(providerConfig(config(), 'linear')).toBeUndefined();
    expect(providerConfig(config({ sync_on_tbd_sync: false }), 'linear')).toBeUndefined();
  });

  it('distinguishes a configured-but-disabled provider from an absent one', () => {
    const cfg = config({
      sync_on_tbd_sync: false,
      linear: {
        enabled: false,
        select: SELECT,
        max_nesting: 2,
        create_labels: true,
        user_map: {},
      },
    } as unknown as Config['integrations']);

    const entry = providerConfig(cfg, 'linear');
    expect(entry?.enabled).toBe(false);
    expect(configuredProviders(cfg)).toHaveLength(1);
    expect(enabledProviders(cfg)).toHaveLength(0);
    expect(integrationsInert(cfg)).toBe(true);
  });

  it('reports a config error when an enabled provider is missing its target', () => {
    const cfg = config({
      sync_on_tbd_sync: false,
      linear: {
        enabled: true,
        select: SELECT,
        max_nesting: 2,
        create_labels: true,
        user_map: {},
      },
    } as unknown as Config['integrations']);

    expect(providerConfig(cfg, 'linear')?.configError).toContain('team_key');
  });

  it('has no config error when the target is present', () => {
    const cfg = config({
      sync_on_tbd_sync: false,
      linear: {
        enabled: true,
        team_key: 'FIN',
        select: SELECT,
        max_nesting: 2,
        create_labels: true,
        user_map: {},
      },
    } as unknown as Config['integrations']);

    const entry = providerConfig(cfg, 'linear');
    expect(entry?.configError).toBeUndefined();
    expect(entry?.target).toBe('FIN');
    expect(integrationsInert(cfg)).toBe(false);
  });

  it('treats a repo with no integrations block as inert', () => {
    expect(integrationsInert(config())).toBe(true);
  });
});

describe('.env gitignore safety', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-envcheck-'));
    await git('-C', dir, 'init', '-q');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports absent when there is no .env', async () => {
    const status = await checkEnvIgnored(dir);
    expect(status.exists).toBe(false);
  });

  it('reports an unignored .env, the case that would leak a key', async () => {
    await writeFile(join(dir, '.env'), 'LINEAR_API_KEY=secret\n');
    const status = await checkEnvIgnored(dir);
    expect(status).toEqual({ exists: true, ignored: false });
  });

  it('reports an ignored .env as safe', async () => {
    await writeFile(join(dir, '.env'), 'LINEAR_API_KEY=secret\n');
    await writeFile(join(dir, '.gitignore'), '.env\n');
    const status = await checkEnvIgnored(dir);
    expect(status).toEqual({ exists: true, ignored: true });
  });

  it('honors a nested gitignore rule', async () => {
    await mkdir(join(dir, 'sub'), { recursive: true });
    await writeFile(join(dir, '.env'), 'K=v\n');
    await writeFile(join(dir, '.gitignore'), '*.env\n.env\n');
    expect((await checkEnvIgnored(dir)).ignored).toBe(true);
  });
});
