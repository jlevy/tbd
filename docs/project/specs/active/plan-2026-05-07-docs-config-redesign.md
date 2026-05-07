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
of supported source types. Mirrored docs are auto-cached locally and refreshed
via an explicit sync (the same model `tbd sync` already uses for issues).

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

### Additional goals (proposed — please confirm)

These are goals I think are natural extensions of yours and worth nailing
down explicitly. Please mark each as "in" or "out" before we finalize.

#### G9. Reproducible / pinnable mirror state

A mirrored source should be pinnable to a specific git ref (commit, tag, or
branch). Cache content should be reproducible from config — given the same
config and a working network, two checkouts produce the same docs. This is
how the existing tbd-sync model already works for issues.

#### G10. Provenance and integrity per doc

Every doc in the cache should carry provenance metadata: which source it came
from, which ref / URL / path within that source, and (for git sources) which
commit. This is what makes G6 (status) and G5 (roundtrip diffs) cleanly
implementable.

#### G11. No zombie / no-compat schema (clean break with format bump)

The PR #87 lineage shows that keeping deprecated fields alive (`lookup_path`
alongside `sources`) generated 12 separate bug-fix commits. I think the new
format (call it f05) should drop deprecated fields entirely and migrate f03/f04
configs forward in a single one-shot transformation. Backward compatibility is
provided by **migration**, not by **layered runtime support**.

#### G12. Atomic, all-or-nothing sync per source

A failed mirror sync (clone fails, network error, single bad file) should not
leave the cache in a partially updated state. Sync to a temp location, then
swap atomically. Today's per-file URL fetches do not have this property.

#### G13. Auth deferred but designed-for

Private GitHub repos, private S3 buckets, etc. are out of scope for the first
implementation — but the source schema should leave a clean place for auth
config to land later (e.g., `auth: { method: 'gh' | 'env' | ... }`) without
another schema break.

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

This section presents three candidate approaches at increasing levels of
ambition, then makes a recommendation. The point is to surface the tradeoffs
clearly before committing.

### Approach A: Finish PR #87 as-designed

**Shape.** Merge PR #87, complete the `repo` type sync wiring, implement the
already-designed `local` type with stub pointers, add a `tbd source eject`
command to copy a mirrored doc into a local override.

**Pros.**
- Smallest delta from existing state. ~80% of the code is already written.
- Lowest review/migration risk — the f04 migration already exists and is
  tested.

**Cons.**
- Carries forward all three of `sources` / `files` / `lookup_path`. The
  zombie class likely keeps producing bugs.
