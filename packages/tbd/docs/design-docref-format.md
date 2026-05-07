# docref Format

Last updated: 2026-05-07

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

**docref** is a format specification for declaring, mirroring, addressing,
and retrieving knowledge documents — agent guidelines, shortcuts, templates,
references, source-code repos, and other reusable doc-shaped content — from a
mix of local and remote sources.

It defines:

1. A **docref** — a single string that addresses any source or item.
   The grammar mixes URI-style schemed forms (`https:`, `github:`, `git:`)
   with bare filesystem paths (`./foo`, `/abs/path`) and short index
   forms (canonical keys, basenames, aliases). Borrows from npm/pip's
   "package specifier" tradition rather than being a strict RFC 3986 URI.
2. A **manifest schema** — the YAML shape that declares an ordered list of
   sources, how they should be filtered, and how they map to consumer-defined
   doc types.
3. A **lockfile schema** — pinned revisions and content hashes for
   reproducible mirror state.
4. A **doc map schema** — a generated, agent-facing index of every resolvable
   item with metadata.
5. A **resolution algorithm** — deterministic mapping from a user-supplied
   docref string to an exact item on disk.

The format is the foundation of `tbd`'s docs subsystem (`tbd shortcut`,
`tbd guidelines`, `tbd template`, `tbd reference`, `tbd source`,
`tbd doc status`, etc.), but it is **deliberately tool-agnostic**: every
schema and algorithm in this document can be implemented by any tool that
reads YAML. tbd embeds the implementation today; the format itself is
designed to be extractable as a separate library or CLI later without a
breaking change.

**Scope:** This document defines the format only — schemas, docref
grammar, resolution algorithm, sync semantics. It does **not** define
tbd-specific workflows (overrides, eject, roundtrip,
doc-type-as-CLI-command), which live in
[plan-2026-05-07-docs-config-redesign.md](../../../docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md).

**Related Documents:**

- [plan-2026-05-07-docs-config-redesign.md](../../../docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md)
  — the implementation spec that consumes this format
- [tbd-design.md](./tbd-design.md) — overall tbd architecture

## Terminology

- **docref**: a string that points to a doc or to a source of docs.
  The grammar admits multiple forms (Section 1): URI-shaped schemed
  references (`https:`, `github:`, `git:`), bare filesystem paths
  (`./`, `/`), canonical keys (`<bundle>:<type>/<name>`), basenames,
  and aliases. Some forms are valid only as **source docrefs** in the
  manifest; some only as **lookup docrefs** in CLI queries; some are
  valid in both contexts.
- **source**: an entry in the manifest declaring one origin (a local
  directory, a git repo, a URL, etc.). Identified by its source docref.
- **bundle**: a user-visible name attached to a source. Used as the prefix
  in canonical keys and as the directory name where mirrored content lands.
  One source = one bundle.
- **doc type**: a consumer-defined classification of a doc (e.g.,
  `guideline`, `shortcut`, `template`, `reference`). Doc types are
  config-driven, not hardcoded by the format.
- **canonical key**: the fully qualified, globally-unique address of an
  item: `<bundle>:<type>/<name>` (or `<bundle>` for a whole-repo source).
  A canonical key is one valid form of a lookup docref.
- **manifest**: the YAML file (or section) declaring `sources`, `doc_types`,
  and related fields.
- **lockfile**: the YAML file pinning the resolved state of each remote
  source.
- **doc map**: the generated YAML index of all resolvable items.

## Format Versioning

The manifest carries a version identifier:

```yaml
format: docref/0.1
```

Tools must recognize the format identifier and refuse to parse manifests
with unknown major versions. Minor version bumps (`0.1` → `0.2`) are
backward-compatible additions; major bumps (`0.1` → `1.0`) may break.

Unknown fields in a known-major manifest are ignored for forward
compatibility.

## 1. docref Grammar

A docref is a single string that addresses a source or an item within a
source. Every reference in the format is a docref — there are no special
cases.

