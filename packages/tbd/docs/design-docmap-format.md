# docmap Format

Last updated: 2026-05-07

## Overview

**docmap** is a format specification for declaring, mirroring, and
indexing collections of knowledge documents—agent guidelines,
shortcuts, templates, references, source-code repos, and other
reusable doc-shaped content—from a mix of local and remote sources.

A docmap consumer:

1. Reads a **manifest** declaring an ordered list of sources, each
   addressed by a docref (see
   [design-docref-format.md](./design-docref-format.md)).
2. **Syncs** remote sources into a local cache, pinned by a lockfile.
3. **Builds** a generated doc map (an index of every resolvable item).
4. **Resolves** lookup queries (canonical keys, basenames, aliases)
   to specific items on disk.

docmap builds on top of docref: docref provides the URI-like grammar
for addressing a resource; docmap provides the schema, sync, lockfile,
indexing, and resolution machinery for working with collections of
those resources.

The format is the foundation of `tbd`'s docs subsystem (`tbd shortcut`,
`tbd guidelines`, `tbd template`, `tbd reference`, `tbd source`,
`tbd doc status`, etc.), but it is **tool-agnostic**: every
schema and algorithm here can be implemented by any tool that reads
YAML.

**Scope:** This document defines the docmap format only—manifest
schema, lockfile schema, doc map schema, addressing/resolution
algorithm, sync semantics. It does **not** define tbd-specific
workflows (overrides, eject, roundtrip, doc-type-as-CLI-command),
which live in
[plan-2026-05-07-docs-config-redesign.md](../../../docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md).

**Related documents:**

- [design-docref-format.md](./design-docref-format.md)—the docref
  grammar (addressing primitive)
- [plan-2026-05-07-docs-config-redesign.md](../../../docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md)
 —the implementation spec consuming this format
- [tbd-design.md](./tbd-design.md)—overall tbd architecture

## Terminology

- **docref**: a single-string grammar for addressing a resource
  (see docref spec).
- **source**: an entry in the manifest declaring one origin (a local
  directory, a git repo, a URL, etc.). Identified by a docref.
- **bundle**: a user-visible name attached to a source. Used as the
  prefix in canonical keys and as the directory name where mirrored
  content lands. One source = one bundle.
- **doc type**: a consumer-defined classification of a doc (e.g.,
  `guideline`, `shortcut`, `template`, `reference`). Doc types are
  config-driven, not hardcoded by the format.
- **canonical key**: the fully qualified, globally-unique address of
  an indexed item: `<bundle>:<type>/<name>` (or `<bundle>` for a
  whole-repo source).
- **lookup key**: a query string (canonical key, basename, alias, or
  repo-subpath) used in CLI / programmatic lookups to resolve an
  indexed item. Distinct from a docref (which addresses a resource at
  its source, not in the index).
- **manifest**: the YAML file (or section) declaring `sources`,
  `doc_types`, and related fields.
- **lockfile**: the YAML file pinning the resolved state of each
  remote source.
- **doc map**: the generated YAML index of all resolvable items.

## Format Versioning

The manifest top-level field is `docmap:` with a `schema:` identifier:

```yaml
docmap:
  schema: docmap/0.1
  ...
```

Tools must recognize the schema identifier and refuse to parse
manifests with unknown major versions. Minor version bumps
(`0.1` → `0.2`) are backward-compatible additions; major bumps
(`0.1` → `1.0`) may break.

Unknown fields in a known-major manifest are ignored for forward
compatibility. The docmap version is independent of the docref
version: a docmap/0.1 manifest may use docref/0.1 strings.

## 1. Manifest

The manifest declares an ordered list of sources and the doc-type
registry. For tbd it lives inline in `.tbd/config.yml` under a
`docmap:` key; for a standalone tool it would live in a dedicated
file (e.g. `docmap.yml`).

### 1.1 Top-level shape

```yaml
docmap:
  schema: docmap/0.1

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

    - docref: gitlab:my-group/my-docs@v1.0.0
      bundle: ours

    - docref: https://example.com/foo.md
      bundle: misc
      type: guideline
      as: foo
```

### 1.2 `doc_types`

Defines the consumer's set of doc types. Each entry:

- `name` (string, required)—the type name, used in canonical keys.
- `dir` (string, required)—canonical directory under `<bundle>/`
  where docs of this type land.
- `command` (string, optional)—for tools (like tbd) that surface
  each type as a dedicated CLI command. Pure format consumers can
  ignore it.

Built-in types are seeded by the consumer tool (e.g., `tbd setup`);
users can add their own. The format does not hardcode any types.

### 1.3 `sources`

An ordered list of source entries. Order is the **lookup order**:
when an unqualified lookup key resolves to multiple bundles, the
source listed first wins.

#### Per-source fields

**Required:**

