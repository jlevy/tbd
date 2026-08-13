/**
 * Integration status reporting.
 *
 * The important properties are that an unconfigured repository stays inert and
 * offline, that every failure carries a remedy, and that no credential value
 * ever appears in the report.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { git } from '../src/file/git.js';
import {
  hasErrors,
  integrationStatus,
  type ReachabilityProbe,
} from '../src/integrations/core/status.js';
import type { Config } from '../src/lib/types.js';

const SECRET = 'lin_api_0123456789abcdef';

function config(integrations?: unknown): Config {
  return {
    version: 1,
    display: { id_prefix: 'tbd' },
    settings: { auto_sync: false, doc_auto_sync_hours: 24, use_gh_cli: true },
    sync: { branch: 'tbd-sync' },
    integrations,
  } as unknown as Config;
}

const linearEnabled = {
  sync_on_tbd_sync: false,
  linear: {
    enabled: true,
    team_key: 'FIN',
    select: { kinds: ['epic'], statuses: ['open'], labels: [], linked: true },
    max_nesting: 2,
    create_labels: true,
    user_map: {},
  },
};

const okProbe: ReachabilityProbe = () => Promise.resolve({ ok: true, detail: 'User @ Org' });
const failProbe: ReachabilityProbe = () => Promise.resolve({ ok: false, detail: 'bad key' });

describe('integration status', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-status-'));
    await git('-C', dir, 'init', '-q');
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.LINEAR_API_KEY;
  });

  it('is inert with no integrations configured and makes no network call', async () => {
    let probed = false;
    const status = await integrationStatus({
      config: config(),
      repoRoot: dir,
      probe: () => {
        probed = true;
        return Promise.resolve({ ok: true, detail: '' });
      },
    });

    expect(status.inert).toBe(true);
    expect(status.providers).toHaveLength(0);
    expect(probed).toBe(false);
    expect(hasErrors(status)).toBe(false);
  });

  it('flags a .env that git would commit, since that is how a key leaks', async () => {
    await writeFile(join(dir, '.env'), `LINEAR_API_KEY=${SECRET}\n`);

    const status = await integrationStatus({ config: config(), repoRoot: dir });

    expect(status.envFile.state).toBe('error');
    expect(status.envFile.remedy).toMatch(/gitignore/i);
    expect(hasErrors(status)).toBe(true);
  });

  it('warns before an absent .env would be tracked', async () => {
    const status = await integrationStatus({ config: config(), repoRoot: dir });

    expect(status.envFile.state).toBe('warn');
    expect(status.envFile.detail).toContain('not gitignored');
    expect(status.envFile.remedy).toMatch(/gitignore/i);
    expect(hasErrors(status)).toBe(false);
  });

  it('accepts an absent .env when git would ignore it', async () => {
    await writeFile(join(dir, '.gitignore'), '.env\n');

    const status = await integrationStatus({ config: config(), repoRoot: dir });

    expect(status.envFile.state).toBe('ok');
    expect(status.envFile.detail).toContain('not present');
  });

  it('accepts a gitignored .env', async () => {
    await writeFile(join(dir, '.env'), `LINEAR_API_KEY=${SECRET}\n`);
    await writeFile(join(dir, '.gitignore'), '.env\n');

    const status = await integrationStatus({ config: config(), repoRoot: dir });
    expect(status.envFile.state).toBe('ok');
  });

  it('reports a missing credential with the variable name to set', async () => {
    const status = await integrationStatus({
      config: config(linearEnabled),
      repoRoot: dir,
      probe: okProbe,
    });

    const credential = status.providers[0]?.findings.find((f) => f.label === 'credential');
    expect(credential?.state).toBe('error');
    expect(credential?.remedy).toContain('LINEAR_API_KEY');
  });

  it('never reveals the credential value', async () => {
    await writeFile(join(dir, '.env'), `LINEAR_API_KEY=${SECRET}\n`);
    await writeFile(join(dir, '.gitignore'), '.env\n');

    const status = await integrationStatus({
      config: config(linearEnabled),
      repoRoot: dir,
      probe: okProbe,
    });

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).toContain('cdef');
  });

  it('names where the credential came from', async () => {
    await writeFile(join(dir, '.env'), `LINEAR_API_KEY=${SECRET}\n`);
    await writeFile(join(dir, '.gitignore'), '.env\n');

    const status = await integrationStatus({
      config: config(linearEnabled),
      repoRoot: dir,
      probe: okProbe,
    });

    const credential = status.providers[0]?.findings.find((f) => f.label === 'credential');
    expect(credential?.detail).toContain('.env');
  });

  it('prefers the process environment over .env', async () => {
    await writeFile(join(dir, '.env'), 'LINEAR_API_KEY=from_dotenv_key_value\n');
    await writeFile(join(dir, '.gitignore'), '.env\n');
    process.env.LINEAR_API_KEY = SECRET;

    const status = await integrationStatus({
      config: config(linearEnabled),
      repoRoot: dir,
      probe: okProbe,
    });

    const credential = status.providers[0]?.findings.find((f) => f.label === 'credential');
    expect(credential?.detail).toContain('process environment');
  });

  it('reports a config error when an enabled provider has no target', async () => {
    const noTeam = {
      sync_on_tbd_sync: false,
      linear: { ...linearEnabled.linear, team_key: undefined },
    };
    process.env.LINEAR_API_KEY = SECRET;

    const status = await integrationStatus({
      config: config(noTeam),
      repoRoot: dir,
      probe: okProbe,
    });

    const configFinding = status.providers[0]?.findings.find((f) => f.label === 'config');
    expect(configFinding?.state).toBe('error');
    expect(configFinding?.detail).toContain('team_key');
  });

  it('reports an unreachable provider with a remedy', async () => {
    process.env.LINEAR_API_KEY = SECRET;

    const status = await integrationStatus({
      config: config(linearEnabled),
      repoRoot: dir,
      probe: failProbe,
    });

    const reachable = status.providers[0]?.findings.find((f) => f.label === 'reachable');
    expect(reachable?.state).toBe('error');
    expect(reachable?.remedy).toContain('LINEAR_API_KEY');
    expect(hasErrors(status)).toBe(true);
  });

  it('skips the network check when no probe is supplied', async () => {
    process.env.LINEAR_API_KEY = SECRET;

    const status = await integrationStatus({ config: config(linearEnabled), repoRoot: dir });

    const reachable = status.providers[0]?.findings.find((f) => f.label === 'reachable');
    expect(reachable?.state).toBe('skipped');
    expect(hasErrors(status)).toBe(false);
  });

  it('reports a disabled provider without probing it', async () => {
    const disabled = {
      sync_on_tbd_sync: false,
      linear: { ...linearEnabled.linear, enabled: false },
    };

    const status = await integrationStatus({
      config: config(disabled),
      repoRoot: dir,
      probe: failProbe,
    });

    expect(status.inert).toBe(false);
    expect(status.providers[0]?.enabled).toBe(false);
    expect(hasErrors(status)).toBe(false);
  });

  it('gives every non-ok finding a remedy', async () => {
    const status = await integrationStatus({
      config: config(linearEnabled),
      repoRoot: dir,
      probe: failProbe,
    });

    for (const provider of status.providers) {
      for (const finding of provider.findings) {
        if (finding.state === 'error') {
          expect(finding.remedy, `${finding.label} has no remedy`).toBeTruthy();
        }
      }
    }
  });
});
