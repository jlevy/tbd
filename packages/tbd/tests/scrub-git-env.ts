/**
 * Vitest per-worker setup: strip inherited git-location environment variables
 * before any test spawns a subprocess.
 *
 * Tests create throwaway git repos in temp dirs and run `git` / the tbd CLI with
 * `cwd` set there, relying on git and tbd discovering the repo from `cwd`. But git
 * exports GIT_DIR (and friends) into hook environments: running `git push` from a
 * linked worktree invokes the pre-push test suite with GIT_DIR pointing at the
 * real repository's gitdir. An absolute GIT_DIR overrides cwd-based discovery, so a
 * fixture's `git init` / `commit` / `checkout -b` and tbd's `--git-common-dir`
 * resolution would all operate on the REAL repo — rewriting its branches and
 * corrupting its data-sync worktree. (Running vitest directly never set GIT_DIR,
 * which is why only hook-invoked runs were affected.)
 *
 * Deleting these here, once per worker before any test, makes every
 * `{ ...process.env }` spawn in the suite safe regardless of how the runner was
 * invoked. The pre-push hook also scrubs them (see lefthook.yml) as defense in
 * depth; either layer alone closes the hole, but both are cheap.
 */
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

for (const name of GIT_LOCATION_VARS) {
  delete process.env[name];
}
