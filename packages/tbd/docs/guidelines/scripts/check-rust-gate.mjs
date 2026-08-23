#!/usr/bin/env node
/* global console */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function fail(message) {
  throw new Error(message);
}

function splitCsv(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptions(args) {
  const options = { features: [], targets: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === '--manifest-path' && value) {
      options.manifestPath = value;
      index += 1;
    } else if (arg === '--metadata-file' && value) {
      options.metadataFile = value;
      index += 1;
    } else if (arg === '--mode' && value) {
      options.mode = value;
      index += 1;
    } else if (arg === '--target' && value) {
      options.targets.push(value);
      index += 1;
    } else if (arg === '--expected' && value) {
      options.targets.push(...splitCsv(value));
      index += 1;
    } else if (arg === '--installed' && value) {
      options.installed = splitCsv(value);
      index += 1;
    } else if (arg === '--all-features') {
      options.allFeatures = true;
    } else if (arg === '--no-default-features') {
      options.noDefaultFeatures = true;
    } else if (arg === '--features' && value) {
      options.features.push(...splitCsv(value));
      index += 1;
    } else {
      fail(`unknown or incomplete option: ${arg}`);
    }
  }
  return options;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`${command} exited ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout;
}

function loadMetadata(options) {
  if (options.metadataFile) {
    return JSON.parse(readFileSync(resolve(options.metadataFile), 'utf8'));
  }

  const manifestPath = resolve(options.manifestPath ?? 'Cargo.toml');
  const stdout = run(
    'cargo',
    ['metadata', '--locked', '--format-version=1', '--no-deps', '--manifest-path', manifestPath],
    dirname(manifestPath),
  );
  return JSON.parse(stdout);
}

function manifestDeclaresLintPolicy(content) {
  return /^\s*\[lints(?:\.[^\]]+)?\]\s*(?:#.*)?$/m.test(content);
}

function missingLintPolicies(metadata) {
  const members = new Set(metadata.workspace_members ?? []);
  const packages = (metadata.packages ?? []).filter((pkg) => members.has(pkg.id));
  if (packages.length === 0) {
    fail('cargo metadata returned no workspace member packages');
  }

  return packages
    .filter((pkg) => !manifestDeclaresLintPolicy(readFileSync(pkg.manifest_path, 'utf8')))
    .map((pkg) => pkg.manifest_path)
    .sort();
}

function planCrossTargets(expectedTargets, installedTargets, mode) {
  if (!['local', 'strict'].includes(mode)) {
    fail(`--mode must be local or strict, got: ${mode}`);
  }
  const expected = [...new Set(expectedTargets)].sort();
  if (expected.length === 0) {
    fail('at least one expected target is required');
  }
  const installed = new Set(installedTargets);
  const selected = expected.filter((target) => installed.has(target));
  const missing = expected.filter((target) => !installed.has(target));
  if (mode === 'strict' && missing.length > 0) {
    fail(`required Rust targets are not installed: ${missing.join(', ')}`);
  }
  return { selected, missing };
}

function cargoFeatureArgs(options) {
  const features = [...new Set(options.features ?? [])].sort();
  if (options.allFeatures && (options.noDefaultFeatures || features.length > 0)) {
    fail('--all-features cannot be combined with --no-default-features or --features');
  }
  if (options.allFeatures) {
    return ['--all-features'];
  }

  const args = [];
  if (options.noDefaultFeatures) {
    args.push('--no-default-features');
  }
  if (features.length > 0) {
    args.push('--features', features.join(','));
  }
  return args;
}

function checkLintPolicy(options) {
  const missing = missingLintPolicies(loadMetadata(options));
  if (missing.length > 0) {
    for (const manifest of missing) {
      console.error(`NO LINT POLICY: ${manifest}`);
    }
    fail(`${missing.length} workspace member(s) have no [lints] policy`);
  }
  console.log('Rust lint policy: every workspace member declares [lints]');
}

function installedRustTargets() {
  return run('rustup', ['target', 'list', '--installed'], process.cwd())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function printTargetPlan(plan) {
  for (const target of plan.selected) {
    console.log(`LINT TARGET: ${target}`);
  }
  for (const target of plan.missing) {
    console.log(`SKIP TARGET: ${target}`);
  }
}

function checkCrossTargets(options, execute) {
  const mode = options.mode ?? 'strict';
  const installed = options.installed ?? installedRustTargets();
  const plan = planCrossTargets(options.targets, installed, mode);
  const featureArgs = cargoFeatureArgs(options);
  printTargetPlan(plan);

  if (!execute) {
    return;
  }
  if (mode === 'local' && plan.selected.length === 0) {
    console.log('No optional cross-target lint ran; install a listed target to enable it locally.');
    return;
  }

  const manifestPath = resolve(options.manifestPath ?? 'Cargo.toml');
  for (const target of plan.selected) {
    run(
      'cargo',
      [
        'clippy',
        '--locked',
        '--workspace',
        '--all-targets',
        ...featureArgs,
        '--manifest-path',
        manifestPath,
        '--target',
        target,
        '--',
        '-D',
        'warnings',
      ],
      dirname(manifestPath),
    );
  }
}

function usage() {
  return `Usage:
  check-rust-gate.mjs lint-policy [--manifest-path Cargo.toml]
  check-rust-gate.mjs cross-targets --mode strict|local --target <triple> [...]
    [--all-features | [--no-default-features] [--features <csv>]]
  check-rust-gate.mjs plan-cross-targets --mode strict|local --expected <csv> --installed <csv>

Use strict mode in CI. Local mode is discovery-only and may skip missing targets.`;
}

export { cargoFeatureArgs, manifestDeclaresLintPolicy, missingLintPolicies, planCrossTargets };

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const [command, ...args] = process.argv.slice(2);
    const options = parseOptions(args);
    if (command === 'lint-policy') {
      checkLintPolicy(options);
    } else if (command === 'cross-targets') {
      checkCrossTargets(options, true);
    } else if (command === 'plan-cross-targets') {
      if (!options.installed) {
        fail('plan-cross-targets requires --installed');
      }
      checkCrossTargets(options, false);
    } else {
      fail(usage());
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