- Stub-pointer local sources are confusing (a `.md` file in the cache that
  isn't really the doc).
- Doc-type registry is still a code-level closed enum.
- G4/G5/G8 still need to be added on top — no smaller than option B for
  those.

**Verdict.** Pragmatic if we want to ship fast. But the schema cleanup we'd
defer is real technical debt, and the spec already counts 12 bug fixes against
it.

### Approach B (recommended): Unified ordered source list, clean f05 schema

**Shape.** One concept does what three currently do.

```yaml
tbd_format: f05
docs_cache:
  sources:
    # Bundled: ships with the tbd npm package; contents known at build time
    - { type: bundled, prefix: sys,  hidden: true }
    - { type: bundled, prefix: tbd }

    # Local: a tracked directory in the repo. DocCache reads it directly.
    # Use this for project-specific docs (G2) AND for overrides (G4).
    - { type: local,   prefix: proj, path: docs/agent }

    # Git: sparse-checked-out external repo, gitignored cache (G3, G9)
    - { type: git,     prefix: acme, url: github:acme/docs, ref: v1.2.0,
        include: [guidelines/, shortcuts/] }

    # URL: rare per-file case (current --add=<url> use case)
    - { type: url,     prefix: misc, files: { foo: "https://..." } }

  # No `files:`. No `lookup_path:`. Order in `sources` IS the lookup order.
```

**Lookup semantics.** Sources are searched in declared order. First match
wins for unqualified names; qualified names (`acme:python-rules`) skip the
priority order and target a specific source. This is identical to the PR #87
prefix model but with no `files` override field — overrides are achieved by
putting a `local` source higher in the list (G4).

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
the *bundled* and *cached* content — it remains gitignored.

**Override is just priority.** No `overrides:` field. To override
`acme:python-rules`, copy the file into `docs/agent/guidelines/python-rules.md`
(the `proj` source's directory). It now wins because `proj` is listed before
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
augmentation, TBD) with `{ source_prefix, source_ref, source_path,
fetched_at, content_hash }`.

**Migration (G11).** f03/f04 → f05 is a one-shot transformation:

- f03 `files: { dest: internal:src }` rows are absorbed into synthetic
  `sys` / `tbd` bundled sources.
- f03 `files: { dest: https://... }` rows become a `url`-type source.
- f03 `lookup_path` is dropped.
- f04 `sources` is preserved with field renames (`type: 'internal'` →
  `'bundled'`, `type: 'repo'` → `'git'`).
- The deprecated fields are deleted with no runtime fallback. If you don't
  migrate, the CLI errors with a clear "run `tbd doctor --fix`" message.

**Pros.**
- One concept, one mechanism. No zombie field class.
- G2, G4, G7, G8 fall out naturally; G5/G6 are thin commands over git/gh.
- Schema is small enough to fit on a screen.
- Migration is a one-shot transform — no ongoing compat surface.

**Cons.**
- Bigger delta from current state than A. Some PR #87 code (RepoCache,
  format migration) carries over; some (the closed-type registry, the
  stub-pointer local design) does not.
- `bundled` source type means the CLI knows about a directory shipped in
  the npm package; any pluggable bundle requires a `git` source instead.
  Probably fine.
- "Override = priority" is implicit. Newcomers may not realize a doc with
  the same name in `proj` shadows one in `acme`. Mitigated by `tbd doc
  status` and good error messages.

### Approach C: Fully data-driven, source types as plugins

**Shape.** Like B, but source types are themselves pluggable. A source-type
provider is a Node module (or external command) implementing a small
contract: `list(config) → docs[]`, `fetch(doc) → content`. Built-ins
(`bundled`, `local`, `git`, `url`) ship with tbd; users can register
others (S3, GCS, custom internal stores) via config.

**Pros.**
- Truly extensible. S3/GCS/Artifactory don't need a tbd code change.
- Clean separation: source-type providers are just data adapters.

**Cons.**
- Significantly more design surface. The provider contract has to handle
  caching, refs, content addressing, partial failure.
- Most users don't need it. tbd is small and ships fast.
- "Plugin loading from a CLI tool" is a known footgun (security, packaging,
  Node module resolution).

**Verdict.** Probably right *eventually*, but not the right starting target.
Approach B keeps the option open: source types are an enum at first; opening
to a registry later is a localized change. Defer.

### Recommendation

**Approach B**, with the following caveats explicitly called out for review
before any code is written:

- Confirm the four built-in source types (`bundled`, `local`, `git`, `url`)
  are sufficient for the first cut. (S3/GCS deferred to Approach C, future.)
- Confirm "override = priority in source list" rather than an explicit
  `overrides:` field. (Simpler model; UX risk acknowledged.)
- Confirm clean break with no `lookup_path` runtime fallback, only one-shot
  migration (G11).
- Confirm doc types live in config (`doc_types:`) rather than a code-level
  registry, with built-in types seeded by `setup`.
- Confirm the bundled doc set should mostly move out to a separate repo
  (e.g. `github:jlevy/tbd-docs`), kept as a `git`-type source by default.
  (G1.)

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
5. **Reserved prefixes.** `sys` and `tbd` are reserved. What else? `local`?
   `cache`?
