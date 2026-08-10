/**
 * Permalinks to repository files for mirrored beads.
 *
 * `spec_path` names a file that may exist on only some branches: specs are
 * authored on the branch doing the work and reach `main` only when it merges. A
 * mirrored link built from the bare path therefore 404s depending on who follows
 * it and when, so links are resolved against a branch that actually contains the
 * file.
 */

import { git } from '../../file/git.js';

/** Parsed `owner/repo` for a GitHub remote. */
export interface RepoSlug {
  owner: string;
  repo: string;
}

/**
 * Parse a GitHub remote URL into `owner/repo`.
 *
 * Handles both SSH (`git@github.com:owner/repo.git`) and HTTPS forms. Returns
 * undefined for anything else: a non-GitHub remote is a normal state and simply
 * means no permalinks.
 */
export function parseRepoSlug(remoteUrl: string): RepoSlug | undefined {
  const cleaned = remoteUrl.trim().replace(/\.git$/, '');
  const match =
    /^git@[^:]+:([^/]+)\/(.+)$/.exec(cleaned) ?? /^https?:\/\/[^/]+\/([^/]+)\/(.+)$/.exec(cleaned);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!owner || !repo) {
    return undefined;
  }
  return { owner, repo };
}

/**
 * Build a GitHub blob permalink.
 */
export function blobUrl(slug: RepoSlug, ref: string, path: string): string {
  return `https://github.com/${slug.owner}/${slug.repo}/blob/${ref}/${path}`;
}

/**
 * Find a branch that contains `path`, preferring the ones a reader would expect.
 *
 * Checks the candidates in order and returns the first that has the file. A
 * branch ref (rather than a commit sha) keeps the link current while work is in
 * flight; callers rewrite to a merge sha once the bead closes.
 */
export async function findBranchContaining(
  repoDir: string,
  path: string,
  candidates: readonly string[],
): Promise<string | undefined> {
  for (const branch of candidates) {
    try {
      const output = await git('-C', repoDir, 'ls-tree', '--name-only', branch, '--', path);
      if (output.trim().length > 0) {
        return branch;
      }
    } catch {
      // A missing branch is not an error here: try the next candidate.
    }
  }
  return undefined;
}

export interface SpecPermalinkOptions {
  repoDir: string;
  specPath: string;
  slug: RepoSlug;
  /** Branches to try, in preference order (e.g. current branch, then main). */
  candidates: readonly string[];
}

/**
 * Resolve a permalink for a bead's spec, or undefined when no candidate branch
 * contains it.
 */
export async function specPermalink(options: SpecPermalinkOptions): Promise<string | undefined> {
  const branch = await findBranchContaining(options.repoDir, options.specPath, options.candidates);
  return branch ? blobUrl(options.slug, branch, options.specPath) : undefined;
}
