#!/usr/bin/env node
/* global console */
// @ts-check

/**
 * Enforce Rust quality-gate contracts that are easy to implement incorrectly in shell.
 *
 * The commands verify that every Cargo workspace member declares a lint policy and
 * that the required cross-compilation targets are present before running Clippy. Local
 * mode reports unavailable targets as explicit skips; strict CI mode rejects any skip.
 *
 * This file remains dependency-free JavaScript because tbd copies it into Rust and
 * polyglot projects that may not compile TypeScript. It is checked as strictly typed
 * JavaScript in the tbd repository. The narrow parser avoids making Commander.js a
 * runtime requirement for projects that use only this reference helper.
 *
 * Successful plans and results go to stdout. Diagnostics go to stderr. Invalid command
 * usage exits 2; a failed gate or child process exits 1.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @typedef {'local' | 'strict'} GateMode */

/**
 * @typedef {object} CliOptions
 * @property {string | undefined} manifestPath Cargo manifest used for metadata or Clippy.
 * @property {string | undefined} metadataFile Precomputed Cargo metadata used by tests.
 * @property {string | undefined} mode Strict CI enforcement or local target discovery.
 * @property {string[]} targets Rust target triples required by the support contract.
 * @property {string[] | undefined} installed Explicit installed-target set used by plan tests.
 * @property {boolean} allFeatures Whether Cargo should enable every feature.
 * @property {boolean} noDefaultFeatures Whether Cargo should disable default features.
 * @property {string[]} features Named Cargo features to enable.
 * @property {boolean} help Whether to print command help without running a gate.
 */

/** @typedef {{ id: string, manifest_path: string }} CargoPackage */

/**
 * @typedef {object} CargoMetadata
 * @property {string[]} workspace_members Cargo package IDs included in the workspace.
 * @property {CargoPackage[]} packages Packages returned by `cargo metadata`.
 */

/**
 * @typedef {object} CrossTargetPlan
 * @property {string[]} selected Required targets available on this runner.
 * @property {string[]} missing Required targets unavailable on this runner.
 */

/** Exit statuses distinguish invalid invocation from a gate that ran and failed. */
const EXIT_STATUS = Object.freeze({
  success: 0,
  operationalFailure: 1,
  usageError: 2,
});

/** Invalid CLI input that should return the conventional usage-error status. */
class UsageError extends Error {}

/**
 * Stop a gate after an operational or contract failure.
 *
 * @param {string} message User-visible failure with enough context to locate the cause.
 * @returns {never}
 */
function fail(message) {
  throw new Error(message);
}

/**
 * Stop before running a gate because the command line is invalid.
 *
 * @param {string} message Specific option or command defect.
 * @returns {never}
 */
function failUsage(message) {
  throw new UsageError(message);
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {string} value */
function splitCsv(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Read the value following an option and reject a missing value at the parser boundary.
 *
 * @param {string[]} args
 * @param {number} index
 * @param {string} option
 */
function nextOptionValue(args, index, option) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    failUsage(`${option} requires a value`);
  }
  return value;
}

/**
 * Parse the dependency-free command surface into one explicit option record.
 *
 * @param {string[]} args Arguments after the subcommand.
 * @returns {CliOptions}
 */
function parseOptions(args) {
  /** @type {CliOptions} */
  const options = {
    manifestPath: undefined,
    metadataFile: undefined,
    mode: undefined,
    targets: [],
    installed: undefined,
    allFeatures: false,
    noDefaultFeatures: false,
    features: [],
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === undefined) {
      fail('argument traversal exceeded the parsed command line');
    }

    switch (option) {
      case '--manifest-path':
        options.manifestPath = nextOptionValue(args, index, option);
        index += 1;
        break;
      case '--metadata-file':
        options.metadataFile = nextOptionValue(args, index, option);
        index += 1;
        break;
      case '--mode':
        options.mode = nextOptionValue(args, index, option);
        index += 1;
        break;
      case '--target':
        options.targets.push(nextOptionValue(args, index, option));
        index += 1;
        break;
      case '--expected':
        options.targets.push(...splitCsv(nextOptionValue(args, index, option)));
        index += 1;
        break;
      case '--installed':
        options.installed = splitCsv(nextOptionValue(args, index, option));
        index += 1;
        break;
      case '--all-features':
        options.allFeatures = true;
        break;
      case '--no-default-features':
        options.noDefaultFeatures = true;
        break;
      case '--features':
        options.features.push(...splitCsv(nextOptionValue(args, index, option)));
        index += 1;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        failUsage(`unknown option: ${option}`);
    }
  }
  return options;
}

