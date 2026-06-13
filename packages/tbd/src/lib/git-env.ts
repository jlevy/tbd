/**
 * Ambient-git-environment isolation for every git subprocess tbd spawns.
 *
 * tbd is a repo-local tool: it discovers its `.tbd` root by walking up from
 * cwd, so its git context must come from cwd too. But git exports GIT_DIR
 * (and related vars) into hook environments (always, when a hook runs) and
 * an inherited *absolute* GIT_DIR overrides cwd-based discovery in every git
 * child process, `-C <dir>` included. A user running tbd inside any git hook
 * (post-merge, pre-push, …) would otherwise have tbd resolve the hook's
 * repository instead of cwd's and read/write the WRONG repo's tbd data; this
 * is the product-level half of the tbd-a1lc incident (tracked as tbd-tgwi),
 * where exactly that path rewrote a real repo's data-sync state.
 *
 * Policy: tbd always operates on the repository containing cwd. Git location
 * variables are stripped from every git subprocess, and a one-line warning is
 * printed (once per process) when an ambient GIT_DIR was present, so anyone
 * setting it intentionally learns it does not redirect tbd.
 *
 * The same variable list is used by tests/scrub-git-env.ts (vitest worker
 * hygiene) and mirrored in scripts/scrub-git-env.mjs (lefthook wrapper).
 */

/** Environment variables through which git overrides cwd-based discovery. */
export const GIT_LOCATION_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
] as const;

let warnedAmbientGitDir = false;

/**
 * A copy of process.env with git location variables removed (plus optional
 * overrides), for use as the `env` of any spawned git process. Emits the
 * one-time ambient-GIT_DIR warning as a side effect of first use.
 */
export function gitSafeEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  warnIfAmbientGitEnv();
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const name of GIT_LOCATION_VARS) {
    delete env[name];
  }
  return env;
}

/**
 * Warn once per process when an ambient GIT_DIR/GIT_WORK_TREE is being
 * ignored. Stderr keeps piped stdout clean; once keeps hooks readable.
 */
export function warnIfAmbientGitEnv(): void {
  if (warnedAmbientGitDir) return;
  const ambient = process.env.GIT_DIR ?? process.env.GIT_WORK_TREE;
  if (ambient === undefined) return;
  warnedAmbientGitDir = true;
  process.stderr.write(
    `(ignoring inherited GIT_DIR: tbd operates on the repository containing the current directory)\n`,
  );
}
