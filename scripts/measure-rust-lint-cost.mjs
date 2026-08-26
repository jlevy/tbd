#!/usr/bin/env node
/* global process, console */
/**
 * Measure the adoption cost of candidate Clippy lints against a real Rust workspace.
 *
 * The question this answers is "how many diagnostics would this lint produce, and how
 * many of them are in code that ships?" Splitting a source file at its first
 * `#[cfg(test)]` attribute does not answer that: the attribute applies to the next item
 * only, so production items below a test module are misattributed. This script asks the
 * compiler instead.
 *
 * Two passes over the same workspace:
 *
 *   production  cargo clippy --workspace --lib --bins   (no `cfg(test)`, no test targets)
 *   all         cargo clippy --workspace --all-targets  (adds unit tests, integration
 *                                                        tests, examples, benches)
 *
 * A diagnostic that appears in both passes is in code that compiles without `cfg(test)`.
 * A diagnostic that appears only in the second is in test-only code. Cargo also reports
 * the target that produced each diagnostic, which separates build scripts, integration
 * tests, examples, and benches from the library and binaries. The classification is
 * therefore the compiler's own view of which compile units contain the code, and every
 * row is written out so the split can be audited.
 *
 * Lints are capped at `warn` for the measurement. A workspace that denies warnings
 * fails its first target and stops, so an uncapped run measures whichever crate happens
 * to compile first rather than the workspace.
 *
 * Usage:
 *   node scripts/measure-rust-lint-cost.mjs --repo <path> --out <prefix> \
 *     [--lint clippy::panic ...] [--clippy-conf <path-to-clippy.toml>]
 *
 * Writes <prefix>.tsv (one row per diagnostic) and prints the summary table.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const args = { repo: '.', out: 'lint-cost', lints: [], clippyConf: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--repo') {
      args.repo = argv[(i += 1)];
    } else if (flag === '--out') {
      args.out = argv[(i += 1)];
    } else if (flag === '--lint') {
      args.lints.push(argv[(i += 1)]);
    } else if (flag === '--clippy-conf') {
      args.clippyConf = argv[(i += 1)];
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  if (args.lints.length === 0) {
    throw new Error('at least one --lint is required');
  }
  return args;
}

/** Workspace member manifests, so diagnostics from dependencies can be dropped. */
function workspaceMembers(repo) {
  const raw = execFileSync(
    'cargo',
    ['metadata', '--locked', '--format-version', '1', '--no-deps'],
    {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const metadata = JSON.parse(raw);
  return new Map(metadata.packages.map((pkg) => [pkg.id, pkg.name]));
}

/** Force re-checking so cargo emits diagnostics instead of replaying a fresh unit. */
function touchWorkspaceSources(repo) {
  const now = new Date();
  let touched = 0;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'target' && entry.name !== '.git') {
          walk(full);
        }
      } else if (entry.name.endsWith('.rs')) {
        utimesSync(full, now, now);
        touched += 1;
      }
    }
  };
  walk(repo);
  // Zero touched sources means cargo replays cached diagnostics and the run measures
  // nothing, which looks exactly like a clean workspace.
  if (touched === 0) {
    throw new Error(`no .rs files found under ${repo}`);
  }
}

function runPass(repo, targetDir, selection, lints, clippyConf, members) {
  touchWorkspaceSources(repo);
  const warnFlags = lints.flatMap((lint) => ['-W', lint]);
  // `--cap-lints warn` keeps a `deny` in the workspace manifest from aborting the run
  // before the later crates are ever checked.
  const env = { ...process.env, CARGO_TERM_COLOR: 'never', RUSTFLAGS: '--cap-lints warn' };
  if (clippyConf) {
    env.CLIPPY_CONF_DIR = clippyConf;
  }
  // Candidate lints are capped at warn, so a nonzero status means compilation or the
  // measurement itself failed. Diagnostics emitted before that failure describe only
  // the targets Cargo happened to reach first and must not be summarized.
  const stdout = execFileSync(
    'cargo',
    [
      'clippy',
      '--locked',
      '--workspace',
      ...selection,
      '--message-format=json',
      '--target-dir',
      targetDir,
      '--',
      ...warnFlags,
    ],
    {
      cwd: repo,
      encoding: 'utf8',
      env,
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const rows = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.reason !== 'compiler-message') {
      continue;
    }
    if (!members.has(record.package_id)) {
      continue;
    }
    const code = record.message?.code?.code;
    if (!code || !lints.includes(code)) {
      continue;
    }
    const span = (record.message.spans ?? []).find((candidate) => candidate.is_primary);
    if (!span) {
      continue;
    }
    rows.push({
      lint: code,
      package: members.get(record.package_id),
      targetKind: (record.target?.kind ?? ['?']).join('+'),
      targetName: record.target?.name ?? '?',
      file: span.file_name,
      line: span.line_start,
      column: span.column_start,
    });
  }
  return rows;
}

