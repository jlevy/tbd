# docref Format

Last updated: 2026-05-07

## Overview

A **docref** is a single-string grammar for addressing a knowledge
resource—a local file or directory, a web URL, or a path within a
git repository.

The grammar is URI-like but admits bare filesystem paths in addition
to URI-shaped schemed forms, following npm's "package specifier"
tradition rather than strict RFC 3986 URI syntax.

This is a **minimal specification**. It defines only the
docref string grammar—not how to fetch, cache, index, or resolve the
resources docrefs point at. It is small enough to be implemented in a
few hundred lines of code and could live as its own tiny library or
repo. Higher-level systems (notably **docmap**—see
[design-docmap-format.md](./design-docmap-format.md)) build addressing,
sync, indexing, and retrieval semantics on top.

**Scope:** the docref string grammar, normalization rules, and the
reservation of the fragment-identifier syntax for future extension.
Everything else (manifest, lockfile, indexing, resolution algorithms,
CLI surface) belongs to docmap or some other consumer.

## Versioning

The current version is `docref/0.1`. Consumers using docrefs should
record the version they target in their own metadata (e.g., in a
docmap manifest, or in tool-specific config).

Versioning rules:

- Minor bumps (`0.2`, `0.3`) add new schemes or normalization rules
  without breaking existing docrefs.
- Major bumps (`1.0`+) may introduce breaking changes; from `1.0`
  onward those require a one-shot migration.

## 1. Grammar

A docref is a single string that addresses one resource. Every
reference in a consumer system that wants to point at a knowledge
resource is a docref—there are no special cases.

### 1.1 Source-form prefixes

A docref must begin with one of the following prefix markers:

| Prefix | Meaning |
|---|---|
| `./` or `../` | Relative filesystem path (resolved against the consumer's base directory—typically the directory of the file containing the docref) |
| `/` | Absolute filesystem path |
| `https://`, `http://` | Web URL (single resource) |
| `github:` | A reference into a GitHub repository |
| `gitlab:` | A reference into a GitLab repository |
| `git:` | A reference into any git remote (other hosts, self-hosted, etc.) |

Any other input is a parse error. **Bare relative paths without `./`
are forbidden**—`guidelines/foo.md` must be written
`./guidelines/foo.md`. This eliminates ambiguity with future schemes.

The format is open to additional host-specific schemes in future
versions (e.g., `bitbucket:`, `codeberg:`, `gitea:`, others) provided
they:

1. use a unique short scheme prefix that doesn't collide with anything
   already defined,
2. follow the same `<scheme>:<owner>/<repo>[@ref][//path]` convention
   as `github:` and `gitlab:`, and
3. use `git:` as the fallback when their host-specific features
   aren't needed.

Reserved for future use (must be rejected today, but the prefix space
is held): `s3:`, `gs:`, `file:`, `bitbucket:`, `codeberg:`.

### 1.2 Local paths

```
./docs/guidelines/
./docs/guidelines/typescript.md
../shared-docs/
/abs/path/to/docs/
```

- A trailing `/` indicates a directory; no trailing slash indicates a
  file.
- Relative paths resolve against the consumer's base directory.
- No fetch needed—content is read directly from the filesystem.

### 1.3 Web URLs

```
https://example.com/api-docs/v3/reference.md
https://docs.example.org/intro.html
```

- Single resource only.
- Recommended consumer behavior: HTML resources are converted to
  markdown for LLM readability; other formats are cached as-is.
  Consumers may also choose to leave HTML untouched.
- An `https://github.com/...` URL is **automatically normalized** to
  a `github:` docref (Section 1.6).

### 1.4 GitHub docrefs

```
github:owner/repo[@ref][//path]
```

All parts after `owner/repo` are optional:

- `@ref` pins to a branch, tag, or commit SHA. Defaults to the repo's
  default branch.
- `//path` addresses a file or directory inside the repo. Defaults to
  repo root.
- Trailing `/` on the path = directory; no trailing slash = single
  file.

Examples:

```
github:jlevy/coding-guidelines                                # entire repo, default branch
github:jlevy/coding-guidelines@main                           # pinned to branch
github:jlevy/coding-guidelines@v1.2.0                         # pinned to tag
github:jlevy/coding-guidelines@a1b2c3d                        # pinned to commit
github:jlevy/coding-guidelines@main//guidelines/              # a directory
github:jlevy/coding-guidelines@main//guidelines/typescript.md # a file
```

The `@` separator and `//` path-prefix borrow conventions from
established ecosystems (`@ref` from GitHub Actions, `//path` from
Terraform, the `github:` prefix from package managers)—readable and
parseable by humans.

### 1.5 GitLab docrefs

```
gitlab:owner/repo[@ref][//path]
```

Identical conventions to `github:` (Section 1.4): `@ref` pins to a
branch / tag / commit; `//path` addresses a sub-path; trailing slash
distinguishes directory from file. Examples:

```
gitlab:gitlab-org/gitlab-runner                                # default branch
gitlab:gitlab-org/gitlab-runner@main                           # branch
gitlab:gitlab-org/gitlab-runner@v16.0.0                        # tag
gitlab:gitlab-org/gitlab-runner@main//docs/                    # directory
gitlab:gitlab-org/gitlab-runner@main//docs/install.md          # file
```

GitLab's project paths can be nested (`group/subgroup/project`).
The `<owner>/<repo>` shape extends accordingly:

```
gitlab:my-group/my-subgroup/my-project@main
```

Implementations should accept the full GitLab project path as
`<group-path>/<project>`.

### 1.6 Generic git docrefs

```
git:<remote>[@ref][//path]
```

The `<remote>` is any valid git remote URL (HTTPS or SSH). Use `git:`
for hosts that don't yet have a host-specific scheme:

```
git:https://bitbucket.org/team/repo.git
git:https://bitbucket.org/team/repo.git@main//docs/
git:git@self-hosted.example.com:org/repo.git@main//src/
git:https://codeberg.org/org/repo.git@v1.0.0
```

Parsing rule: the remote URL ends at the first `@` that follows
`.git` (or at end of string if no ref). This disambiguates the `@`
in SSH URLs (`git@host`) from the `@ref` separator.

If a `git:` docref points at a host that has a host-specific scheme,
it is normalized to that scheme:

- `git:` pointing at `github.com` → `github:`
- `git:` pointing at `gitlab.com` → `gitlab:`

### 1.7 Input normalization

Several common URL forms auto-normalize to canonical docref form.
Implementations must apply these on parse so stored references are
always canonical.

**GitHub:**

| Input | Canonical |
|---|---|
| `https://github.com/o/r` | `github:o/r` |
| `https://github.com/o/r.git` | `github:o/r` |
| `https://github.com/o/r/tree/main/src` | `github:o/r@main//src/` |
| `https://github.com/o/r/blob/main/README.md` | `github:o/r@main//README.md` |
| `git@github.com:o/r.git` | `github:o/r` |
| `git:git@github.com:o/r.git@main` | `github:o/r@main` |

**GitLab:**

| Input | Canonical |
|---|---|
| `https://gitlab.com/o/r` | `gitlab:o/r` |
| `https://gitlab.com/o/r.git` | `gitlab:o/r` |
| `https://gitlab.com/o/r/-/tree/main/src` | `gitlab:o/r@main//src/` |
| `https://gitlab.com/o/r/-/blob/main/README.md` | `gitlab:o/r@main//README.md` |
| `https://gitlab.com/group/sub/proj` | `gitlab:group/sub/proj` |
| `git@gitlab.com:o/r.git` | `gitlab:o/r` |

GitLab's `/-/tree/` and `/-/blob/` URL segments distinguish branch
references from project paths (necessary because group paths can
nest arbitrarily). Normalization recognizes the `/-/` separator.

### 1.8 Authentication

The grammar **does not encode credentials**. Consumers delegate to
the underlying transport's own auth:

- `github:` and `git:` clones use git's credential helpers (HTTPS via
  credential helper, SSH via key agent, `gh auth setup-git` config,
  etc.).
