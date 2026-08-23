import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'measure-rust-lint-cost.mjs');
const scratchDirectories: string[] = [];

function fakeCargoDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'fake-cargo-'));
  scratchDirectories.push(directory);
  const implementation = join(directory, 'fake-cargo.mjs');
  writeFileSync(
    implementation,
    [
      "import { appendFileSync } from 'node:fs';",
      'const args = process.argv.slice(2);',
      'if (process.env.FAKE_CARGO_LOG) appendFileSync(process.env.FAKE_CARGO_LOG, `${JSON.stringify(args)}\\n`);',
      "if (args[0] === 'metadata') {",
      "  console.log(JSON.stringify({ packages: [{ id: 'example 0.1.0', name: 'example' }] }));",
      '  process.exit(0);',
      '}',
      'console.log(JSON.stringify({',
      "  reason: 'compiler-message',",
      "  package_id: 'example 0.1.0',",
      "  target: { kind: ['lib'], name: 'example' },",
      "  message: { code: { code: 'clippy::panic' }, spans: [{",
      "    is_primary: true, file_name: 'src/lib.rs', line_start: 1, column_start: 1",
      '  }] }',
      '}));',
      "process.exit(Number(process.env.FAKE_CARGO_EXIT ?? '1'));",
      '',
    ].join('\n'),
  );

  if (process.platform === 'win32') {
    writeFileSync(
      join(directory, 'cargo.cmd'),
      `@"${process.execPath}" "${implementation}" %*\r\n`,
    );
  } else {
    const executable = join(directory, 'cargo');
    writeFileSync(executable, `#!/bin/sh\nexec "${process.execPath}" "${implementation}" "$@"\n`);
    chmodSync(executable, 0o755);
  }
  return directory;
}

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('measure-rust-lint-cost', () => {
  it('rejects a partial clippy run even when it emitted diagnostics', () => {
    const subject = mkdtempSync(join(tmpdir(), 'lint-cost-subject-'));
    scratchDirectories.push(subject);
    mkdirSync(join(subject, 'src'));
    writeFileSync(join(subject, 'src', 'lib.rs'), 'pub fn example() {}\n');
    const controlledTmp = join(subject, 'tmp');
    mkdirSync(controlledTmp);
    const output = join(subject, 'evidence');
    const fakeCargo = fakeCargoDirectory();

    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--repo', subject, '--out', output, '--lint', 'clippy::panic'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeCargo}${delimiter}${process.env.PATH ?? ''}`,
          TMPDIR: controlledTmp,
          TMP: controlledTmp,
          TEMP: controlledTmp,
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(existsSync(`${output}.tsv`)).toBe(false);
    expect(readdirSync(controlledTmp)).toEqual([]);
  });

  it('uses the locked graph and removes temporary build directories', () => {
    const subject = mkdtempSync(join(tmpdir(), 'lint-cost-subject-'));
    scratchDirectories.push(subject);
    mkdirSync(join(subject, 'src'));
    writeFileSync(join(subject, 'src', 'lib.rs'), 'pub fn example() {}\n');
    const controlledTmp = join(subject, 'tmp');
    mkdirSync(controlledTmp);
    const output = join(subject, 'evidence');
    const log = join(subject, 'cargo-args.jsonl');
    const fakeCargo = fakeCargoDirectory();

    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--repo', subject, '--out', output, '--lint', 'clippy::panic'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          FAKE_CARGO_EXIT: '0',
          FAKE_CARGO_LOG: log,
          PATH: `${fakeCargo}${delimiter}${process.env.PATH ?? ''}`,
          TMPDIR: controlledTmp,
          TMP: controlledTmp,
          TEMP: controlledTmp,
        },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(`${output}.tsv`)).toBe(true);
    const invocations = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[]);
    expect(invocations).toHaveLength(3);
    for (const args of invocations) {
      expect(args).toContain('--locked');
    }
    expect(readdirSync(controlledTmp)).toEqual([]);
  });
});
