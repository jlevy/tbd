#!/usr/bin/env node
/* global process, console */
/**
 * Run a command line with git's repo-location environment variables removed.
 *
 * Git exports GIT_DIR (and related vars) into hook environments — notably,
 * `git push` from a linked worktree runs the pre-push hook with GIT_DIR pointing
 * at the real repository's gitdir. Any git or tbd subprocess spawned by the
 * hook's commands inherits it, and an absolute GIT_DIR overrides cwd-based repo
 * discovery: test fixtures that `git init` in temp dirs then commit, branch, and
 * corrupt data against the REAL repository instead. This destroyed local refs
 * and the tbd data-sync mappings in one incident (tbd-a1lc).
 *
 * Usage (from lefthook.yml): node scripts/scrub-git-env.mjs <command line...>
 * Arguments are joined with spaces and run through the platform shell — the same
 * semantics as lefthook's own `run:` line, minus the git location env.
 *
 * The vitest suite also self-scrubs (packages/tbd/tests/scrub-git-env.ts);
 * this wrapper protects every other current or future hook command the same way.
 */

import { spawnSync } from 'node:child_process';

const GIT_LOCATION_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
];

const commandLine = process.argv.slice(2).join(' ');
if (!commandLine) {
  console.error('usage: scrub-git-env.mjs <command line...>');
  process.exit(2);
}

const env = { ...process.env };
for (const name of GIT_LOCATION_VARS) {
  delete env[name];
}

const result = spawnSync(commandLine, { stdio: 'inherit', env, shell: true });
process.exit(result.status ?? 1);