A docref is **not** strictly an RFC 3986 URI. URI-shaped schemed forms
(`https:`, `github:`, `git:`) are valid docrefs, but so are bare
filesystem paths (`./foo`, `/abs/path`) and short index forms used as
lookup queries (canonical keys, basenames, aliases). The model follows
npm's "package specifier" tradition rather than a strict URI grammar.

### 1.1 Source-form prefixes

When a docref appears in the manifest as a source address, it must begin
with one of the following prefix markers:

| Prefix | Meaning |
|---|---|
| `./` or `../` | Relative filesystem path (resolved against the manifest's directory) |
| `/` | Absolute filesystem path |
| `https://`, `http://` | Web URL (single resource) |
| `github:` | A reference into a GitHub repository |
| `git:` | A reference into any git remote (GitLab, Bitbucket, self-hosted, etc.) |

Any other input as a source docref is a parse error. **Bare relative
paths without `./` are forbidden** — `guidelines/foo.md` must be written
`./guidelines/foo.md`.
This eliminates ambiguity with future schemes.

Reserved for future use (must be rejected today, but the prefix space is
held): `s3:`, `gs:`, `file:`, `gitlab:`, `bitbucket:`.

### 1.2 Local paths

```
./docs/guidelines/
./docs/guidelines/typescript.md
../shared-docs/
/abs/path/to/docs/
```

- A trailing `/` indicates a directory; no trailing slash indicates a file.
- Relative paths resolve against the directory containing the manifest.
- No sync needed — content is read directly from the filesystem.

### 1.3 Web URLs

```
https://example.com/api-docs/v3/reference.md
https://docs.example.org/intro.html
```

- Fetched via HTTP GET and cached locally.
- HTML resources are converted to markdown on ingest for LLM readability;
  other formats are cached as-is.
- Single-file only — `glob` and `ignore` fields don't apply.
- An `https://github.com/...` URL is **automatically normalized** to a
  `github:` docref (see 1.6).

### 1.4 GitHub docrefs

```
github:owner/repo[@ref][//path]
```

All parts after `owner/repo` are optional:

- `@ref` pins to a branch, tag, or commit SHA. Defaults to the repo's
  default branch.
- `//path` addresses a file or directory inside the repo. Defaults to repo
  root.
- Trailing `/` on the path = directory; no trailing slash = single file.

Examples:

```
github:jlevy/coding-guidelines                                # entire repo, default branch
github:jlevy/coding-guidelines@main                           # pinned to branch
github:jlevy/coding-guidelines@v1.2.0                         # pinned to tag
github:jlevy/coding-guidelines@a1b2c3d                        # pinned to commit
github:jlevy/coding-guidelines@main//guidelines/              # a directory
github:jlevy/coding-guidelines@main//guidelines/typescript.md # a file
```

The `@` separator and `//` path-prefix borrow conventions from established
ecosystems (`@ref` from GitHub Actions, `//path` from Terraform, the
`github:` prefix from package managers) — readable and parseable by humans.

### 1.5 Generic git docrefs

```
git:<remote>[@ref][//path]
```

The `<remote>` is any valid git remote URL (HTTPS or SSH):

```
git:https://gitlab.com/org/repo.git
git:https://gitlab.com/org/repo.git@main//docs/
git:git@gitlab.com:org/repo.git@v2.0
git:git@self-hosted.example.com:org/repo.git@main//src/
```

Parsing rule: the remote URL ends at the first `@` that follows `.git` (or
at end of string if no ref). This disambiguates the `@` in SSH URLs
(`git@host`) from the `@ref` separator.

If a `git:` docref points at `github.com`, it is normalized to a `github:`
docref.

### 1.6 Input normalization

Several common URL forms auto-normalize to canonical docref form. Tools
must apply these on parse so the manifest and lockfile always store
canonical forms.

| Input | Canonical |
|---|---|
| `https://github.com/o/r` | `github:o/r` |
| `https://github.com/o/r.git` | `github:o/r` |
| `https://github.com/o/r/tree/main/src` | `github:o/r@main//src/` |
| `https://github.com/o/r/blob/main/README.md` | `github:o/r@main//README.md` |
| `git@github.com:o/r.git` | `github:o/r` |
| `git:git@github.com:o/r.git@main` | `github:o/r@main` |

### 1.7 Authentication

The format **does not manage credentials**. Tools delegate to the
underlying transport's own auth:

- `github:` and `git:` clones use git's credential helpers (HTTPS via
  credential helper, SSH via key agent, `gh auth setup-git` config, etc.).
