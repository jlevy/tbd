/**
 * docref: a single-string, URI-like address for any document.
 *
 * This module is intentionally standalone and dependency-free (no tbd-internal
 * imports) so it can move to its own package later. It is the one address syntax
 * used everywhere a doc's source or location is named: config source strings, the
 * fork manifest's `source` field, `tbd docs add` arguments, and `local_dirs` entries.
 *
 * Supported forms (docref v0.1):
 *   internal:guidelines/python-rules.md       bundled doc shipped inside the consuming
 *                                             tool (app-relative, not tbd-specific)
 *   ./docs/general/   ../shared/   /abs/f.md  local paths; must be anchored with
 *                                             "./", "../", "/", or a Windows drive
 *                                             letter (C:/ or C:\)
 *   https://example.com/style.md              plain URL
 *   github:owner/repo@ref//path/to/file.md    git-hosted (also gitlab:)
 *   github:owner/repo@ref//file.md#section    optional fragment, preserved
 *
 * The grammar is deliberately strict: bare relative strings ("guidelines/x.md") and
 * home-relative paths ("~/x.md") are NOT valid docrefs. Consumers that want lenient
 * input may coerce at their own boundary (e.g. prepend "./") before parsing; a
 * strict grammar plus lenient consumers composes; the reverse cannot be tightened.
 *
 * Additional protocols (for example a host-bearing git scheme for forges beyond
 * GitHub/GitLab) may be added in future versions.
 *
 * Web URLs that point at a known git host are normalized to the `github:`/`gitlab:`
 * form so there is one canonical address for a given file:
 *   https://github.com/o/r/blob/main/f.md   -> github:o/r@main//f.md
 *   https://raw.githubusercontent.com/o/r/main/f.md -> github:o/r@main//f.md
 */

/** Scheme of a git-hosted docref. */
export type GitHost = 'github' | 'gitlab';

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
      /** Optional in-document anchor (e.g. a heading slug), preserved verbatim. */
      readonly fragment?: string;
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

const GIT_SCHEMES: readonly GitHost[] = ['github', 'gitlab'];

/**
 * True for strings that address a local filesystem path: anchored relative
 * (`./`, `../`), absolute (`/`), or a Windows drive-letter path (`C:/`, `C:\`).
 */
function looksLocal(input: string): boolean {
  return (
    input.startsWith('./') ||
    input.startsWith('../') ||
    input.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(input)
  );
}

/** Strip a single leading `./` for tidy comparison; other forms are left as-is. */
function tidyLocal(path: string): string {
  return path.startsWith('./') ? path.slice(2) : path;
}

/**
 * Parse a `host:owner/repo[@ref]//path[#fragment]` body (everything after the scheme).
 */
function parseGitBody(host: GitHost, body: string, input: string): DocRef {
  const sep = body.indexOf('//');
  if (sep === -1) {
    throw new DocRefError(input, `git docref must contain "//" separating repo from path`);
  }
  const repoPart = body.slice(0, sep);
  const pathPart = body.slice(sep + 2);

  const hashIndex = pathPart.indexOf('#');
  const path = hashIndex === -1 ? pathPart : pathPart.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? undefined : pathPart.slice(hashIndex + 1) || undefined;
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

  return {
    kind: 'git',
    host,
    owner,
    repo,
    path,
    ...(ref !== undefined ? { ref } : {}),
    ...(fragment !== undefined ? { fragment } : {}),
  };
}

/**
 * If `url` points at a known git host's file view, return the equivalent git
 * docref; otherwise return null (caller keeps it as a plain URL).
 * URL fragments are preserved; normalization must never silently drop data.
 */
function gitRefFromUrl(url: string): DocRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  const fragment = parsed.hash ? parsed.hash.slice(1) || undefined : undefined;
  const frag = fragment !== undefined ? { fragment } : {};

  // https://github.com/{owner}/{repo}/blob/{ref}/{path...}
  if (parsed.hostname === 'github.com' && segments[2] === 'blob' && segments.length >= 5) {
    const [owner, repo, , ref, ...rest] = segments;
    return {
      kind: 'git',
      host: 'github',
      owner: owner!,
      repo: repo!,
      ref,
      path: rest.join('/'),
      ...frag,
    };
  }
  // https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path...}
  if (parsed.hostname === 'raw.githubusercontent.com' && segments.length >= 4) {
    const [owner, repo, ref, ...rest] = segments;
    return {
      kind: 'git',
      host: 'github',
      owner: owner!,
      repo: repo!,
      ref,
      path: rest.join('/'),
      ...frag,
    };
  }
  // https://gitlab.com/{owner}/{repo}/-/blob/{ref}/{path...}
  if (parsed.hostname === 'gitlab.com' && segments[2] === '-' && segments[3] === 'blob') {
    const [owner, repo, , , ref, ...rest] = segments;
    if (owner && repo && ref && rest.length > 0) {
      return { kind: 'git', host: 'gitlab', owner, repo, ref, path: rest.join('/'), ...frag };
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

  // Web URLs: normalize known git hosts, otherwise keep as a plain URL.
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return gitRefFromUrl(raw) ?? { kind: 'url', url: raw };
  }

  // Local filesystem paths (anchored; includes Windows drive letters).
  if (looksLocal(raw)) {
    return { kind: 'local', path: raw };
  }

  if (raw.startsWith('~')) {
    throw new DocRefError(
      input,
      'home-relative (~) paths are not supported; use an absolute or ./-relative path',
    );
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    throw new DocRefError(input, 'unknown scheme');
  }
  throw new DocRefError(
    input,
    'local paths must start with "./", "../", or "/" (bare relative paths are not valid docrefs)',
  );
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
      const fragPart = ref.fragment ? `#${ref.fragment}` : '';
      return `${ref.host}:${ref.owner}/${ref.repo}${refPart}//${ref.path}${fragPart}`;
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
 * local paths. Comparison is purely syntactic; no case normalization of hosts
 * or owners. Useful for de-duping config entries.
 */
export function docRefsEqual(a: DocRef, b: DocRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'local' && b.kind === 'local') {
    return tidyLocal(a.path) === tidyLocal(b.path);
  }
  return formatDocRef(a) === formatDocRef(b);
}
