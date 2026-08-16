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
 * One place to look for a spec, and the ref the resulting URL should name.
 *
 * The two differ whenever the authoritative copy is a remote-tracking ref: a
 * stale local `main` may not contain a spec that is already on the remote, so
 * `origin/main` answers the question while `main` is what belongs in the URL.
 */
export interface BranchCandidate {
  /** Git ref to inspect. */
  check: string;
  /** Ref to name in the URL, which a reader will open on the forge. */
  url: string;
}

/**
 * Find a branch that contains `path`, preferring the ones a reader would expect.
 *
 * Checks the candidates in order and returns the first that has the file. A
 * branch ref (rather than a commit sha) keeps the link current while work is in
 * flight; callers rewrite to a merge sha once the bead closes.
 *
 * Order matters more than it looks. Callers put the durable trunk first and the
 * working branch last, because a link is written into a tracker that outlives
 * the branch: naming the working branch produces a URL that dies the moment the
 * branch is deleted after merge, and — since the rendered link is part of the
 * managed block — changes the block on every sync run from a different branch,
 * rewriting the whole mirror for no reason. The working branch is still a
 * candidate, so a spec that exists nowhere else stays linkable while in flight;
 * the next sync after the merge moves the link to the trunk on its own.
 */
export async function findBranchContaining(
  repoDir: string,
  path: string,
  candidates: readonly BranchCandidate[],
): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      const output = await git(
        '-C',
        repoDir,
        'ls-tree',
        '--name-only',
        candidate.check,
        '--',
        path,
      );
      if (output.trim().length > 0) {
        return candidate.url;
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
  /** Branches to try, in preference order: durable trunk first, working branch last. */
  candidates: readonly BranchCandidate[];
}

/**
 * Resolve a permalink for a bead's spec, or undefined when no candidate branch
 * contains it.
 */
export async function specPermalink(options: SpecPermalinkOptions): Promise<string | undefined> {
  const branch = await findBranchContaining(options.repoDir, options.specPath, options.candidates);
  return branch ? blobUrl(options.slug, branch, options.specPath) : undefined;
}
