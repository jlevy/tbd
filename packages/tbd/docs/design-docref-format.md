# docref Format

Last updated: 2026-05-07

Version: `docref/0.1` (draft)

## Overview

A **docref** is a single-string grammar for addressing a resource — a local file or
directory, a web URL, a path within a git repo, or any other resource a consumer can
resolve. The grammar is URI-like but admits bare filesystem paths in addition to
scheme-prefixed forms, following npm’s “package specifier” tradition rather than strict
RFC 3986 URI syntax.

This is a minimal specification.
It defines only how to **parse** a docref into structured components — not how to fetch
or resolve them. Consumers (notably docmap, see
[design-docmap-format.md](./design-docmap-format.md)) decide which schemes they support
and what the components mean.
Unknown schemes are not parse errors; they’re consumer-resolution errors.

## Grammar

A docref is one of two forms.

### Filesystem paths

A docref starting with `/`, `./`, or `../` is a filesystem path:

- `/abs/path/to/file.md` — absolute path
- `./relative/path/` — relative to consumer’s base directory
- `../sibling/file.md` — relative parent traversal
- Trailing `/` indicates a directory; no trailing `/` indicates a file

Bare relative paths without a leading `./` (`foo/bar.md`) are not docrefs.
This disambiguation lets consumers tell docrefs from non-docref strings.

### Scheme-prefixed references

A docref matching `^[a-z][a-z0-9+\-.]*:` is a scheme-prefixed reference.
The text before the first `:` is the **scheme**; everything after is the **body**.
Schemes are normalized to lowercase.

The grammar does **not** enumerate valid schemes.
Consumers decide which they support; an unknown scheme produces a consumer error ("can’t
fetch `s3:...`"), not a parse error.
New host integrations can be added by consumers with no spec change.

```
github:jlevy/coding-guidelines@main//src/foo.md
└────┘ scheme = "github"
       └─────────────────────────────────────┘ body
```

### Git-style body convention (informative)

Many schemes pointing at git-hosted content (`github:`, `gitlab:`, `git:`, future
`bitbucket:`, `codeberg:`, etc.)
follow a common body shape:

```
<rest>[@<ref>][//<path>]
```

Where:

- `<ref>` is a git branch / tag / commit (optional)
- `<path>` is a path within the resource (optional; trailing `/` for directories)

This is a **convention**, not a spec rule.
Consumers parse the body per their own scheme’s needs.
Schemes that follow the same shape need no spec change to be added.

Examples:

```
github:jlevy/coding-guidelines                            # repo, default branch
github:jlevy/coding-guidelines@main                       # pinned to branch
github:jlevy/coding-guidelines@v1.2.0                     # pinned to tag
github:jlevy/coding-guidelines@main//guidelines/ts.md     # specific file
gitlab:my-group/my-subgroup/my-project@main//docs/        # nested-group GitLab
git:https://self-hosted.example.com/org/repo.git@main     # arbitrary git remote
git:git@host.example.com:org/repo.git@main//src/          # SSH-style remote
```

When a body itself contains a colon-delimited URL (e.g., `git:` wrapping an HTTPS or SSH
remote), the conventional parsing rules disambiguate:

- The `@<ref>` separator is the **last** `@` in the body that follows any embedded
  scheme — disambiguates from `git@host` in SSH URLs.
- The `//<path>` separator is the first `//` not preceded by `:` — skips embedded
  `scheme://authority`.

### Input normalization (informative)

Implementations may normalize common URL forms to canonical docref form for stability
and readability. Examples:

| Input | Canonical |
| --- | --- |
| `https://github.com/o/r` | `github:o/r` |
| `https://github.com/o/r/tree/main/src` | `github:o/r@main//src/` |
| `https://github.com/o/r/blob/main/README.md` | `github:o/r@main//README.md` |
| `git@github.com:o/r.git` | `github:o/r` |
| `https://gitlab.com/o/r` | `gitlab:o/r` |
| `https://gitlab.com/o/r/-/tree/main/src` | `gitlab:o/r@main//src/` |

Normalization rules are consumer-scoped: a tool can choose to recognize and rewrite any
URL forms it knows about, or pass them through verbatim.

### Reserved: fragment identifier (`#`)

The `#` character is reserved for future fragment-identifier syntax (addressing content
within a doc — section anchors, line ranges, etc.). In v0.1, anything from `#` onward is
silently dropped on parse, matching URI-client convention for unrecognized fragment
grammars.

Literal `#` in paths or refs must be percent-encoded as `%23`.

### Authentication

The grammar does not encode credentials.
Consumers delegate to the underlying transport’s auth (git credential helpers, `gh` CLI,
HTTP client config, etc.). There is no auth field, ever.

## Reference Implementation

The canonical, runnable reference is the `docref` module in this repo:

- Source: [`packages/tbd/src/docref/parser.ts`](../src/docref/parser.ts)
- Module entry: [`packages/tbd/src/docref/index.ts`](../src/docref/index.ts)
- Tests: [`packages/tbd/tests/docref-parser.test.ts`](../tests/docref-parser.test.ts)

The module is standalone — depends only on the language.
It can be extracted as its own package or repo without modification.

**Synchrony.** The spec and the reference module must stay in exact sync.
The test file covers every example in this spec; if a spec example is added or changed,
the corresponding test case must be updated, and vice versa.

The exported surface:

```typescript
export type Docref =
  | { kind: 'path'; path: string; absolute: boolean; isDir: boolean }
  | { kind: 'scheme'; scheme: string; body: string };

export interface GitBody {
  rest: string;
  ref?: string;
  path?: string;
  isDir: boolean;
}

/** Parse a docref into its structural components.
 *  Throws on syntactic mismatch only — unknown schemes are NOT errors. */
export function parseDocref(input: string): Docref;

/** Convention for git-style bodies: <rest>[@<ref>][//<path>]. */
export function parseGitBody(body: string): GitBody;
```

## Used by

- **docmap** ([design-docmap-format.md](./design-docmap-format.md)) declares an ordered
  list of sources by docref, and builds a syncable, addressable index of their contents.
- Any consumer that wants a single-string grammar for addressing resources can use
  docref without depending on docmap.

<!-- This document follows std-doc-guidelines.md.
Review guidelines before editing.
-->