/**
 * Run one required tool without a shell and preserve its stdout or failure diagnostics.
 *
 * @param {string} command Executable resolved by the caller's pinned toolchain.
 * @param {string[]} args Argument array passed without shell interpolation.
 * @param {string} cwd Working directory for the child process.
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status === null) {
    fail(`${command} terminated by ${result.signal ?? 'an unknown signal'}`);
  }
  if (result.status !== EXIT_STATUS.success) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`${command} exited ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

/** @param {unknown} value @returns {value is string[]} */
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Parse and validate only the Cargo metadata fields this gate trusts.
 *
 * JSON is untyped input even under `checkJs`; validating here prevents malformed or
 * partial metadata from becoming an empty, falsely passing workspace.
 *
 * @param {string} content
 * @param {string} source Description of the file or command that produced the JSON.
 * @returns {CargoMetadata}
 */
function parseCargoMetadata(content, source) {
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    fail(`failed to parse Cargo metadata from ${source}: ${errorMessage(error)}`);
  }

  if (!isRecord(parsed)) {
    fail(`Cargo metadata from ${source} must be a JSON object`);
  }

  const workspaceMembers = parsed.workspace_members;
  if (!isStringArray(workspaceMembers)) {
    fail(`Cargo metadata from ${source} has no string workspace_members array`);
  }

  const packageValues = parsed.packages;
  if (!Array.isArray(packageValues)) {
    fail(`Cargo metadata from ${source} has no packages array`);
  }

  const packages = packageValues.map((value, index) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.manifest_path !== 'string'
    ) {
      fail(`Cargo metadata from ${source} has an invalid package at index ${index}`);
    }
    return { id: value.id, manifest_path: value.manifest_path };
  });

  return { workspace_members: workspaceMembers, packages };
}

/**
 * Load Cargo metadata from an injected fixture or from the requested manifest.
 *
 * @param {CliOptions} options
 * @returns {CargoMetadata}
 */
function loadMetadata(options) {
  if (options.metadataFile) {
    const metadataFile = resolve(options.metadataFile);
    return parseCargoMetadata(readFileSync(metadataFile, 'utf8'), metadataFile);
  }

  const manifestPath = resolve(options.manifestPath ?? 'Cargo.toml');
  const stdout = run(
    'cargo',
    ['metadata', '--locked', '--format-version=1', '--no-deps', '--manifest-path', manifestPath],
    dirname(manifestPath),
  );
  return parseCargoMetadata(stdout, 'cargo metadata');
}

/** @param {string} content */
function manifestDeclaresLintPolicy(content) {
  return /^\s*\[lints(?:\.[^\]]+)?\]\s*(?:#.*)?$/m.test(content);
}

/**
 * Return each workspace manifest that lacks a `[lints]` or `[lints.*]` table.
 *
 * An empty workspace is rejected here because an empty result must not make this gate
 * indistinguishable from a fully checked workspace.
 *
 * @param {CargoMetadata} metadata
 */
function missingLintPolicies(metadata) {
  const members = new Set(metadata.workspace_members);
  const packages = metadata.packages.filter((pkg) => members.has(pkg.id));
  if (packages.length === 0) {
    fail('cargo metadata returned no workspace member packages');
  }

  return packages
    .filter((pkg) => !manifestDeclaresLintPolicy(readFileSync(pkg.manifest_path, 'utf8')))
    .map((pkg) => pkg.manifest_path)
    .sort();
}

/** @param {string} value @returns {value is GateMode} */
function isGateMode(value) {
  return value === 'local' || value === 'strict';
}

/**
 * Select installed required targets and enforce the strict-versus-local skip contract.
 *
 * @param {string[]} expectedTargets Targets promised by the project's support policy.
 * @param {string[]} installedTargets Targets reported by rustup on this runner.
 * @param {string} mode
 * @returns {CrossTargetPlan}
 */