- `docref` (string)—a valid docref (per docref/0.1 grammar).
- `bundle` (string)—the bundle name. Required for remote sources;
  optional for local sources (defaults to `local`). Lowercase
  letters, digits, and hyphens; 1–32 chars.

**Filtering:**

- `glob` (string, optional)—glob pattern selecting files from the
  source. Default: `**/*.md`.
- `ignore` (list of strings, optional)—gitignore-format patterns
  excluding files after the glob match. Supports `!` for re-inclusion.
- `contents` (list, optional)—explicit upstream-path → doc-type
  mapping (Section 1.4). Use when upstream layout doesn't match the
  doc-type-directory convention.

**Source mode:**

- `as` (string, optional)—when set to a name, treats the source
  as a single named item rather than a bag of files. Useful for
  single-URL sources or whole-repo references. The bundle's canonical
  key becomes `<bundle>` (no slash) and the item is addressed as the
  bundle name itself.
- `type` (string, optional)—the doc type for an `as`-style single
  item (must match a name in `doc_types`).
- `depth` (integer or `"full"`, optional)—git clone depth for
  `github:`/`gitlab:`/`git:` sources. Default: `1` (shallow). Use
  `"full"` if git history is required.

**Metadata:**

- `title` (string, optional)—human-readable title.
- `description` (string, optional)—what this source covers.
- `when` (string, optional)—when an agent should consult this
  source (trigger hint for the doc map).
- `metadata` (map, optional)—per-file metadata overrides keyed by
  filename relative to the source root. Each value is a
  `{ title?, description?, when? }` object.

**Auto-detection default:**

- `bundle` and the doc-type registry together provide a zero-config
  path: if no `contents` or per-file `metadata` is given, the
  implementation walks the upstream tree and matches subdirectory
  names against the `doc_types` registry's `dir` field. Files in
  matched subdirs become docs of that type; files in unmatched dirs
  are ignored.

### 1.4 `contents` mapping

When the upstream layout doesn't match the auto-detection convention,
or when you want to filter / rename / span multiple upstream paths
into one doc type, use the explicit `contents` list:

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

- `path` (string, required)—upstream path or glob (`docs/**/*.md`,
  `README.md`, etc.). Trailing `/` matches directory contents.
- `type` (string, required)—the doc type to assign (must match a
  name in `doc_types`).
- `as` (string, optional)—rename: the doc lands as
  `<bundle>:<type>/<as>` rather than using its upstream basename.

Resolution rules:

- Rules are evaluated top-to-bottom; first match wins for any given
  file.
- Combining `contents` with `glob`/`ignore` is allowed.
  `glob`/`ignore` filter the candidate set; `contents` classifies
  what remains.
- If `contents` is omitted, auto-detection (Section 1.3) applies.

### 1.5 Bundle name auto-suggestion

When a user adds a source via CLI, the implementation should suggest
a bundle name derived from the docref:

| docref | Suggested bundle |
|---|---|
| `./docs/agent/` | `local` (or `proj`, see consumer policy) |
| `github:jlevy/coding-guidelines@main` | `coding-guidelines` |
| `github:owner/repo` | `repo` (last path segment) |
| `gitlab:group/sub/proj` | `proj` (last path segment) |
| `https://example.com/foo` | `example-com` |
| `git:https://bitbucket.org/org/repo.git` | `repo` |

Users can override with explicit `--bundle`. The implementation
must print a preview of the resulting manifest change before
persisting, so users can review what bundle the docs will land in.

### 1.6 Reserved bundle names

`local`, `cache`, `sys` are reserved. Implementations may reserve
additional names (e.g., tbd reserves `tbd` for its built-in core).

## 2. Lockfile

The lockfile (`docmap.lock.yml` for a standalone tool,
`.tbd/docs.lock.yml` for tbd) records the exact resolved state of
each remote source. It plays the role `package-lock.json` plays for
npm: pins the cache to a known state for reproducible installs.

### 2.1 Schema

```yaml
# docmap.lock.yml—generated, do not hand-edit
docmap:
  schema: docmap/0.1

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

### 2.2 Per-source fields

**git sources (`github:`, `gitlab:`, `git:`):**

- `docref`—the docref from the manifest.
- `revision`—full SHA of the resolved commit.
- `hash`—content hash of the cached tree.
- `materialization.kind`—`git-shallow` or `git-full`.
- `materialization.depth`—clone depth used.
- `synced_at`—ISO 8601 timestamp.

**Web URL sources (`https:`, `http:`):**

- `docref`—the docref.
- `hash`—content hash of the fetched resource.
- `etag`—HTTP ETag for conditional re-fetch (optional).
- `materialization.kind`—`fetched-file`.
- `materialization.format`—`markdown` (HTML→md converted) or
  `original`.
- `synced_at`.

Local sources do not appear in the lockfile (they are read live).

### 2.3 Reproducibility contract

Given the same manifest + lockfile + working network, two `sync`
operations on different machines produce caches with identical
content hashes for every locked entry. This is the formal
reproducibility property.

## 3. Doc Map

The doc map (e.g. `docs/map.yml`) is the generated, machine-readable
index of every resolvable item. It is **lossless with respect to
addressability**—every indexed item appears in the map even if its
basename collides with another item's. Generated by `build`.

### 3.1 Schema

```yaml
# docs/map.yml—generated
docmap:
  schema: docmap/0.1

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

