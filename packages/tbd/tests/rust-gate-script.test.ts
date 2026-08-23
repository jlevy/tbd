import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(
  import.meta.dirname,
  '..',
  'docs',
  'guidelines',
  'scripts',
  'check-rust-gate.mjs',
);

function run(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

async function cargoFeatureArgs(options: {
  allFeatures?: boolean;
  features?: string[];
  noDefaultFeatures?: boolean;
}): Promise<string[]> {
  const gate = (await import(pathToFileURL(SCRIPT).href)) as {
    cargoFeatureArgs: (value: typeof options) => string[];
  };
  return gate.cargoFeatureArgs(options);
}

describe('check-rust-gate guideline script', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-rust-gate-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('fails when any cargo metadata workspace member has no lint policy', async () => {
    const goodManifest = join(root, 'good', 'Cargo.toml');
    const badManifest = join(root, 'bad', 'Cargo.toml');
    await mkdir(join(root, 'good'));
    await mkdir(join(root, 'bad'));
    await writeFile(goodManifest, '[package]\nname = "good"\n[lints]\nworkspace = true\n');
    await writeFile(badManifest, '[package]\nname = "bad"\n');
    const metadataFile = join(root, 'metadata.json');
    await writeFile(
      metadataFile,
      JSON.stringify({
        workspace_members: ['good 0.1.0', 'bad 0.1.0'],
        packages: [
          { id: 'good 0.1.0', manifest_path: goodManifest },
          { id: 'bad 0.1.0', manifest_path: badManifest },
        ],
      }),
    );

    const result = run(['lint-policy', '--metadata-file', metadataFile]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`NO LINT POLICY: ${badManifest}`);
    expect(result.stderr).toContain('1 workspace member(s) have no [lints] policy');
  });

  it('fails when cargo metadata returns no workspace members', async () => {
    const metadataFile = join(root, 'metadata.json');
    await writeFile(metadataFile, JSON.stringify({ workspace_members: [], packages: [] }));

    const result = run(['lint-policy', '--metadata-file', metadataFile]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('cargo metadata returned no workspace member packages');
  });

  it('passes only after every workspace member declares a lint policy', async () => {
    const manifest = join(root, 'Cargo.toml');
    await writeFile(manifest, '[package]\nname = "member"\n[lints.rust]\nwarnings = "deny"\n');
    const metadataFile = join(root, 'metadata.json');
    await writeFile(
      metadataFile,
      JSON.stringify({
        workspace_members: ['member 0.1.0'],
        packages: [{ id: 'member 0.1.0', manifest_path: manifest }],
      }),
    );

    const result = run(['lint-policy', '--metadata-file', metadataFile]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('every workspace member declares [lints]');
  });

  it('fails strict cross-target planning when any required target is missing', () => {
    const result = run([
      'plan-cross-targets',
      '--mode',
      'strict',
      '--expected',
      'target-a,target-b',
      '--installed',
      'target-a',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('required Rust targets are not installed: target-b');
  });

  it('lets local discovery skip missing targets without masquerading as the CI gate', () => {
    const result = run([
      'plan-cross-targets',
      '--mode',
      'local',
      '--expected',
      'target-a,target-b',
      '--installed',
      'target-a',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LINT TARGET: target-a');
    expect(result.stdout).toContain('SKIP TARGET: target-b');
  });

  it('uses the default feature set unless the project declares another one', async () => {
    await expect(cargoFeatureArgs({})).resolves.toEqual([]);
    await expect(cargoFeatureArgs({ allFeatures: true })).resolves.toEqual(['--all-features']);
    await expect(
      cargoFeatureArgs({ features: ['serde', 'cli', 'serde'], noDefaultFeatures: true }),
    ).resolves.toEqual(['--no-default-features', '--features', 'cli,serde']);
  });

  it('rejects contradictory Cargo feature options', async () => {
    await expect(cargoFeatureArgs({ allFeatures: true, features: ['cli'] })).rejects.toThrow(
      '--all-features cannot be combined',
    );
  });
});
