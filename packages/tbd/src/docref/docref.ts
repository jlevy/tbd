/**
 * docref — a single-string, URI-like address for any document.
 *
 * This module is intentionally standalone and dependency-free (no tbd-internal
 * imports) so it can move to its own package later. It is the one address syntax
 * used everywhere a doc's source or location is named: config source strings, the
 * fork manifest's `source` field, `tbd docs add` arguments, and `local_dirs` entries.
 *
 * Supported forms:
 *   internal:guidelines/python-rules.md          bundled doc shipped inside tbd
 *   ./docs/general/                              in-repo path (local)
 *   /abs/path/file.md                            absolute local path
 *   https://example.com/style.md                 plain URL
 *   github:owner/repo@ref//path/to/file.md       git-hosted (also gitlab:, git:)
 *
 * Web URLs that point at a known git host are normalized to the `github:`/`gitlab:`
 * form so there is one canonical address for a given file:
 *   https://github.com/o/r/blob/main/f.md   -> github:o/r@main//f.md
 *   https://raw.githubusercontent.com/o/r/main/f.md -> github:o/r@main//f.md
 */

/** Scheme of a git-hosted docref. */
export type GitHost = 'github' | 'gitlab' | 'git';

/** A parsed document reference. */
export type DocRef =
  | { readonly kind: 'internal'; readonly path: string }
  | { readonly kind: 'local'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }
  | {
      readonly kind: 'git';
      readonly host: GitHost;
      readonly owner: string;
      readonly repo: string;
      readonly ref?: string;
      readonly path: string;
    };

/** Error thrown when a string is not a valid docref. */
export class DocRefError extends Error {
  constructor(
    public readonly input: string,
    detail: string,
  ) {
    super(`Invalid docref ${JSON.stringify(input)}: ${detail}`);
    this.name = 'DocRefError';
  }
}

const GIT_SCHEMES: readonly GitHost[] = ['github', 'gitlab', 'git'];

/** True for strings that address a local filesystem path rather than a scheme. */
function looksLocal(input: string): boolean {
  return (
    input.startsWith('./') ||
    input.startsWith('../') ||
    input.startsWith('/') ||
    input.startsWith('~/')
  );
}

/** Strip a single leading `./` for tidy comparison; other forms are left as-is. */
function tidyLocal(path: string): string {
  return path.startsWith('./') ? path.slice(2) : path;
}

/**
 * Parse a `host:owner/repo[@ref]//path` body (everything after the scheme).
 */
function parseGitBody(host: GitHost, body: string, input: string): DocRef {
  const sep = body.indexOf('//');
  if (sep === -1) {
    throw new DocRefError(input, `git docref must contain "//" separating repo from path`);
  }
  const repoPart = body.slice(0, sep);
  const path = body.slice(sep + 2);
  if (!path) {
    throw new DocRefError(input, 'git docref has an empty path');
  }

  const atIndex = repoPart.indexOf('@');
  const ownerRepo = atIndex === -1 ? repoPart : repoPart.slice(0, atIndex);
  const ref = atIndex === -1 ? undefined : repoPart.slice(atIndex + 1) || undefined;

  const slash = ownerRepo.indexOf('/');
  if (slash === -1) {
    throw new DocRefError(input, 'git docref must be "owner/repo"');
  }
  const owner = ownerRepo.slice(0, slash);
  const repo = ownerRepo.slice(slash + 1);
  if (!owner || !repo) {
    throw new DocRefError(input, 'git docref must be "owner/repo"');
  }

  return ref === undefined
    ? { kind: 'git', host, owner, repo, path }
    : { kind: 'git', host, owner, repo, ref, path };
}

/**
 * If `url` points at a known git host's file view, return the equivalent git
 * docref; otherwise return null (caller keeps it as a plain URL).
 */
function gitRefFromUrl(url: string): DocRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);

  // https://github.com/{owner}/{repo}/blob/{ref}/{path...}
  if (parsed.hostname === 'github.com' && segments[2] === 'blob' && segments.length >= 5) {
    const [owner, repo, , ref, ...rest] = segments;
    return { kind: 'git', host: 'github', owner: owner!, repo: repo!, ref, path: rest.join('/') };
  }
  // https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path...}
  if (parsed.hostname === 'raw.githubusercontent.com' && segments.length >= 4) {
    const [owner, repo, ref, ...rest] = segments;
    return { kind: 'git', host: 'github', owner: owner!, repo: repo!, ref, path: rest.join('/') };
  }
  // https://gitlab.com/{owner}/{repo}/-/blob/{ref}/{path...}
  if (parsed.hostname === 'gitlab.com' && segments[2] === '-' && segments[3] === 'blob') {
    const [owner, repo, , , ref, ...rest] = segments;
    if (owner && repo && ref && rest.length > 0) {
      return { kind: 'git', host: 'gitlab', owner, repo, ref, path: rest.join('/') };
    }
  }
  return null;
}

/**
 * Parse a docref string into a structured {@link DocRef}.
 * Throws {@link DocRefError} if the string is not a valid docref.
 */
export function parseDocRef(input: string): DocRef {
  const raw = input.trim();
  if (!raw) {
    throw new DocRefError(input, 'empty');
  }

  // Internal bundled docs.
  if (raw.startsWith('internal:')) {
    const path = raw.slice('internal:'.length);
    if (!path) {
      throw new DocRefError(input, 'internal docref has an empty path');
    }
    return { kind: 'internal', path };
  }

  // Git-hosted schemes.
  for (const host of GIT_SCHEMES) {
    const prefix = `${host}:`;
    if (raw.startsWith(prefix)) {
      return parseGitBody(host, raw.slice(prefix.length), input);
    }
  }

  // Web URLs — normalize known git hosts, otherwise keep as a plain URL.
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return gitRefFromUrl(raw) ?? { kind: 'url', url: raw };
  }

  // Local filesystem paths.
  if (looksLocal(raw)) {
    return { kind: 'local', path: raw };
  }

  // A scheme-less, non-URL string with no path markers is treated as a local
  // relative path (e.g. "guidelines/python-rules.md"). A stray scheme is rejected.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    throw new DocRefError(input, 'unknown scheme');
  }
  return { kind: 'local', path: raw };
}

/** Parse a docref, returning null instead of throwing on invalid input. */
export function tryParseDocRef(input: string): DocRef | null {
  try {
    return parseDocRef(input);
  } catch {
    return null;
  }
}

/** Serialize a {@link DocRef} back to its canonical string form. */
export function formatDocRef(ref: DocRef): string {
  switch (ref.kind) {
    case 'internal':
      return `internal:${ref.path}`;
    case 'local':
      return ref.path;
    case 'url':
      return ref.url;
    case 'git': {
      const refPart = ref.ref ? `@${ref.ref}` : '';
      return `${ref.host}:${ref.owner}/${ref.repo}${refPart}//${ref.path}`;
    }
  }
}

/**
 * Normalize a docref string to its canonical form (parse + re-format).
 * Rationalizes git web URLs into the `github:`/`gitlab:` scheme.
 */
export function normalizeDocRef(input: string): string {
  return formatDocRef(parseDocRef(input));
}

/** True if `input` parses as a valid docref. */
export function isDocRef(input: string): boolean {
  return tryParseDocRef(input) !== null;
}

/**
 * Whether two docrefs address the same document, ignoring a leading `./` on
 * local paths. Useful for de-duping config entries.
 */
export function docRefsEqual(a: DocRef, b: DocRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'local' && b.kind === 'local') {
    return tidyLocal(a.path) === tidyLocal(b.path);
  }
  return formatDocRef(a) === formatDocRef(b);
}