- `https:` fetches use whatever the underlying HTTP client is configured
  to use.

There is no `auth:` field in the manifest. Public sources just work;
private sources rely on the user's environment. Failure messages name the
underlying tool ("`git clone` failed; configure credentials via `gh auth
setup-git` or your SSH key agent") rather than offering an in-format auth
escape hatch.

### 1.8 Extensibility

The scheme prefix is the extension point. New schemes are added by
defining their grammar and resolution semantics; the parsing rule remains
"match the prefix, parse accordingly, error on unknown."

### 1.9 Reserved: fragment identifier (`#`)

The `#` character is **reserved** for future fragment-identifier syntax
(addressing content *within* a doc — section anchors, line ranges, named
regions, or other fine-grained selectors to be defined in a later format
version). The intended grammar is:

```
<docref>[#<fragment>]
```

mirroring URI fragment convention. The fragment grammar itself is left
open: future versions may define one or more fragment schemes.

In v0.1, the fragment portion is **silently dropped on parse**: an
implementation that doesn't understand fragments treats `github:foo/bar@main#section`
as `github:foo/bar@main`. This is the standard URI-client convention
when a fragment grammar isn't recognized — return the whole resource —
and is forward-compatible: docrefs written today with fragments will
"upgrade" to honoring those fragments once a future format version
defines them, without changing the docref string itself.

File paths or git refs containing a literal `#` (rare) must be
percent-encoded as `%23`, per URI convention, so they aren't
mis-parsed as fragments.

## 2. Manifest

The manifest declares an ordered list of sources and the doc-type registry.
For tbd it lives inline in `.tbd/config.yml` under a `docs:` key; for a
standalone tool it would live in a dedicated `docs.yml` (or similar) file.

### 2.1 Top-level shape

```yaml
docs:
  format: docref/0.1

  doc_types:
    - { name: shortcut,  dir: shortcuts,  command: shortcut }
    - { name: guideline, dir: guidelines, command: guidelines }
    - { name: template,  dir: templates,  command: template }
    - { name: reference, dir: references, command: reference }

  sources:
    - docref: ./docs/agent/
      bundle: proj

    - docref: github:jlevy/coding-guidelines@main
      bundle: coding

    - docref: github:jlevy/writing-guidelines@main
      bundle: writing
      contents:
        - { path: docs/style/, type: guideline }
        - { path: docs/refs/,  type: reference }

    - docref: https://example.com/foo.md
      bundle: misc
      type: guideline
      as: foo
```

### 2.2 `doc_types`

Defines the consumer's set of doc types. Each entry:

- `name` (string, required) — the type name, used in canonical keys.
- `dir` (string, required) — canonical directory under
  `<bundle>/` where docs of this type land.
- `command` (string, optional) — for tools (like tbd) that surface each
  type as a dedicated CLI command. Pure format consumers can ignore it.

Built-in types are seeded by the consumer tool (e.g., `tbd setup`); users
can add their own. The format does not hardcode any types.

### 2.3 `sources`

An ordered list of source entries. Order is the **lookup order**: when an
unqualified docref resolves to multiple bundles, the source listed first
wins.

#### Per-source fields

**Required:**

- `docref` (string) — a valid source docref (Section 1.1).
- `bundle` (string) — the bundle name. Required for remote sources;
  optional for local sources (defaults to `local`). Lowercase letters,
  digits, and hyphens; 1–32 chars.

**Filtering:**

- `glob` (string, optional) — glob pattern selecting files from the
  source. Default: `**/*.md`.
- `ignore` (list of strings, optional) — gitignore-format patterns
  excluding files after the glob match. Supports `!` for re-inclusion.
- `contents` (list, optional) — explicit upstream-path → doc-type
  mapping (Section 2.4). Use when upstream layout doesn't match the
  doc-type-directory convention.

**Source mode:**

- `as` (string, optional) — when set to a name, treats the source as a
  single named item rather than a bag of files. Useful for single-URL
  sources or whole-repo references. The bundle's canonical key
  becomes `<bundle>` (no slash) and the item is addressed as the
  bundle name itself.
- `type` (string, optional) — the doc type for an `as`-style single
  item (must match a name in `doc_types`).
- `depth` (integer or `"full"`, optional) — git clone depth for
  `github:`/`git:` sources. Default: `1` (shallow). Use `"full"` if git
  history is required.

**Metadata:**

- `title` (string, optional) — human-readable title.
- `description` (string, optional) — what this source covers.
- `when` (string, optional) — when an agent should consult this source
  (trigger hint for the doc map).
- `metadata` (map, optional) — per-file metadata overrides keyed by
  filename relative to the source root. Each value is a `{ title?,
  description?, when? }` object.

**Auto-detection default:**

- `bundle` and the doc-type registry together provide a zero-config path:
  if no `contents` or per-file `metadata` is given, the implementation
  walks the upstream tree and matches subdirectory names against the
  `doc_types` registry's `dir` field. Files in matched subdirs become
  docs of that type; files in unmatched dirs are ignored.

### 2.4 `contents` mapping

When the upstream layout doesn't match the auto-detection convention, or
when you want to filter / rename / span multiple upstream paths into one
doc type, use the explicit `contents` list:

```yaml
- docref: github:jlevy/writing-guidelines@main
  bundle: writing
  contents:
    - { path: docs/style/, type: guideline }
    - { path: docs/refs/,  type: reference }
    - { path: snippets/,   type: shortcut  }
    - { path: README.md,   type: reference, as: writing-overview }
```

Each rule:

- `path` (string, required) — upstream path or glob (`docs/**/*.md`,
  `README.md`, etc.). Trailing `/` matches directory contents.
- `type` (string, required) — the doc type to assign (must match a name
  in `doc_types`).
- `as` (string, optional) — rename: the doc lands as `<bundle>:<type>/<as>`
  rather than using its upstream basename.

Resolution rules:

- Rules are evaluated top-to-bottom; first match wins for any given file.
- Combining `contents` with `glob`/`ignore` is allowed. `glob`/`ignore`
  filter the candidate set; `contents` classifies what remains.
- If `contents` is omitted, auto-detection (Section 2.3) applies.

### 2.5 Bundle name auto-suggestion

When a user adds a source via CLI, the implementation should suggest a
bundle name derived from the docref:

| docref | Suggested bundle |
|---|---|
| `./docs/agent/` | `local` (or `proj`, see consumer policy) |
| `github:jlevy/coding-guidelines@main` | `coding-guidelines` |
| `github:owner/repo` | `repo` (last path segment) |
| `https://example.com/foo` | `example-com` |
| `git:https://gitlab.com/org/repo.git` | `repo` |

Users can override with explicit `--bundle`. The implementation must
print a preview of the resulting manifest change before persisting, so
users can review what bundle the docs will land in.

### 2.6 Reserved bundle names

`local`, `cache`, `sys` are reserved. Implementations may reserve
additional names (e.g., tbd reserves `tbd` for its built-in core).

## 3. Lockfile

The lockfile (`docs.lock.yml` for a standalone tool, `.tbd/docs.lock.yml`
for tbd) records the exact resolved state of each remote source. It plays
the role `package-lock.json` plays for npm: pins the cache to a known
state for reproducible installs.

### 3.1 Schema

```yaml
# docs.lock.yml — generated, do not hand-edit
format: docref/0.1

sources:
  - docref: github:jlevy/coding-guidelines@main
    revision: a1b2c3d4e5f67890abcdef1234567890abcdef12
    hash: sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b1234567890abcdef12345678
    materialization:
      kind: git-shallow
      depth: 1
    synced_at: 2026-05-07T10:00:00Z

  - docref: https://example.com/foo.md
    hash: sha256:3e864103...
    etag: '"3e86-410-3596fbbc"'
    materialization:
      kind: fetched-file
      format: markdown
    synced_at: 2026-05-07T10:00:00Z
```

### 3.2 Per-source fields

**git sources (`github:`, `git:`):**

- `docref` — the docref from the manifest.
- `revision` — full SHA of the resolved commit.
- `hash` — content hash of the cached tree.
- `materialization.kind` — `git-shallow` or `git-full`.
- `materialization.depth` — clone depth used.
- `synced_at` — ISO 8601 timestamp.

**Web URL sources (`https:`, `http:`):**

- `docref` — the docref.
- `hash` — content hash of the fetched resource.
- `etag` — HTTP ETag for conditional re-fetch (optional).
- `materialization.kind` — `fetched-file`.
- `materialization.format` — `markdown` (HTML→md converted) or `original`.
- `synced_at`.

Local sources do not appear in the lockfile (they are read live).

### 3.3 Reproducibility contract

Given the same manifest + lockfile + working network, two `sync`
operations on different machines produce caches with identical content
hashes for every locked entry. This is the formal G9 (reproducibility)
property.

## 4. Doc Map

The doc map (`docs/map.yml`) is the generated, machine-readable index of
every resolvable item. It is **lossless with respect to addressability**
— every indexed item appears in the map even if its basename collides
with another item's. Generated by `build`.

### 4.1 Schema

```yaml
# docs/map.yml — generated
format: docref/0.1
built: 2026-05-07T10:00:00Z

documents:
  - key: coding:guidelines/typescript
    bundle: coding
    type: guideline
    path: guidelines/typescript.md
    title: "TypeScript Coding Rules"
    description: "Comprehensive TypeScript guidelines"
    when: "Writing, reviewing, or refactoring TypeScript"
    word_count: 3200

  - key: writing:reference/writing-overview
    bundle: writing
    type: reference
    path: references/writing-overview.md
    upstream_path: README.md          # if renamed via `as`
    word_count: 1800
```

### 4.2 Fields

- `key` — canonical key (Section 5.1).
- `bundle` — bundle name.
- `type` — doc type name.
- `path` — landed path within `<bundle>/` (relative).
- `upstream_path` — original upstream path, if different from `path`.
- `title` / `description` / `when` — metadata, resolved per Section 4.3.
- `word_count` — approximate, for budget-aware rendering.

### 4.3 Metadata resolution layers

For each doc, metadata is resolved with this precedence (highest first):

1. **Per-file overrides** in the manifest (`metadata:` map on the source
   entry).
2. **File frontmatter** (YAML frontmatter at the top of the doc, if
   present).
3. **Source-level defaults** in the manifest (`title` / `description` /
   `when` on the source entry).

This lets you annotate third-party content without modifying it upstream.

### 4.4 Whole-source / repo aggregate entries

When `as: <name>` is set on a source (Section 2.3), the source produces a
single aggregate map entry (key = bundle name, no `:type/path` suffix)
rather than per-file entries. This is appropriate for whole-repo
references like library source code.

## 5. Item Addressing and Resolution

A docref has two complementary uses, sharing one grammar:

- **Source docrefs** appear in the manifest's `docref:` field — they
  address a *source* (where to fetch from). Resolved by sync. Their
  valid forms are the source-form prefixes in Section 1.1
  (`./`, `/`, `https:`, `github:`, `git:`).
- **Lookup docrefs** appear as CLI arguments and programmatic lookup
  queries — they address an *indexed item* (which item to retrieve).
  Resolved by the algorithm in Section 5.3. Their valid forms are
  listed in Section 5.2 (canonical keys, basenames, aliases,
  repo-subpaths).

A few forms are valid in both contexts (notably the URI-shaped schemed
forms — pointing at one specific upstream file). Most forms are
unambiguous: `./local-dir/` only makes sense as a source; a bare
basename like `typescript-rules` only makes sense as a lookup query.

The lookup chain: **docref → canonical key → on-disk path**.

### 5.1 Canonical keys

Every indexed item has exactly one canonical key:

```
<bundle>:<type>/<name>
```

Where:

- `<bundle>` is the source's bundle name.
- `<type>` is the doc type name (per `doc_types`).
- `<name>` is the item's basename relative to its type directory, with
  the `.md` extension stripped.

For `as:`-style aggregate sources, the key is just `<bundle>`.

Examples:

```
coding:guideline/typescript
writing:reference/writing-overview
proj:shortcut/migrate-to-v2
flask                              # whole-repo aggregate
```

Canonical keys must be globally unique across the index. If two sources
would produce the same canonical key, `build` fails with a config error
identifying both.

### 5.2 Lookup-form docrefs

A lookup-form docref is one of:

| Form | Example | Meaning |
|---|---|---|
| Canonical key | `coding:guideline/typescript` | Exact item |
| Bundle-scoped basename | `coding:typescript` | Item with this basename in this bundle |
| Bare basename | `typescript` | Globally-unique basename |
| Alias | `ts-rules` | Declared alias on some item |
| Repo-subpath | `flask//src/flask/app.py` | File within a whole-repo source |

### 5.3 Resolution algorithm

Given a docref query, the resolver attempts progressively broader matches:

1. **Repo-subpath form.** If query contains `//`, split on first `//`.
   Left side must identify an `as:`-style aggregate source. If the path
   exists in that source's cache, return. Otherwise fail.

2. **Parse bundle scope.** If query contains `:`, split on first `:`.
   Left = bundle scope; right = name. Resolution is restricted to that
   bundle. If no `:`, all bundles are in scope.

3. **Exact canonical key match.** If the query (after step 2) matches a
   full canonical key (e.g., `guideline/typescript`), return.

4. **Basename match.** If exactly one item in scope has matching basename
   (filename without extension, ignoring directory), return. If multiple,
   fail with an `Ambiguous` error listing all matches.

5. **Alias match.** Same as basename but against declared aliases.

6. **Failure.** Return `NotFound` listing available canonical keys in
   scope (limited to a reasonable display count).

### 5.4 Collisions

- **Canonical key collisions** are fatal at `build` time.
- **Basename / alias collisions** are allowed: all colliding items remain
  in the index. Unqualified queries that hit them return `Ambiguous`;
  callers must use the canonical key or bundle-scoped form.
- A `status` operation reports collisions so users can detect unintended
  overlap.

### 5.5 Override via priority

When two sources contribute items with the **same canonical key after
prefix removal** (i.e., same `<type>/<name>` but different bundles), they
are **not** a collision; they are independently addressable as
`<bundle1>:<type>/<name>` and `<bundle2>:<type>/<name>`.

Unqualified bare-basename queries respect source order: the bundle whose
source is listed first in the manifest wins. This is the foundation of
override semantics: a higher-priority `local` bundle naturally shadows a
lower-priority remote bundle for the same basename.

## 6. Sync Semantics

The format defines three core operations:

### 6.1 `sync`

Ensures the cache matches the lockfile.

- If a lockfile exists, fetch each locked revision exactly. If the cache
  already matches the locked hash and materialization, skip.
- If no lockfile exists, resolve the current state of each source,
  populate the cache, write the lockfile.
- Idempotent: safe to re-run.
- Failures are isolated per source; lockfile is updated only for sources
  that synced successfully.
- Atomically swap cache contents per source on success (no partial state
  visible to readers).

### 6.2 `update [<bundle>]`

Resolves the latest state of each source (or one source by bundle name),
re-fetches, updates the lockfile. This is the "move forward" operation.

### 6.3 `status`

Per source, reports:

- whether the cache matches the lockfile
- whether upstream has advanced past the locked revision (where
  detectable, e.g., for branch-pinned git sources)
- orphaned cache entries (in cache but not in manifest)
- collisions detected during last build

`status` is read-only and offline (it does not fetch).

### 6.4 Build

`build` walks the cache + local sources and produces the doc map. Pure
indexing — no network. Failures are per-source: a missing or corrupt
cache directory produces a clear error directing the user to `sync`,
while successfully indexed sources still appear in the map.

## 7. Directory Layout

The format is agnostic to where its files live, but recommends:

```
<project>/
├── docs.yml                       # Manifest (or inline in a host config)
├── docs.lock.yml                  # Lockfile (committed for reproducibility)
└── docs/                          # Implementation directory
    ├── .gitignore                 # Cache is gitignored
    ├── map.yml                    # Doc map (gitignored or committed; consumer choice)
    ├── <bundle>/                  # Per-bundle cached content
    │   ├── guidelines/
    │   │   └── typescript.md
    │   └── shortcuts/
    │       └── code-review.md
    └── repo-cache/                # Sparse git checkouts for git: sources
        └── github.com-jlevy-coding-guidelines/
```

For tbd's specific embedding:

- Manifest is inline in `.tbd/config.yml` under `docs:`.
- Lockfile is `.tbd/docs.lock.yml`.
- Doc map is `.tbd/docs/map.yml`.
- Cached content is `.tbd/docs/<bundle>/<type>/<name>.md`.
- Repo cache is `.tbd/docs/repo-cache/`.

## 8. Failure Model

Errors fall into five classes; implementations should distinguish them:

1. **Config errors** — invalid manifest YAML, unknown docref scheme,
   unknown `format` version, missing required field. Block all
   operations.
2. **Sync errors** — clone/fetch failure, ref not found, HTTP non-2xx,
   auth failure, hash mismatch. Reported per source; lockfile only
   updated for successful sources.
3. **Build errors** — missing cache (sync not run), glob syntax error,
   canonical-key collision. Reported per source; successful sources
   still appear in the map.
4. **Resolution errors** — `NotFound` (no match) or `Ambiguous` (multiple
   matches). Both include the candidate set in the error.
5. **Retrieval errors** — file unreadable, encoding issue.

All error messages must include: the source or docref that failed, the
specific reason, and a suggested fix when applicable ("run `sync`",
"configure git credentials", etc.).

## 9. Versioning and Stability

- `docref/0.1` is the initial draft. Breaking changes are allowed
  before `1.0`.
- Future minor versions (`0.2`, `0.3`) add fields without breaking
  existing manifests.
- `1.0` will mark the stable boundary; from then on, breaking changes
  require a major bump and a one-shot migration tool.

## 10. Integration: tbd-Specific Extensions

tbd embeds this format and adds the following on top — these are NOT part
of the core format but are documented here for cross-reference:

- **`tbd source eject <bundle:name>`** — copies a cached doc into a local
  bundle and `git add`s it. (See plan-spec G4, G8.)
- **`tbd source diff/upstream/unfork`** — local-override roundtrip
  workflow against the cached upstream. (G5.)
- **`tbd doc <type> <name>`** — generic dispatcher to type-specific
  commands (`tbd shortcut`, `tbd guidelines`, etc.) per the
  `command` field on `doc_types`. (G7.)
- **`tbd doc status`** — bundle-aware status output combining the doc
  map, lockfile, and divergence detection. (G6.)
- **Bundle-scoped `tbd shortcut --bundle <name>`** filter on listings.

A standalone `docref` tool would expose the format primitives directly
(`docref sync`, `docref build`, `docref resolve <docref>`, `docref get
<docref>`) without these tbd-specific workflows. The two layers are
designed to compose cleanly.