const key = (row) => `${row.lint}\t${row.file}\t${row.line}\t${row.column}`;

const args = parseArgs(process.argv.slice(2));
const repo = path.resolve(args.repo);
const members = workspaceMembers(repo);
const temporaryDirectories = [];
process.once('exit', () => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

let clippyConf = null;
if (args.clippyConf) {
  clippyConf = mkdtempSync(path.join(tmpdir(), 'clippy-conf-'));
  temporaryDirectories.push(clippyConf);
  writeFileSync(path.join(clippyConf, 'clippy.toml'), readFileSync(args.clippyConf, 'utf8'));
}

const scratch = mkdtempSync(path.join(tmpdir(), 'lint-cost-'));
temporaryDirectories.push(scratch);
const production = runPass(
  repo,
  path.join(scratch, 'prod'),
  ['--lib', '--bins'],
  args.lints,
  clippyConf,
  members,
);
const everything = runPass(
  repo,
  path.join(scratch, 'all'),
  ['--all-targets'],
  args.lints,
  clippyConf,
  members,
);

const productionKeys = new Set(production.map(key));
const seen = new Set();
const rows = [];
for (const row of everything) {
  const rowKey = key(row);
  if (seen.has(rowKey)) {
    continue;
  }
  seen.add(rowKey);
  rows.push({ ...row, scope: productionKeys.has(rowKey) ? 'production' : 'test-or-build' });
}
rows.sort((a, b) => key(a).localeCompare(key(b)));

const header = ['lint', 'scope', 'package', 'target_kind', 'target_name', 'file', 'line', 'column'];
const tsv = [
  header.join('\t'),
  ...rows.map((row) =>
    [
      row.lint,
      row.scope,
      row.package,
      row.targetKind,
      row.targetName,
      row.file,
      row.line,
      row.column,
    ].join('\t'),
  ),
].join('\n');
mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
writeFileSync(`${args.out}.tsv`, `${tsv}\n`);

// Three buckets, because "production" alone hides which cost a release actually carries.
//   ships  library and binary code compiled without `cfg(test)`
//   build  build scripts: they run at build time and are exempted separately
//   dev    inline `#[cfg(test)]` code plus test, example, and bench targets
const DEV_TARGET_KINDS = new Set(['test', 'example', 'bench']);
function bucket(row) {
  if (row.targetKind === 'custom-build') {
    return 'build';
  }
  if (row.scope !== 'production' || DEV_TARGET_KINDS.has(row.targetKind)) {
    return 'dev';
  }
  // Everything else is a shipped crate type: lib, rlib, dylib, cdylib, staticlib,
  // proc-macro, bin. Naming only lib and bin here would misfile an extension module.
  return 'ships';
}

const summary = new Map();
for (const row of rows) {
  const entry = summary.get(row.lint) ?? { ships: 0, build: 0, dev: 0, kinds: new Set() };
  entry[bucket(row)] += 1;
  entry.kinds.add(row.targetKind);
  summary.set(row.lint, entry);
}
console.log(`\n| Lint | Ships | Build scripts | Tests/examples | Target kinds |`);
console.log(`| --- | ---: | ---: | ---: | --- |`);
for (const lint of args.lints) {
  const entry = summary.get(lint) ?? { ships: 0, build: 0, dev: 0, kinds: new Set() };
  console.log(
    `| \`${lint}\` | ${entry.ships} | ${entry.build} | ${entry.dev} | ${[...entry.kinds].sort().join(', ') || '—'} |`,
  );
}
console.log(`\nRaw mapping: ${args.out}.tsv (${rows.length} diagnostics)`);