### 3.2 Fields

- `key`—canonical key (Section 4.1).
- `bundle`—bundle name.
- `type`—doc type name.
- `path`—landed path within `<bundle>/` (relative).
- `upstream_path`—original upstream path, if different from `path`.
- `title` / `description` / `when`—metadata, resolved per
  Section 3.3.
- `word_count`—approximate, for budget-aware rendering.

### 3.3 Metadata resolution layers

For each doc, metadata is resolved with this precedence (highest
first):

1. **Per-file overrides** in the manifest (`metadata:` map on the
   source entry).
2. **File frontmatter** (YAML frontmatter at the top of the doc, if
   present).
3. **Source-level defaults** in the manifest (`title` / `description`
   / `when` on the source entry).

This lets you annotate third-party content without modifying it
upstream.

### 3.4 Whole-source / repo aggregate entries

When `as: <name>` is set on a source (Section 1.3), the source
produces a single aggregate map entry (key = bundle name, no
`:type/path` suffix) rather than per-file entries. This is appropriate
for whole-repo references like library source code.

## 4. Item Addressing and Resolution

docmap distinguishes two kinds of references:

- **docrefs**—defined by the docref grammar; address resources
  *at their source*. Used in the manifest's `docref:` field. Resolved
  by sync.
- **lookup keys**—defined here; address indexed items *in the
  index*. Used in CLI / programmatic lookup queries. Resolved by the
  algorithm in Section 4.3.

The lookup chain: **lookup key → canonical key → on-disk path**.

### 4.1 Canonical keys

Every indexed item has exactly one canonical key:

```
<bundle>:<type>/<name>
```

Where:

- `<bundle>` is the source's bundle name.
- `<type>` is the doc type name (per `doc_types`).
- `<name>` is the item's basename relative to its type directory,
  with the `.md` extension stripped.

For `as:`-style aggregate sources, the key is just `<bundle>`.

Examples:

```
coding:guideline/typescript
writing:reference/writing-overview
proj:shortcut/migrate-to-v2
flask                              # whole-repo aggregate
```

Canonical keys must be globally unique across the index. If two
sources would produce the same canonical key, `build` fails with a
config error identifying both.

### 4.2 Lookup-key forms

A lookup key is one of:

| Form | Example | Meaning |
|---|---|---|
| Canonical key | `coding:guideline/typescript` | Exact item |
| Bundle-scoped basename | `coding:typescript` | Item with this basename in this bundle |
| Bare basename | `typescript` | Globally-unique basename |
| Alias | `ts-rules` | Declared alias on some item |
| Repo-subpath | `flask//src/flask/app.py` | File within a whole-repo source |

### 4.3 Resolution algorithm

Given a lookup-key query, the resolver attempts progressively
broader matches:

1. **Repo-subpath form.** If query contains `//`, split on first
   `//`. Left side must identify an `as:`-style aggregate source. If
   the path exists in that source's cache, return. Otherwise fail.

2. **Parse bundle scope.** If query contains `:`, split on first
   `:`. Left = bundle scope; right = name. Resolution is restricted
   to that bundle. If no `:`, all bundles are in scope.

3. **Exact canonical key match.** If the query (after step 2)
   matches a full canonical key (e.g., `guideline/typescript`),
   return.

4. **Basename match.** If exactly one item in scope has matching
   basename (filename without extension, ignoring directory), return.
   If multiple, fail with an `Ambiguous` error listing all matches.

5. **Alias match.** Same as basename but against declared aliases.

6. **Failure.** Return `NotFound` listing available canonical keys
   in scope (limited to a reasonable display count).

### 4.4 Collisions

- **Canonical key collisions** are fatal at `build` time.
- **Basename / alias collisions** are allowed: all colliding items
  remain in the index. Unqualified queries that hit them return
  `Ambiguous`; callers must use the canonical key or bundle-scoped
  form.
- A `status` operation reports collisions so users can detect
  unintended overlap.

### 4.5 Override via priority

When two sources contribute items with the **same `<type>/<name>`**
(but different bundles), they are **not** a collision; they are
independently addressable as `<bundle1>:<type>/<name>` and
`<bundle2>:<type>/<name>`.