- `https:` fetches use whatever the underlying HTTP client is
  configured to use.

There is no auth field in the docref grammar, ever. Public sources
just work; private sources rely on the user's environment. Consumer
failure messages should name the underlying tool when auth fails.

### 1.9 Extensibility

The scheme prefix is the extension point. New schemes are added by
defining their grammar and resolution semantics; the parsing rule
remains "match the prefix, parse accordingly, error on unknown."
Reserved prefixes (Section 1.1) hold space for the most likely
future additions.

For host-specific git providers (e.g., a future `bitbucket:` scheme),
the recommended pattern is to mirror `github:` / `gitlab:`: the same
`<scheme>:<owner>/<repo>[@ref][//path]` shape, plus normalization
rules from the host's web URL conventions to the canonical scheme
form. This keeps the user-facing grammar uniform across providers
while leaving room for host-specific behaviors (e.g., API access,
issue linking) to be added later in the implementing tool.

### 1.10 Reserved: fragment identifier (`#`)

The `#` character is **reserved** for future fragment-identifier
syntax (addressing content *within* a doc—section anchors, line
ranges, named regions, or other fine-grained selectors to be defined
in a later format version). The intended grammar is:

```
<docref>[#<fragment>]
```

mirroring URI fragment convention. The fragment grammar itself is
left open: future versions may define one or more fragment schemes.

In v0.1, the fragment portion is **silently dropped on parse**: an
implementation that doesn't understand fragments treats
`github:foo/bar@main#section` as `github:foo/bar@main`. This is the
standard URI-client convention when a fragment grammar isn't
recognized—return the whole resource—and is forward-compatible:
docrefs written today with fragments will "upgrade" to honoring those
fragments once a future format version defines them, without changing
the docref string itself.

File paths or git refs containing a literal `#` (rare) must be
percent-encoded as `%23`, per URI convention, so they aren't
mis-parsed as fragments.

## 2. Examples summary

| docref | Resource |
|---|---|
| `./docs/guidelines/typescript.md` | A local file relative to base dir |
| `./docs/agent/` | A local directory |
| `/abs/path/file.md` | An absolute local file |
| `https://example.com/foo.md` | A web URL (single file) |
| `github:jlevy/coding-guidelines` | A GitHub repo at default branch |
| `github:jlevy/coding-guidelines@main` | Pinned to branch |
| `github:jlevy/coding-guidelines@v1.0.0` | Pinned to tag |
| `github:jlevy/coding-guidelines@main//guidelines/` | A directory in a repo |
| `github:jlevy/coding-guidelines@main//guidelines/ts.md` | A file in a repo |
| `gitlab:gitlab-org/gitlab-runner@main//docs/` | A directory in a GitLab repo |
| `gitlab:my-group/my-sub/proj@main//src/` | A nested-group GitLab project |
| `git:https://bitbucket.org/team/repo.git@main` | A repo on a host without a host-specific scheme |
| `git:git@self-hosted.example.com:org/repo.git@main` | SSH-style remote on a self-hosted server |

## 3. Used by

- **docmap** ([design-docmap-format.md](./design-docmap-format.md))
 —declares an ordered list of sources by docref, and builds a
  syncable, addressable index of their contents.
- Any tool that needs a single-string grammar for "where does this
  knowledge live" can consume docrefs without depending on docmap.

<!-- This document follows std-doc-guidelines.md.
Review guidelines before editing.
-->