6. **Override directory layout.** When `tbd source eject acme:python-rules`
   runs, the local target is `docs/agent/guidelines/python-rules.md` (with
   prefix `proj`). But what if there are multiple `local` sources? Pick
   first writable, or require `--to <prefix>`?
7. **Roundtrip auth (G13).** First version assumes `gh` is authenticated.
   Document the contract clearly so private-repo support can land later
   without schema changes.
8. **Hidden vs visible sources.** Currently `sys` is hidden from `--list`.
   Is `hidden: true` per source still the right knob, or should listing
   filter by source-type / prefix?
9. **Should `bundled` be a source type at all,** given the goal of moving
   most bundled docs out? Maybe a single `core-bundled` source with no
   user-visible shape, and everything else is `git`/`local`/`url`.

## Implementation Plan

Two phases. Splitting purely so we can validate the schema and migration
before building eject/roundtrip commands on top.

### Phase 1: New schema, source types, doc-type registry, migration

- [ ] Define f05 `DocsCacheSchema` (Zod) with `sources` array, no
  `files` / `lookup_path`. Source types: `bundled` | `local` | `git` | `url`.
- [ ] Define `doc_types` config block with built-in seeds.
- [ ] Implement source resolution: walk `sources` in order, produce a
  `(prefix, type, name) → file path` map.
- [ ] Replace `DocCache.lookupPath`-based logic with source-walking logic.
  Qualified lookup `prefix:name` works.
- [ ] Implement source-type fetchers:
  - `bundled` — read from package `dist/docs/`
  - `local` — direct directory read (no copy)
  - `git` — port `RepoCache` from PR #87, completing the sparse-checkout
    update path; atomic swap on success
  - `url` — single-file fetch with `gh` fallback (port from current code)
- [ ] One-shot migration f03/f04 → f05 in `tbd-format.ts`. No runtime
  compat: deprecated fields are deleted in the migration write.
- [ ] `tbd source add/list/remove` for `git` and `url` source types.
  `bundled` and `local` are managed by setup / config edits respectively.
- [ ] Update `tbd setup` to seed default sources (likely `core-bundled`
  + a default external `tbd-docs` git source — see open question 1).
- [ ] Update `tbd sync --docs` to drive source-type fetchers.
- [ ] Update `tbd doctor` checks to validate source health (clone exists,
  ref reachable, paths populated).
- [ ] Provenance sidecars (or chosen alternative — see open question 3)
  written by the cache pipeline.
- [ ] All existing doc commands (`tbd shortcut`, `tbd guidelines`,
  `tbd template`, `tbd reference`) work via the new resolution path.
  Generic `tbd doc <type> <name>` registered.
- [ ] Tests: schema validation, migration golden tests for f03→f05 and
  f04→f05, source resolution unit tests, RepoCache integration tests
  with a fixture repo, status output golden tests.

### Phase 2: Override / promotion / roundtrip workflows

- [ ] `tbd source eject <prefix:name> [--to <local-prefix>]` — copy
  cached doc into a local source dir, `git add`.
- [ ] `tbd source diff <prefix:name>` — diff local override vs cached
  upstream content.
- [ ] `tbd source upstream <prefix:name>` — for `git`-type sources with a
  GitHub URL, open a PR upstream via `gh`. For other source types: print
  the patch with instructions. Document the contract for non-GitHub git
  sources clearly.
- [ ] `tbd source unfork <prefix:name>` — delete local override after
  upstream merge; next sync re-pulls upstream.
- [ ] `tbd doc status [name]` — show provenance, shadow state, staleness,
  divergence for a single doc or all docs.
- [ ] Tests: end-to-end eject → edit → diff → unfork flow against a
  fixture git source; status output golden tests.

## Testing Strategy

- **Unit:** schema validation, parser/migrator (f03/f04→f05), source
  resolution, prefix collision handling, `parseQualifiedName`.
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
