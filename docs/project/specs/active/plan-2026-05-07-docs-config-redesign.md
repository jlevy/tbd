---
title: Docs Config Redesign
description: Redesign the docs/config system around a unified ordered source list, supporting bundled, local, mirrored, and overridden docs with promotion and roundtrip workflows
---
# Feature: Docs Config Redesign

**Date:** 2026-05-07 (last updated 2026-05-07)

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

## Overview

Redesign how `tbd` represents, fetches, and resolves agent documentation
(shortcuts, guidelines, templates, references, and future doc types). The current
f03 format treats docs as a flat per-file map (`docs_cache.files`) plus a parallel
search-path array (`docs_cache.lookup_path`). PR #87 (the f04 design that was never
merged) introduced a `sources` array, prefix-based namespacing, and a `RepoCache`
for sparse git checkouts — directionally right, but landed half-built and carries
three coexisting compatibility layers (`sources` + `files` + `lookup_path`) that
already produced a dozen "lookup_path zombie" bug fixes during review.

This spec proposes a clean re-cut: **one ordered list of sources, four source
types (`bundled` / `local` / `git` / `url`), no parallel `files`/`lookup_path`
machinery, and doc types as data**. It also designs the local↔mirror promotion
and upstream-roundtrip workflows that goals 4, 5, and 8 require, which neither
the current system nor PR #87 actually implements.

This is a **planning spec at the design-options stage**. It outlines three
candidate approaches with pros/cons before nailing down details. Once an
approach is chosen, a follow-up implementation spec will break it into beads.

## Goals

These are the goals as stated by the user, restated explicitly so we can verify
nothing is lost:

### G1. Easy setup with common bundled docs

Installing tbd should make it easy to pull in a curated set of guidelines,
shortcuts, templates, and other doc types out of the box. Most of these should
live in a separate repo (or repos) rather than inside the tbd CLI codebase, so
they can evolve independently of npm releases. A small core remains internal.

### G2. Easy addition of new local, project-specific docs

It must be easy to add a new doc of any kind that lives in the current repo
(typically under `docs/`) and is versioned with the project. No copy step, no
stub pointer, no separate registration ceremony — just put the file in the
right place and it shows up.

### G3. Easy addition of mirrored docs from external sources

Docs should be pullable from any of: a GitHub repo, an S3 / GCS / generic
object-store path, an arbitrary URL, or a local filesystem path. The model
should be a **flexible reference to a source of files**, not a hardcoded list
of supported source types.

Mirrored docs are **cached locally on disk but not git-tracked by default**.
The cache lives under `.tbd/docs/` (already gitignored) — exactly the same
model `tbd sync` already uses for issues. This means:

- The cache is fast to read (just files on disk; no network at lookup time).
- The cache is reproducible from config (G9): another clone of the repo
  + `tbd sync --docs` reproduces the same content.
- The repo doesn't churn on every upstream change — mirrored content
  doesn't appear in `git status` or `git diff`.

To pull a mirrored doc into git-tracked content (so you can edit and version
it locally), use the promotion / override workflow in G4. G3 covers the
"read-only mirror" path; G4 covers the "fork it locally" path.

### G4. Easy local override of mirrored docs (shadcn-style)