function planCrossTargets(expectedTargets, installedTargets, mode) {
  if (!isGateMode(mode)) {
    failUsage(`--mode must be local or strict, got: ${mode}`);
  }
  const expected = [...new Set(expectedTargets)].sort();
  if (expected.length === 0) {
    failUsage('at least one expected target is required');
  }
  const installed = new Set(installedTargets);
  const selected = expected.filter((target) => installed.has(target));
  const missing = expected.filter((target) => !installed.has(target));
  if (mode === 'strict' && missing.length > 0) {
    fail(`required Rust targets are not installed: ${missing.join(', ')}`);
  }
  return { selected, missing };
}

/**
 * Build the exact Cargo feature arguments for one declared support combination.
 *
 * @param {CliOptions} options
 */
function cargoFeatureArgs(options) {
  const features = [...new Set(options.features)].sort();
  if (options.allFeatures && (options.noDefaultFeatures || features.length > 0)) {
    failUsage('--all-features cannot be combined with --no-default-features or --features');
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

/**
 * Verify that every Cargo workspace member opts into an explicit lint policy.
 *
 * @param {CliOptions} options
 */
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

/** Return rustup's installed target set; command failures remain gate failures. */
function installedRustTargets() {
  return run('rustup', ['target', 'list', '--installed'], process.cwd())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Print every selected target and every local-mode skip for an auditable gate log.
 *
 * @param {CrossTargetPlan} plan
 */
function printTargetPlan(plan) {
  for (const target of plan.selected) {
    console.log(`LINT TARGET: ${target}`);
  }
  for (const target of plan.missing) {
    console.log(`SKIP TARGET: ${target}`);
  }
}

/**
 * Plan required cross targets and optionally execute Clippy for every selected target.
 *
 * @param {CliOptions} options
 * @param {boolean} execute False for the deterministic planning command used in tests.
 */
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

/** Complete command and option help for this standalone gate helper. */
function usage() {
  return `Usage:
  check-rust-gate.mjs lint-policy [--manifest-path <Cargo.toml>]
    [--metadata-file <cargo-metadata.json>]
  check-rust-gate.mjs cross-targets --mode strict|local --target <triple> [...]
    [--all-features | [--no-default-features] [--features <csv>]]
  check-rust-gate.mjs plan-cross-targets --mode strict|local
    --expected <csv> --installed <csv>

Commands:
  lint-policy        Fail unless every workspace member declares a [lints] policy.
  cross-targets      Plan targets, then run Clippy once for every selected target.
  plan-cross-targets Print the target plan without invoking Cargo; intended for tests.

Options:
  --mode <mode>           strict rejects missing targets; local reports explicit skips.
  --target <triple>       Add one required target from the project's support contract.
  --expected <csv>        Add required targets to the planning-only command.
  --installed <csv>       Supply installed targets to the planning-only command.
  --manifest-path <path>  Select the Cargo manifest; defaults to ./Cargo.toml.
  --metadata-file <path>  Read saved Cargo metadata instead of invoking Cargo.
  --all-features          Run the supported all-feature combination.
  --no-default-features   Disable Cargo's default features for this combination.
  --features <csv>        Enable the named feature combination.
  --help                  Print this help and exit successfully.

Exit status:
  0  The requested plan or gate completed successfully.
  1  A gate contract, input file, or required child process failed.
  2  Invalid command usage exits before any gate runs.

Use strict mode in CI. Local mode is discovery-only and may skip missing targets.`;
}

/**
 * Dispatch exactly one gate command after parsing and validating its options.
 *
 * @param {string[]} args User arguments after the Node executable and script path.
 */
function main(args) {
  const [command, ...optionArgs] = args;
  if (command === undefined || command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }

  const options = parseOptions(optionArgs);
  if (options.help) {
    console.log(usage());
    return;
  }

  switch (command) {
    case 'lint-policy':
      checkLintPolicy(options);
      break;
    case 'cross-targets':
      checkCrossTargets(options, true);
      break;
    case 'plan-cross-targets':
      if (!options.installed) {
        failUsage('plan-cross-targets requires --installed');
      }
      checkCrossTargets(options, false);
      break;
    default:
      failUsage(`unknown command: ${command}\n\n${usage()}`);
  }
}

export { cargoFeatureArgs, manifestDeclaresLintPolicy, missingLintPolicies, planCrossTargets };

const entryPath = process.argv[1];
if (entryPath && resolve(entryPath) === resolve(fileURLToPath(import.meta.url))) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode =
      error instanceof UsageError ? EXIT_STATUS.usageError : EXIT_STATUS.operationalFailure;
  }
}
