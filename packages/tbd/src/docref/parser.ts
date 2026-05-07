/**
 * docref/0.1 reference parser.
 *
 * This module is the canonical reference implementation of the docref
 * grammar defined in `packages/tbd/docs/design-docref-format.md`. The
 * spec and this implementation MUST stay in exact sync. Any change to
 * one requires a matching change to the other.
 *
 * Designed to be standalone — depends only on the language. Could be
 * extracted as its own package without modification.
 */

export type Docref =
  | { kind: 'path'; path: string; absolute: boolean; isDir: boolean }
  | { kind: 'scheme'; scheme: string; body: string };

export interface GitBody {
  rest: string;
  ref?: string;
  path?: string;
  isDir: boolean;
}

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+\-.]*):/;
const PATH_PREFIX_RE = /^(\/|\.\/|\.\.\/)/;

/**
 * Parse a docref into its structural components.
 *
 * Throws on syntactic mismatch (input matches no recognized form).
 * Unknown schemes are NOT errors — they're returned as `{kind: 'scheme'}`
 * and the consumer decides whether it can resolve them.
 *
 * The reserved fragment portion (`#...` onward) is silently dropped per
 * spec §"Reserved: fragment identifier".
 */
export function parseDocref(input: string): Docref {
  let s = input;
  const hashIdx = s.indexOf('#');
  if (hashIdx >= 0) s = s.slice(0, hashIdx);

  if (PATH_PREFIX_RE.test(s)) {
    return {
      kind: 'path',
      path: s,
      absolute: s.startsWith('/'),
      isDir: s.endsWith('/'),
    };
  }
  const m = SCHEME_RE.exec(s);
  if (m) {
    return {
      kind: 'scheme',
      scheme: m[1]!.toLowerCase(),
      body: s.slice(m[0].length),
    };
  }
  throw new Error(`Invalid docref: ${JSON.stringify(input)}`);
}

/**
 * Conventional sub-parser for git-style bodies: `<rest>[@<ref>][//<path>]`.
 *
 * Recommended for schemes following the convention (`github:`, `gitlab:`,
 * `git:`, future host-specific schemes). This is consumer logic, not part
 * of the core syntax — schemes that don't follow the convention parse
 * their body their own way.
 *
 * Disambiguation rules per spec:
 * - The `//<path>` separator is the first `//` not preceded by `:`,
 *   so embedded `scheme://authority` is treated as part of `<rest>`.
 * - The `@<ref>` separator is the LAST `@` in `<rest>` past any embedded
 *   scheme, disambiguating from `git@host` in SSH URLs.
 */
export function parseGitBody(body: string): GitBody {
  let pathIdx = -1;
  for (let i = 0; i + 1 < body.length; i++) {
    if (body[i] === '/' && body[i + 1] === '/' && (i === 0 || body[i - 1] !== ':')) {
      pathIdx = i;
      break;
    }
  }

  let rest = body;
  let path: string | undefined;
  let isDir = false;
  if (pathIdx >= 0) {
    const raw = body.slice(pathIdx + 2);
    rest = body.slice(0, pathIdx);
    isDir = raw.endsWith('/');
    path = isDir && raw.length > 0 ? raw.slice(0, -1) : raw;
  }

  const colonIdx = rest.indexOf(':');
  const refIdx = rest.lastIndexOf('@');
  let ref: string | undefined;
  if (refIdx >= 0 && refIdx > colonIdx) {
    ref = rest.slice(refIdx + 1);
    rest = rest.slice(0, refIdx);
  }

  return { rest, ref, path, isDir };
}
