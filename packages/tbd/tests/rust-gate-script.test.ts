import { spawnSync } from 'node:child_process';
import { chmod, copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(
  import.meta.dirname,
  '..',
  'docs',
  'guidelines',
  'scripts',
  'check-rust-gate.mjs',
);

function run(args: string[], env = process.env) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env });
}

async function fakeCargo(root: string) {
  const directory = join(root, 'fake-cargo');
  const implementation = join(directory, 'fake-cargo.cjs');
  const log = join(root, 'cargo-args.jsonl');
  await mkdir(directory);
  await writeFile(
    implementation,
    [
      "const { appendFileSync } = require('node:fs');",
      "const { basename } = require('node:path');",
      'const args = process.argv.slice(1);',
      "if (basename(args[0] ?? '') === 'clippy') {",
      '  appendFileSync(process.env.FAKE_CARGO_LOG, `${JSON.stringify(args)}\\n`);',
      '  process.exit(0);',
      '}',
      '',
    ].join('\n'),
  );

  const executable = join(directory, process.platform === 'win32' ? 'cargo.exe' : 'cargo');
  try {
    await link(process.execPath, executable);
  } catch {
    await copyFile(process.execPath, executable);
  }
  if (process.platform !== 'win32') {
    await chmod(executable, 0o755);
  }

  return {
    log,
    env: {
      ...process.env,
      FAKE_CARGO_LOG: log,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${JSON.stringify(implementation)}`]
        .filter(Boolean)
        .join(' '),
      PATH: `${directory}${delimiter}${process.env.PATH ?? ''}`,
    },
  };
}

describe('check-rust-gate guideline script', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-rust-gate-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('documents every command, mode, and exit-status class in help output', () => {
    const result = run(['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('lint-policy');
    expect(result.stdout).toContain('cross-targets');
    expect(result.stdout).toContain('strict rejects missing targets');
    expect(result.stdout).toContain('2  Invalid command usage exits before any gate runs.');
  });

  it('returns a usage error for an unknown or incomplete option', () => {
    const unknown = run(['lint-policy', '--unknown']);
    const incomplete = run(['lint-policy', '--manifest-path']);

    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toContain('unknown option: --unknown');
    expect(incomplete.status).toBe(2);
    expect(incomplete.stderr).toContain('--manifest-path requires a value');
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

  it('rejects malformed Cargo metadata instead of treating missing fields as empty', async () => {
    const metadataFile = join(root, 'metadata.json');
    await writeFile(metadataFile, JSON.stringify({ packages: [] }));

    const result = run(['lint-policy', '--metadata-file', metadataFile]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has no string workspace_members array');
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

  it('passes the declared feature set to Cargo exactly', async () => {
    const manifest = join(root, 'Cargo.toml');
    await writeFile(manifest, '[workspace]\n');
    const cargo = await fakeCargo(root);
    const cases = [
      { options: [], expected: [] },
      { options: ['--all-features'], expected: ['--all-features'] },
      {
        options: ['--features', 'serde,cli,serde', '--no-default-features'],
        expected: ['--no-default-features', '--features', 'cli,serde'],
      },
    ];

    for (const testCase of cases) {
      const result = run(
        [
          'cross-targets',
          '--mode',
          'strict',
          '--target',
          'target-a',
          '--installed',
          'target-a',
          '--manifest-path',
          manifest,
          ...testCase.options,
        ],
        cargo.env,
      );
      expect(result.status, result.stderr).toBe(0);
    }

    const invocations = (await readFile(cargo.log, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[])
      .map(([command, ...args]) => [basename(command ?? ''), ...args]);
    expect(invocations).toEqual(
      cases.map((testCase) => [
        'clippy',
        '--locked',
        '--workspace',
        '--all-targets',
        ...testCase.expected,
        '--manifest-path',
        manifest,
        '--target',
        'target-a',
        '--',
        '-D',
        'warnings',
      ]),
    );
  });

  it('rejects contradictory Cargo feature options', () => {
    const result = run([
      'plan-cross-targets',
      '--mode',
      'strict',
      '--expected',
      'target-a',
      '--installed',
      'target-a',
      '--all-features',
      '--features',
      'cli',
    ]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--all-features cannot be combined');
  });
});