When you need to fix or adapt a mirrored doc, you should not have to push the
fix upstream first. You should be able to copy the doc into a local
git-tracked location and modify it there, with the local version taking
precedence — the same mental model as
[shadcn/ui](https://ui.shadcn.com)'s "copy and own" approach.

### G5. Roundtrip: edit local override → review diff → push upstream → resync

Once a local override has been refined, you should be able to push it back
upstream (e.g. open a PR against the source repo), and after it's merged, the
local override is dropped and the doc is once again served from the mirror —
"as if" it had been mirrored all along.

### G6. Status visibility for all doc workflows

`tbd` should expose the state of every doc and source at any time: where each
doc came from, whether the upstream cache is stale, whether a local override
exists, whether the override diverges from upstream, whether a source is
healthy.

### G7. Doc types are extensible, not hardcoded

There are common built-in doc types (shortcuts, guidelines, templates,
references), but the set should be open. New doc types should be addable by
declaring a directory name and a CLI surface — without forking tbd. The
current code (`DocType = 'guideline' | 'shortcut' | 'template'`) and PR #87
(`DocTypeName` registry, still a closed union) both fail this.

### G8. Mix git-tracked local docs with gitignored cached docs, with promotion between modes

Mirrored remote docs should live in a gitignored cache (it's clumsy to
re-commit mirrored content on every sync). Local-authored docs and local
overrides should be git-tracked. There should be a clear command to **promote**
a mirrored doc to a tracked override, and (less commonly) the inverse.

### G9. Reproducible / pinnable mirror state

A mirrored source should be pinnable to a specific git ref (commit, tag, or
branch). Cache content should be reproducible from config — given the same
config and a working network, two checkouts produce the same docs. This is
how the existing tbd-sync model already works for issues.

### G10. Provenance and integrity per doc

Every doc in the cache should carry provenance metadata: which source it came
from, which ref / URL / path within that source, and (for git sources) which
commit. This is what makes G6 (status) and G5 (roundtrip diffs) cleanly
implementable.

### G11. Hard cut on config format, with reliable migration from old formats

The PR #87 lineage shows that keeping deprecated fields alive at runtime
(`lookup_path` alongside `sources`) generated 12 separate bug-fix commits as
the deprecated field kept reappearing through different code paths. The new
format (call it f05) should be a **hard cut**: only one schema is valid at
runtime; deprecated fields are not understood, not written, not tolerated.

The compatibility surface lives entirely in **format detection + one-shot
migration**, not in layered runtime support:

- On every config read, detect the format version (`tbd_format: f03|f04|f05`).
- If older than current, run a deterministic migration to f05 in memory; if
  the user is doing a write operation, persist the migrated form. Existing
  `tbd-format.ts` already does this for f02→f03; extend the same pattern.
- Migration must be **reliable**: round-trip tests on representative f03 and
  f04 configs (with various `files:` shapes, URL overrides, custom prefixes)
  must produce f05 configs that resolve to the **same set of docs** as the
  source configs did. No silent data loss, no hidden re-additions.
- Migration warnings (e.g., a custom `files:` URL override that becomes a
  `url`-type source) are surfaced to the user rather than buried.
- After migration, the f05 schema validator rejects any field it doesn't
  recognize — this is what prevents zombies from creeping back in.

The contract: **users don't touch their config to upgrade**, but the
runtime never sees more than one valid shape at a time.

### G12. Atomic, all-or-nothing sync per source

A failed mirror sync (clone fails, network error, single bad file) should not
leave the cache in a partially updated state. Sync to a temp location, then
swap atomically. Today's per-file URL fetches do not have this property.

### G13. Auth is always out-of-band — tbd never handles credentials

tbd does not implement, configure, or store authentication for any source
backend. Public URLs and public git repos must just work; private sources
must be made accessible via the underlying tool's own auth mechanism, and
tbd inherits that environment as-is.

In practice:

- **Git sources**: rely on the user's existing `git` config — SSH keys for
  `git@github.com:...` URLs, `gh` CLI auth for `https://github.com/...`
  URLs, credential helpers, etc. tbd shells out to git and lets git
  authenticate.
- **URL sources**: a public HTTP(S) URL works directly. For URLs requiring
  auth, the user uses whatever the underlying tool (curl, gh) already has
  — we do not add bearer-token fields to the schema.
- **Object stores (S3/GCS, future)**: rely on the standard SDK env vars
  (`AWS_PROFILE`, `GOOGLE_APPLICATION_CREDENTIALS`, etc.). tbd's job is to
  invoke the right command/SDK; the user's job is to have credentials
  configured.

Consequence: there is **no `auth:` field in the source schema, ever**. If
a private source fails to fetch, the error message says "configure your
credentials for `<backend>`" and points at the relevant tool's docs. This
keeps tbd's surface small, avoids a long tail of credential-handling
security bugs, and means private-source support arrives the moment the
underlying tool's auth works in the user's environment — no tbd changes
required.

### G14. Bundles as the first-class organizing unit

Every doc belongs to exactly one **bundle**. A bundle represents an
ownership / origin grouping: a GitHub repo, a website domain, an internal
team's doc set, the core that ships with tbd, or `local` for
project-specific docs that don't live anywhere else. Bundles are
user-visible everywhere docs surface — `tbd doc status`, `tbd shortcut
--list`, the on-disk cache layout under `.tbd/docs/<bundle>/`, the
config, and provenance metadata.

Bundles drive:

- **Listing and filtering** (`tbd doc status --bundle acme`,
  `tbd shortcut --bundle proj`)
- **Override semantics** (a doc in a higher-priority bundle shadows a
  doc with the same name in a lower-priority bundle — this is exactly
  G4's mechanism, expressed in bundle terms)
- **Provenance display** (G10 metadata is bundle-scoped: which bundle,
  which ref within that bundle, which upstream path)
- **Status output** (G6: organize by bundle, then by doc, then state)

Within a bundle, the upstream source's layout can be anything — a source
config maps which upstream paths to mirror. The **landed** layout under
`.tbd/docs/<bundle>/` is canonical:
`<bundle>/<doc-type-folder>/<name>.md` (e.g.,
`.tbd/docs/acme/guidelines/python-rules.md`). Doc-type folders
(`guidelines/`, `shortcuts/`, etc.) are the only layout convention that
matters; everything above the doc-type folder is bundle-flat.

Bundles are 1:1 with sources in the schema (one source = one bundle),
and the bundle name is the source's identifier. This unifies what
PR #87 called "prefix" with the higher-level ownership concept the user
actually reasons about.

### G15. Bundle names auto-suggested at add time, explicit, previewable before commit

Adding a source proposes a bundle name derived from the source URL or
path:

- `github:acme/docs` → `acme-docs` (or `acme/docs`, TBD on slashes)
- `https://example.com/foo.md` → `example-com`
- A local source in `docs/agent/` → `local` (the default for local
  sources unless multiple exist)

The user can override with explicit `--bundle <name>`. Before the
config change is persisted, `tbd source add` prints a preview of the
pending change — which bundle name, which docs would land where, what
will be added to `.gitignore` — so the user can review before any sync
runs. This makes adding a mirrored source low-risk and reversible.

## Non-Goals

- Real-time / webhook-driven sync. Sync remains explicit (`tbd sync --docs`)
  with the existing 24h-staleness auto-trigger.
- A general git client (no merge resolution, no rebases on the cache).
- Conflict resolution between concurrent local edits and upstream changes
  beyond "show the diff and let the user pick" — see G5.
- Migrating issue storage. This spec is purely about docs/config.
- Authentication for private sources (deferred per G13).

## Background

### Current state (f03)

`.tbd/config.yml` carries:

```yaml
docs_cache:
  lookup_path:                                     # search order, like $PATH
    - .tbd/docs/shortcuts/system
    - .tbd/docs/shortcuts/standard
  files:                                           # one row per doc
    shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
    guidelines/python-rules.md: internal:guidelines/python-rules.md
    # ... 60+ rows ...
```

Doc types are a closed union (`packages/tbd/src/file/doc-add.ts:24`). External
docs are addable per-URL via `--add=<url>`, which appends one row to `files`.
There is no notion of a "source" as a first-class entity, no caching of git
repos, no namespacing, and no override workflow.

### PR #87 attempt (f04, unmerged)

PR #87 introduced:

- `docs_cache.sources: [...]` array of `{ type: 'internal'|'repo', prefix, url?, ref?, paths }`
- Prefix-based layout: `.tbd/docs/{prefix}/{type-dir}/{name}.md`
- `tbd source add/list/remove` commands
- `RepoCache` doing `git clone --depth 1 --sparse`
- Doc-types registry in code (`DOC_TYPES: Record<DocTypeName, ...>`), adds
  `reference` as a fourth type
- Qualified lookup `prefix:name`
- f03→f04 migration pulling default `internal:` rows out of `files` into
  synthetic `sys` and `tbd` sources

#### What worked

The `sources` concept and prefix namespacing are the right abstractions.
RepoCache is the right primitive for goal 3.

#### What didn't

1. **Three coexisting layers in the schema** — `sources` + `files` +
   `lookup_path`. Twelve bug-fix commits in the PR fight "lookup_path
   zombies" (the deprecated field reappearing after sync).
2. **`sources` is config-time only** — `resolveSourcesToDocs()` flattens the
   list back to the same `Record<string, string>` the old code used. Sources
   are never used at runtime lookup. This is why `files` had to stay as
   override.
3. **Repo sync is not wired** — `resolveSourcesToDocs()` has
   `// repo type will be added in Phase 2`. `tbd source add github:foo/bar`
   writes config but `tbd sync --docs` doesn't fetch it.
4. **Local sources are spec-only** — the spec describes a `type: 'local'`
   with stub pointer files, but the implemented enum is `['internal', 'repo']`.
   G2 is unmet by the code.
5. **Doc types still a closed enum** dressed up as a registry. G7 half-met.
6. **No promotion / eject / roundtrip.** G4, G5, G8 explicit non-goals in the
   PR spec.
7. **Source-type vs doc-type conflation.** `DocsSourceSchema.paths` actually
   means doc-type subdirs (`['shortcuts/']`) — the link is implicit.

The PR's `done/plan-2026-02-02-external-docs-repos.md` (3010 lines) reflects
the right direction; this spec is a re-cut that finishes it.

### Design tensions to resolve

1. **One mechanism vs. layered mechanisms.** PR #87 keeps three; I think one
   ordered source list is enough.
2. **Stub pointers vs. direct local sources.** PR #87 spec proposed stub files
   in `.tbd/docs/` with `_source` / `_path` frontmatter pointing at tracked
   files elsewhere. I think this is unnecessary indirection — DocCache can
   read tracked dirs directly.
3. **Source types: open registry vs. enum.** Are `bundled` / `local` / `git` /
   `url` the only types we ever want? Or should it be pluggable (e.g., S3,
   GCS, custom)?
4. **Doc types: hardcoded vs. config-driven.** `tbd guidelines`, `tbd shortcut`
   etc. are dedicated subcommands. Is a new doc type also a new command, or
   does it fall under a generic `tbd doc <type>`?
5. **Override mechanics: shadow-by-priority vs. explicit override flag.**
   Does `proj` source higher in the list automatically shadow `acme`, or is
   there an explicit `overrides: acme:python-rules` field?

## Design

The design is **one ordered list of sources, one bundle per source, four
source types, no parallel `files` or `lookup_path` machinery, and doc
types as data**. PR #87's direction was right; this is the same idea
finished — with the override / promotion / roundtrip workflows that
PR #87 didn't build, and without the three coexisting compatibility
layers that produced PR #87's twelve bug-fix commits.

A deferred future direction (fully pluggable source-type providers) is
also sketched below to confirm it's not the right starting target.

### Schema and source types

One concept does what three currently do.

```yaml
tbd_format: f05
docs_cache:
  sources:
    # builtin: ships with the tbd npm package; contents known at build time.
    # (Source type is named "builtin" to avoid term-collision with "bundle".)
    - { type: builtin, bundle: sys,  hidden: true }
    - { type: builtin, bundle: tbd }

    # local: a tracked directory in the repo. DocCache reads it directly.
    # Use this for project-specific docs (G2) AND for overrides (G4).
    - { type: local,   bundle: proj, path: docs/agent }

    # git: sparse-checked-out external repo, gitignored cache (G3, G9).
    - { type: git,     bundle: acme, url: github:acme/docs, ref: v1.2.0,
        include: [guidelines/, shortcuts/] }

    # url: rare per-file case (current --add=<url> use case).
    - { type: url,     bundle: misc, files: { foo: "https://..." } }

  # No `files:`. No `lookup_path:`. Order in `sources` IS the lookup order.
```

**Lookup semantics.** Sources are searched in declared order. First match
wins for unqualified names; qualified names (`acme:python-rules`) target
a specific bundle and skip priority. Overrides are achieved by putting a
`local` source higher in the list — there is no `overrides:` field (G4).

**Doc types: directories, declared once.**

```yaml
doc_types:
  - { name: shortcut,   dir: shortcuts,   command: shortcut }
  - { name: guideline,  dir: guidelines,  command: guidelines }
  - { name: template,   dir: templates,   command: template }
  - { name: reference,  dir: references,  command: reference }
  # User adds:
  - { name: playbook,   dir: playbooks,   command: playbook }
```

Built-in types are seeded by `tbd setup`. Adding a new type means adding a
row here; the CLI generates a generic `tbd doc <type> <name>` and aliases
the named ones. (G7 met for real.)

**Local sources are real directories, not stubs.** A `local` source's `path`
is a tracked directory; DocCache reads it directly. `.tbd/docs/` only holds
the *builtin* and *cached* content — it remains gitignored.

**Override is just priority.** No `overrides:` field. To override
`acme:python-rules`, copy the file into `docs/agent/guidelines/python-rules.md`
(the `proj` bundle's directory). It now wins because `proj` is listed before
`acme`. (G4 met by the same mechanism that gives us local docs.)

**Promotion command (G8).**

```
tbd source eject acme:python-rules
```

Copies the cached upstream into the first writable `local` source's
appropriate type directory, and `git add`s it.

**Roundtrip commands (G5).**

```
tbd source diff   acme:python-rules     # diff local vs cached upstream
tbd source upstream acme:python-rules    # open PR upstream via gh (if github source)
tbd source unfork acme:python-rules      # delete local override after upstream merge
```

`tbd sync --docs` after the upstream merge picks up the new content; the
local override (now removed) no longer shadows it.

**Status (G6).**

```
tbd doc status [name]
```

Walks sources in order, shows for each doc:
- which source resolved it
- whether shadowed by a higher source
- whether the upstream cache is stale
- whether a local override diverges from cache (and by how much)

**Provenance (G10).** Each cached doc gets a sidecar (or frontmatter
augmentation, TBD) with `{ bundle, source_ref, source_path, fetched_at,
content_hash }`. `bundle` is the user-visible name; everything else is
the bundle-internal addressing.

**Migration (G11).** f03/f04 → f05 is a one-shot transformation:

- f03 `files: { dest: internal:src }` rows are absorbed into synthetic
  `sys` / `tbd` builtin sources.
- f03 `files: { dest: https://... }` rows become a `url`-type source
  (with auto-suggested bundle name from the URL host, per G15).
- f03 `lookup_path` is dropped.
- f04 `sources` is preserved with field renames (`type: 'internal'` →
  `'builtin'`, `type: 'repo'` → `'git'`, `prefix:` → `bundle:`).
- The deprecated fields are deleted with no runtime fallback. If you don't
  migrate, the CLI errors with a clear "run `tbd doctor --fix`" message.

### Deferred: pluggable source-type providers

Worth naming so it's not lost: a future direction is making source types
themselves pluggable. A source-type provider would be a Node module (or
external command) implementing `list(config) → docs[]` and `fetch(doc) →
content`. Built-ins (`builtin`, `local`, `git`, `url`) ship with tbd;
users register others (S3, GCS, custom internal stores) via config.

This is significantly more design surface (caching, refs, content
addressing, partial failure all need to be in the provider contract),
plus the security and packaging footguns that come with plugin loading
in a CLI tool. Most users don't need it. The current design keeps the
option open — source types are an enum at first; opening to a registry
later is a localized change. **Defer.**

### Decisions to confirm before implementation

The design above is the proposal. These specific choices are flagged so
they can be confirmed (or pushed back on) before any code is written:

- The four built-in source types (`builtin`, `local`, `git`, `url`) are
  sufficient for the first cut. S3/GCS/etc. wait for the deferred
  pluggable-provider direction.
- "Override = priority in source list" rather than an explicit
  `overrides:` field. (Simpler model; UX risk acknowledged — mitigated
  by `tbd doc status`.)
- Clean break with no `lookup_path` runtime fallback (G11).
- Doc types live in config (`doc_types:`) rather than a code-level
  registry, with built-in types seeded by `setup`.
- The builtin doc set mostly moves out to a separate repo (e.g.
  `github:jlevy/tbd-docs`), kept as a `git`-type source by default
  rather than a `builtin` source. (G1.)
- Source type is named `builtin` (not `bundled`) so the type name
  doesn't collide with the bundle concept (G14).

## Open Questions

These need resolution before the implementation spec.

1. **Where do bundled docs live?** A separate public repo (`github:jlevy/tbd-docs`),
   one per category, or stay inside `packages/tbd/docs/`? Mixed
   (small core internal + most external) seems right but specifics matter.
2. **What's the exact source type for "current repo's `docs/` dir"?** Do we
   call it `local` or `repo` (and use `git` for external)? Naming matters
   for clarity.
3. **Provenance: sidecar files or frontmatter augmentation?** Sidecars
   (`foo.md.meta.yml`) keep doc files clean but double the entries.
   Frontmatter pollutes the doc but stays inline. Lean toward sidecars.
4. **Atomic sync (G12) at what granularity?** Per source (all of acme or
   none) seems right, but per-doc-type may be acceptable.
5. **Reserved bundle names.** `sys` and `tbd` are reserved. What else?
   `local`? `cache`? Should `local` be the always-on default bundle for
   any local-source addition?
6. **Override directory layout.** When `tbd source eject acme:python-rules`
   runs, the local target is `docs/agent/guidelines/python-rules.md` (the
   `proj` bundle's directory). What if there are multiple `local`
   bundles? Pick first writable, or require `--to <bundle>`?
7. **Bundle name auto-derivation rules.** What's the canonical mapping
   from URL → bundle name? Examples: `github:acme/docs` → `acme-docs`?
   `acme/docs`? `acme.docs`? `https://example.com/foo` → `example-com`
   or `example.com`? Need a deterministic rule that's both readable and
   safe as a directory name.
8. **Bundle = source 1:1, or many sources per bundle?** Current design
   is 1:1 (one source = one bundle). Is there a real use case for
   multiple sources contributing to one bundle (e.g., two URL-type
   sources both labeled `acme`)? Probably not, but worth confirming.
9. **Roundtrip auth boundary (G13).** Confirm tbd's failure messaging
   contract: when a fetch or push fails because credentials aren't
   configured, the error names the underlying tool (`git`, `gh`, `aws`,
   etc.) and points at its own auth docs. tbd never prompts for or stores
   credentials.
10. **Hidden vs visible bundles.** Currently `sys` is hidden from
    `--list`. Is `hidden: true` per source still the right knob, or
    should listing filter by source-type / bundle?
11. **Should `builtin` be a source type at all,** given the goal of
    moving most built-in docs out? Maybe a single small `core` builtin
    source with no user-visible shape, and everything else is
    `git`/`local`/`url`.

## Implementation Plan

Two phases. Splitting purely so we can validate the schema and migration
before building eject/roundtrip commands on top.

### Phase 1: New schema, source types, doc-type registry, migration

- [ ] Define f05 `DocsCacheSchema` (Zod) with `sources` array, no
  `files` / `lookup_path`. Source types: `builtin` | `local` | `git` | `url`.
- [ ] Define `doc_types` config block with built-in seeds.
- [ ] Implement source resolution: walk `sources` in order, produce a
  `(bundle, type, name) → file path` map.
- [ ] Replace `DocCache.lookupPath`-based logic with source-walking logic.
  Qualified lookup `bundle:name` works.
- [ ] Implement source-type fetchers:
  - `builtin` — read from package `dist/docs/`
  - `local` — direct directory read (no copy)
  - `git` — port `RepoCache` from PR #87, completing the sparse-checkout
    update path; atomic swap on success
  - `url` — single-file fetch with `gh` fallback (port from current code)
- [ ] One-shot migration f03/f04 → f05 in `tbd-format.ts`. No runtime
  compat: deprecated fields are deleted in the migration write.
- [ ] `tbd source add/list/remove` for `git` and `url` source types,
  with bundle-name auto-suggestion (G15) and a confirmation preview.
  `builtin` and `local` are managed by setup / config edits respectively.
- [ ] `tbd bundle list` / `tbd bundle show <name>` as bundle-oriented
  views over the source list (G14).
- [ ] Update `tbd setup` to seed default sources (likely a small
  `builtin` core + a default external `tbd-docs` git source — see open
  question 1).
- [ ] Update `tbd sync --docs` to drive source-type fetchers.
- [ ] Update `tbd doctor` checks to validate source health (clone exists,
  ref reachable, paths populated).
- [ ] Provenance sidecars (or chosen alternative — see open question 3)
  written by the cache pipeline; bundle name is the user-visible field.
- [ ] All existing doc commands (`tbd shortcut`, `tbd guidelines`,
  `tbd template`, `tbd reference`) work via the new resolution path.
  Generic `tbd doc <type> <name>` registered.
- [ ] Tests: schema validation, migration golden tests for f03→f05 and
  f04→f05, source resolution unit tests, RepoCache integration tests
  with a fixture repo, status output golden tests, bundle-name
  auto-suggestion golden tests across URL shapes (G15).

### Phase 2: Override / promotion / roundtrip workflows

- [ ] `tbd source eject <bundle:name> [--to <local-bundle>]` — copy
  cached doc into a local bundle's dir, `git add`.
- [ ] `tbd source diff <bundle:name>` — diff local override vs cached
  upstream content.
- [ ] `tbd source upstream <bundle:name>` — for `git`-type sources with a
  GitHub URL, open a PR upstream via `gh`. For other source types: print
  the patch with instructions. Document the contract for non-GitHub git
  sources clearly.
- [ ] `tbd source unfork <bundle:name>` — delete local override after
  upstream merge; next sync re-pulls upstream.
- [ ] `tbd doc status [name]` — show provenance, shadow state, staleness,
  divergence for a single doc or all docs.
- [ ] Tests: end-to-end eject → edit → diff → unfork flow against a
  fixture git source; status output golden tests.

## Testing Strategy

- **Unit:** schema validation, parser/migrator (f03/f04→f05), source
  resolution, bundle-name collision handling, `parseQualifiedName`.
- **Integration:** RepoCache against a local bare-repo fixture; full
  sync cycle with mixed source types.
- **Golden / tryscript:** existing doc-command tryscripts updated; new
  ones for `tbd source eject`, `tbd doc status`.
- **Migration:** representative f03 configs (with various `files:` shapes
  including URL overrides) and f04 configs migrate cleanly with no
  zombie fields and no data loss. Round-trip validation: migrated config
  produces identical resolved doc set as the source config did.

## Rollout Plan

f05 is a clean break with one-shot migration. Releasing as a minor bump
(0.x → 0.x+1) is acceptable while pre-1.0; document the migration in
release notes. `tbd doctor --fix` performs the migration; first run after
upgrade prompts the user before mutating config.

## References

- PR #87 (unmerged): https://github.com/jlevy/tbd/pull/87
- Original spec: `docs/project/specs/done/plan-2026-02-02-external-docs-repos.md`
  (3010 lines; useful for prior-art on RepoCache, prefix design,
  qualified names)
- Current schema: `packages/tbd/src/lib/schemas.ts`
- Current doc commands: `packages/tbd/src/cli/lib/doc-command-handler.ts`
- Current sync: `packages/tbd/src/file/doc-sync.ts`
- shadcn/ui copy-and-own pattern: https://ui.shadcn.com (mentioned for G4)