Unqualified bare-basename queries respect source order: the bundle
whose source is listed first in the manifest wins. This is the
foundation of override semantics: a higher-priority `local` bundle
naturally shadows a lower-priority remote bundle for the same
basename.

## 5. Sync Semantics

The format defines three core operations:

### 5.1 `sync`

Ensures the cache matches the lockfile.

- If a lockfile exists, fetch each locked revision exactly. If the
  cache already matches the locked hash and materialization, skip.
- If no lockfile exists, resolve the current state of each source,
  populate the cache, write the lockfile.
- Idempotent: safe to re-run.
- Failures are isolated per source; lockfile is updated only for
  sources that synced successfully.
- Atomically swap cache contents per source on success (no partial
  state visible to readers).

### 5.2 `update [<bundle>]`

Resolves the latest state of each source (or one source by bundle
name), re-fetches, updates the lockfile. This is the "move forward"
operation.

### 5.3 `status`

Per source, reports:

- whether the cache matches the lockfile
- whether upstream has advanced past the locked revision (where
  detectable, e.g., for branch-pinned git sources)
- orphaned cache entries (in cache but not in manifest)
- collisions detected during last build

`status` is read-only and offline (it does not fetch).

### 5.4 Build

`build` walks the cache + local sources and produces the doc map.
Pure indexing—no network. Failures are per-source: a missing or
corrupt cache directory produces a clear error directing the user
to `sync`, while successfully indexed sources still appear in the
map.

## 6. Directory Layout

The format is agnostic to where its files live, but recommends:

```
<project>/
├── docmap.yml                     # Manifest (or inline in a host config)
├── docmap.lock.yml                # Lockfile (committed for reproducibility)
└── docs/                          # Implementation directory
    ├── .gitignore                 # Cache is gitignored
    ├── map.yml                    # Doc map (gitignored or committed; consumer choice)
    ├── <bundle>/                  # Per-bundle cached content
    │   ├── guidelines/
    │   │   └── typescript.md
    │   └── shortcuts/
    │       └── code-review.md
    └── repo-cache/                # Sparse git checkouts for git-scheme sources
        └── github.com-jlevy-coding-guidelines/
```

For tbd's specific embedding:

- Manifest is inline in `.tbd/config.yml` under `docmap:`.
- Lockfile is `.tbd/docs.lock.yml`.
- Doc map is `.tbd/docs/map.yml`.
- Cached content is `.tbd/docs/<bundle>/<type>/<name>.md`.
- Repo cache is `.tbd/docs/repo-cache/`.

## 7. Failure Model

Errors fall into five classes; implementations should distinguish
them:

1. **Config errors**—invalid manifest YAML, unknown docref scheme,
   unknown `schema` version, missing required field. Block all
   operations.
2. **Sync errors**—clone/fetch failure, ref not found, HTTP
   non-2xx, auth failure, hash mismatch. Reported per source;
   lockfile only updated for successful sources.
3. **Build errors**—missing cache (sync not run), glob syntax
   error, canonical-key collision. Reported per source; successful
   sources still appear in the map.
4. **Resolution errors**—`NotFound` (no match) or `Ambiguous`
   (multiple matches). Both include the candidate set in the error.
5. **Retrieval errors**—file unreadable, encoding issue.

All error messages must include: the source or lookup key that
failed, the specific reason, and a suggested fix when applicable
("run `sync`", "configure git credentials", etc.).

## 8. Versioning and Stability

- `docmap/0.1` is the initial draft. Breaking changes are allowed
  before `1.0`.
- Future minor versions (`0.2`, `0.3`) add fields without breaking
  existing manifests.
- `1.0` will mark the stable boundary; from then on, breaking
  changes require a major bump and a one-shot migration tool.

## 9. Integration: tbd-Specific Extensions

tbd embeds this format and adds the following on top—these are
NOT part of the core docmap format but are documented here for
cross-reference:

- **`tbd source eject <bundle:name>`**—copies a cached doc into a
  local bundle and `git add`s it. (See plan-spec G4, G8.)
- **`tbd source diff/upstream/unfork`**—local-override roundtrip
  workflow against the cached upstream. (G5.)
- **`tbd doc <type> <name>`**—generic dispatcher to type-specific
  commands (`tbd shortcut`, `tbd guidelines`, etc.) per the
  `command` field on `doc_types`. (G7.)
- **`tbd doc status`**—bundle-aware status output combining the
  doc map, lockfile, and divergence detection. (G6.)
- **Bundle-scoped `tbd shortcut --bundle <name>`** filter on
  listings.

A standalone docmap tool would expose the format primitives directly
(`docmap sync`, `docmap build`, `docmap resolve <key>`, `docmap get
<key>`) without these tbd-specific workflows. The two layers are
designed to compose cleanly.

<!-- This document follows std-doc-guidelines.md.
Review guidelines before editing.
-->
