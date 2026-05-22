#!/usr/bin/env node
/* global process, console, fetch */
/**
 * Enforce the 14-day package-age rule across the repo's package.json files.
 *
 * Walks the root package.json and every packages/<name>/package.json, looks up
 * the resolved-pinned version of each direct dependency on the npm registry,
 * and exits non-zero if any version was published fewer than COOLDOWN_DAYS
 * ago.
 *
 * See packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md#supply-chain-mitigation
 * for the policy.
 *
 * Usage:
 *   node scripts/check-package-age.mjs           # check, fail on violations
 *   node scripts/check-package-age.mjs --warn    # check, report only (exit 0)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const COOLDOWN_DAYS = 14;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const WARN_ONLY = process.argv.includes('--warn');

function findPackageJsons(root) {
  const found = [join(root, 'package.json')];
  const packagesDir = join(root, 'packages');
  try {
    for (const name of readdirSync(packagesDir)) {
      const p = join(packagesDir, name, 'package.json');
      try {
        if (statSync(p).isFile()) found.push(p);
      } catch {
        // not a file
      }
    }
  } catch {
    // no packages/ directory
  }
  return found;
}

function stripRange(spec) {
  // Strip leading range modifiers from a version range.
  return String(spec)
    .replace(/^[\^~=<>v\s]+/, '')
    .split(/[\s|]/)[0];
}

async function fetchPublishTime(name, version) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!res.ok) {
    throw new Error(`registry returned ${res.status} for ${name}`);
  }
  const meta = await res.json();
  return meta.time?.[version] ?? null;
}

async function main() {
  const now = Date.now();
  const cutoffIso = new Date(now - COOLDOWN_MS).toISOString();
  console.log(`Checking package age (rule: ≥${COOLDOWN_DAYS} days). Cutoff: ${cutoffIso}`);

  const pkgFiles = findPackageJsons(REPO_ROOT);
  let violations = 0;
  let checked = 0;
  let skipped = 0;

  for (const file of pkgFiles) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`✗ Failed to read ${file}: ${err.message}`);
      violations++;
      continue;
    }
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
      ...(pkg.optionalDependencies ?? {}),
    };
    const rel = file.replace(`${REPO_ROOT}/`, '');
    for (const [name, spec] of Object.entries(deps)) {
      const rawSpec = String(spec);
      if (
        rawSpec.startsWith('workspace:') ||
        rawSpec.startsWith('file:') ||
        rawSpec.startsWith('link:') ||
        rawSpec.startsWith('catalog:')
      ) {
        skipped++;
        continue;
      }
      const version = stripRange(rawSpec);
      if (!version || /[a-z]/i.test(version.split('-')[0])) {
        // e.g. 'latest', 'next', tag — can't check
        skipped++;
        continue;
      }
      try {
        const publishedAt = await fetchPublishTime(name, version);
        checked++;
        if (!publishedAt) {
          console.warn(`? ${rel}: ${name}@${version} — registry has no time for this version`);
          continue;
        }
        const ageMs = now - new Date(publishedAt).getTime();
        const ageDays = ageMs / 86_400_000;
        if (ageMs < COOLDOWN_MS) {
          console.error(
            `✗ ${rel}: ${name}@${version} is ${ageDays.toFixed(1)}d old (< ${COOLDOWN_DAYS}d) — published ${publishedAt}`,
          );
          violations++;
        }
      } catch (err) {
        console.warn(`? ${rel}: ${name}@${version} — registry lookup failed: ${err.message}`);
      }
    }
  }

  console.log(
    `\nResult: ${violations} violation(s), ${checked} pin(s) checked, ${skipped} skipped (workspace/tag/non-registry).`,
  );

  if (violations > 0) {
    if (WARN_ONLY) {
      console.warn(`(--warn given: exiting 0 despite ${violations} violation(s).)`);
      process.exit(0);
    }
    console.error(
      '\nFix: either upgrade to an older version that satisfies the 14-day rule, or document an exception in the upgrade commit/PR per the Supply-Chain Mitigation guideline.',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`check-package-age: ${err.stack ?? err.message ?? err}`);
  process.exit(2);
});
