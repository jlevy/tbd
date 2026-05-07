---
title: Docs Config Redesign
description: Redesign the docs/config system around a unified ordered source list, supporting bundled, local, mirrored, and overridden docs with promotion and roundtrip workflows
---
# Feature: Docs Config Redesign

**Date:** 2026-05-07 (last updated 2026-05-07)

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

## Overview

Redesign how `tbd` represents, fetches, and resolves agent documentation (shortcuts,
guidelines, templates, references, and future doc types).
The current f03 format treats docs as a flat per-file map (`docs_cache.files`) plus a
parallel search-path array (`docs_cache.lookup_path`). PR #87 (the f04 design that was
never merged) introduced a `sources` array, prefix-based namespacing, and a `RepoCache`
for sparse git checkouts — directionally right, but landed half-built and carries three
coexisting compatibility layers (`sources` + `files` + `lookup_path`) that already
produced a dozen “lookup_path zombie” bug fixes during review.

This spec proposes a clean re-cut: **one ordered list of sources, four source types
(`bundled` / `local` / `git` / `url`), no parallel `files`/`lookup_path` machinery, and
doc types as data**. It also designs the local↔mirror promotion and upstream-roundtrip
workflows that goals 4, 5, and 8 require, which neither the current system nor PR #87
actually implements.

This is a **planning spec at the design-options stage**. It outlines three candidate
approaches with pros/cons before nailing down details.
Once an approach is chosen, a follow-up implementation spec will break it into beads.

## Goals

These are the goals as stated by the user, restated explicitly so we can verify nothing
is lost:

### G1. Easy setup with common bundled docs

Installing tbd should make it easy to pull in a curated set of guidelines, shortcuts,
templates, and other doc types out of the box.
Most of these should live in a separate repo (or repos) rather than inside the tbd CLI
codebase, so they can evolve independently of npm releases.
A small core remains internal.

Concrete examples of bundle repos: `jlevy/coding-guidelines`,
`jlevy/writing-guidelines`. Each one is a single bundle but contains a mix of doc types
(guidelines, references, rules, shortcuts, etc.)
— see G17 for why bundles and doc types are orthogonal.

### G2. Easy addition of new local, project-specific docs

It must be easy to add a new doc of any kind that lives in the current repo (typically
under `docs/`) and is versioned with the project.
No copy step, no stub pointer, no separate registration ceremony — just put the file in
the right place and it shows up.

### G3. Easy addition of mirrored docs from external sources

Docs should be pullable from any of: a GitHub repo, an S3 / GCS / generic object-store
path, an arbitrary URL, or a local filesystem path.
The model should be a **flexible reference to a source of files**, not a hardcoded list
of supported source types.

Mirrored docs are **cached locally on disk but not git-tracked by default**. The cache
lives under `.tbd/docs/` (already gitignored) — exactly the same model `tbd sync`
already uses for issues.
This means:

- The cache is fast to read (just files on disk; no network at lookup time).
- The cache is reproducible from config (G9): another clone of the repo
  + `tbd sync --docs` reproduces the same content.
- The repo doesn’t churn on every upstream change — mirrored content doesn’t appear in
  `git status` or `git diff`.

To pull a mirrored doc into git-tracked content (so you can edit and version it
locally), use the promotion / override workflow in G4. G3 covers the “read-only mirror”
path; G4 covers the “fork it locally” path.

### G4. Easy local override of mirrored docs (shadcn-style)

When you need to fix or adapt a mirrored doc, you should not have to push the fix
upstream first. You should be able to copy the doc into a local git-tracked location and
modify it there, with the local version taking precedence — the same mental model as
[shadcn/ui](https://ui.shadcn.com)’s “copy and own” approach.

### G5. Roundtrip: edit local override → review diff → push upstream → resync

Once a local override has been refined, you should be able to push it back upstream
(e.g. open a PR against the source repo), and after it’s merged, the local override is
dropped and the doc is once again served from the mirror — “as if” it had been mirrored
all along.

### G6. Status visibility for all doc workflows

`tbd` should expose the state of every doc and source at any time: where each doc came
from, whether the upstream cache is stale, whether a local override exists, whether the
override diverges from upstream, whether a source is healthy.

### G7. Doc types are extensible, not hardcoded

There are common built-in doc types (shortcuts, guidelines, templates, references), but
the set should be open.
New doc types should be addable by declaring a directory name and a CLI surface —
without forking tbd.
The current code (`DocType = 'guideline' | 'shortcut' | 'template'`) and PR #87
(`DocTypeName` registry, still a closed union) both fail this.

### G8. Mix git-tracked local docs with gitignored cached docs, with promotion between modes

Mirrored remote docs should live in a gitignored cache (it’s clumsy to re-commit
mirrored content on every sync).
Local-authored docs and local overrides should be git-tracked.
There should be a clear command to **promote** a mirrored doc to a tracked override, and
(less commonly) the inverse.

### G9. Reproducible / pinnable mirror state

A mirrored source should be pinnable to a specific git ref (commit, tag, or branch).
Cache content should be reproducible from config — given the same config and a working
network, two checkouts produce the same docs.
This is how the existing tbd-sync model already works for issues.

### G10. Provenance and integrity per doc

Every doc in the cache should carry provenance metadata: which source it came from,
which ref / URL / path within that source, and (for git sources) which commit.
This is what makes G6 (status) and G5 (roundtrip diffs) cleanly implementable.

### G11. Hard cut on config format, with reliable migration from old formats

The PR #87 lineage shows that keeping deprecated fields alive at runtime (`lookup_path`
alongside `sources`) generated 12 separate bug-fix commits as the deprecated field kept
reappearing through different code paths.
The new format (call it f05) should be a **hard cut**: only one schema is valid at
runtime; deprecated fields are not understood, not written, not tolerated.

The compatibility surface lives entirely in **format detection + one-shot migration**,
not in layered runtime support:

- On every config read, detect the format version (`tbd_format: f03|f04|f05`).
- If older than current, run a deterministic migration to f05 in memory; if the user is
  doing a write operation, persist the migrated form.
  Existing `tbd-format.ts` already does this for f02→f03; extend the same pattern.
- Migration must be **reliable**: round-trip tests on representative f03 and f04 configs
  (with various `files:` shapes, URL overrides, custom prefixes) must produce f05
  configs that resolve to the **same set of docs** as the source configs did.
  No silent data loss, no hidden re-additions.
- Migration warnings (e.g., a custom `files:` URL override that becomes a `url`-type
  source) are surfaced to the user rather than buried.
- After migration, the f05 schema validator rejects any field it doesn’t recognize —
  this is what prevents zombies from creeping back in.

The contract: **users don’t touch their config to upgrade**, but the runtime never sees
more than one valid shape at a time.

### G12. Atomic, all-or-nothing sync per source

A failed mirror sync (clone fails, network error, single bad file) should not leave the
cache in a partially updated state.
Sync to a temp location, then swap atomically.
Today’s per-file URL fetches do not have this property.

### G13. Auth is always out-of-band — tbd never handles credentials

tbd does not implement, configure, or store authentication for any source backend.
Public URLs and public git repos must just work; private sources must be made accessible
via the underlying tool’s own auth mechanism, and tbd inherits that environment as-is.

In practice:

- **Git sources**: rely on the user’s existing `git` config — SSH keys for
  `git@github.com:...` URLs, `gh` CLI auth for `https://github.com/...` URLs, credential
  helpers, etc. tbd shells out to git and lets git authenticate.
- **URL sources**: a public HTTP(S) URL works directly.
  For URLs requiring auth, the user uses whatever the underlying tool (curl, gh) already
  has — we do not add bearer-token fields to the schema.
- **Object stores (S3/GCS, future)**: rely on the standard SDK env vars (`AWS_PROFILE`,
  `GOOGLE_APPLICATION_CREDENTIALS`, etc.). tbd’s job is to invoke the right command/SDK;
  the user’s job is to have credentials configured.

Consequence: there is **no `auth:` field in the source schema, ever**. If a private
source fails to fetch, the error message says “configure your credentials for
`<backend>`” and points at the relevant tool’s docs.
This keeps tbd’s surface small, avoids a long tail of credential-handling security bugs,
and means private-source support arrives the moment the underlying tool’s auth works in
the user’s environment — no tbd changes required.

### G14. Bundles as the first-class organizing unit

Every doc belongs to exactly one **bundle**. A bundle represents an ownership / origin
grouping: a GitHub repo, a website domain, an internal team’s doc set, the core that
ships with tbd, or `local` for project-specific docs that don’t live anywhere else.
Bundles are user-visible everywhere docs surface — `tbd doc status`,
`tbd shortcut --list`, the on-disk cache layout under `.tbd/docs/<bundle>/`, the config,
and provenance metadata.

Bundles drive:

- **Listing and filtering** (`tbd doc status --bundle acme`,
  `tbd shortcut --bundle proj`)
- **Override semantics** (a doc in a higher-priority bundle shadows a doc with the same
  name in a lower-priority bundle — this is exactly G4’s mechanism, expressed in bundle
  terms)
- **Provenance display** (G10 metadata is bundle-scoped: which bundle, which ref within
  that bundle, which upstream path)
- **Status output** (G6: organize by bundle, then by doc, then state)

Within a bundle, the upstream source’s layout can be anything — a source config maps
which upstream paths to mirror.
The **landed** layout under `.tbd/docs/<bundle>/` is canonical:
`<bundle>/<doc-type-folder>/<name>.md` (e.g.,
`.tbd/docs/acme/guidelines/python-rules.md`). Doc-type folders (`guidelines/`,
`shortcuts/`, etc.) are the only layout convention that matters; everything above the
doc-type folder is bundle-flat.

Bundles are 1:1 with sources in the schema (one source = one bundle), and the bundle
name is the source’s identifier.
This unifies what PR #87 called “prefix” with the higher-level ownership concept the
user actually reasons about.

### G15. Bundle names auto-suggested at add time, explicit, previewable before commit

Adding a source proposes a bundle name derived from the source URL or path:

- `github:acme/docs` → `acme-docs` (or `acme/docs`, TBD on slashes)
- `https://example.com/foo.md` → `example-com`
- A local source in `docs/agent/` → `local` (the default for local sources unless
  multiple exist)

The user can override with explicit `--bundle <name>`. Before the config change is
persisted, `tbd source add` prints a preview of the pending change — which bundle name,
which docs would land where, what will be added to `.gitignore` — so the user can review
before any sync runs.
This makes adding a mirrored source low-risk and reversible.

### G16. Upstream repos require no special tbd format

External doc sources (git, URL) must work with **vanilla repo structures** — a README
and content files in whatever layout makes sense for that repo.
tbd does not require:

- a `tbd.yml` manifest, `.tbdrc`, or any other tbd-specific control file in the upstream
- mandatory frontmatter fields on every doc
- mandatory directory names matching tbd’s doc types
- any naming convention beyond “files are named what they’re named”

A repo like `jlevy/coding-guidelines` should look like a normal docs repo to anyone
browsing it on GitHub.
tbd’s job at sync time is to treat the upstream as a *bag of files* and let the
**consumer’s tbd config** describe how those files map onto doc types.
Consumers may override the mapping per-bundle without touching upstream.

(An optional, opt-in upstream `tbd.yml` manifest may be supported as a convenience for
publishers who want to ship a recommended default mapping — but consumers can always
ignore it. This is a future direction; the core design assumes no manifest.)

### G17. Bundles and doc types are orthogonal — one bundle can span many types

A single bundle (e.g., `coding-guidelines`) typically contributes docs of **multiple**
types: some guidelines, some references, some shortcuts, some rules.
Installing one bundle enables all of its docs across whatever types they fit into.
The two axes are independent:

- **Bundle** = ownership / origin / where it came from (G14)
- **Doc type** = how the doc is used / which command surfaces it (G7)

Concretely: `jlevy/coding-guidelines` (one bundle) might land as
`.tbd/docs/coding/guidelines/typescript.md`,
`.tbd/docs/coding/references/api-design.md`,
`.tbd/docs/coding/shortcuts/refactor-large-file.md` — same bundle, three doc types,
addressable as `coding:typescript`, `coding:api-design`, `coding:refactor-large-file`.

The mapping from upstream paths to doc types lives in the consumer’s source config and
uses sensible defaults: an upstream subdir whose name matches a known doc-type folder
(`guidelines/`, `shortcuts/`, etc.)
auto-maps to that type.
Anything else needs an explicit mapping rule.
See the schema design below for the syntax.

### G18. Format specs are extractable, reusable artifacts

The format is split across two layered design docs inside tbd:

- **docref**
  ([design-docref-format.md](../../../packages/tbd/docs/design-docref-format.md)) — the
  URI-like single-string grammar for addressing a resource (version `docref/0.1`).
  Small, focused, could live as its own micro-library.
- **docmap**
  ([design-docmap-format.md](../../../packages/tbd/docs/design-docmap-format.md)) —
  manifest, lockfile, doc map, addressing/resolution algorithm, sync semantics, all
  built on top of docref (version `docmap/0.1`).

This separation has two motivations:

- **Modularity.** Either layer can be consumed independently.
  A tool that just needs an addressing grammar imports docref.
  A tool that wants the full sync/index machinery imports docmap.
  If we eventually extract these into standalone libraries or CLIs, the boundaries are
  already drawn.
- **Discipline.** Keeping format-level concerns (grammar, schemas, resolution algorithm,
  sync semantics) out of tbd-specific concerns (overrides, eject, roundtrip,
  doc-type-as-CLI-command) prevents the layered-mechanism creep that produced PR #87’s
  twelve bug-fix commits.

tbd is the first consumer of both layers; its concrete extensions (eject, diff,
upstream, unfork, doc-type-to-CLI dispatch) are layered on top of docmap.
Other consumers — present or future — would only need to implement the docmap primitives
(which in turn use docref).

## Design Principles

These are the values the design serves.
When the open questions (Q1–Q20) are resolved, the answers should be the ones most
consistent with these principles.

### P1. Simple things simple, complex things possible

Adding a typical doc bundle should be a single command that “just works” — no config
edits, no per-doc rules, no upstream coordination.
At the same time, irregular cases (mixed-layout repos, partial extraction, renames,
multi-source bundles, deep customization) should all be expressible through additional
configuration. The default path must be effortless; the escape hatches must be complete.

### P2. Upstream is unconstrained; the consumer owns the mapping

External docs should be usable regardless of how their upstream is formatted.
Providers don’t need a tbd-specific manifest, frontmatter, or folder layout (G16). The
consumer’s docmap config is responsible for mapping arbitrary upstream shapes onto
consumer concepts (bundles, categories, names).
Providers who *do* opt into light cooperation (a `category:` in frontmatter, a `tbd.yml`
manifest, a conventional `guidelines/` directory) make consumer config trivial or
unnecessary — but it’s their choice, not a requirement.

### P3. Explicit beats implicit, but conventions earn defaults

Auto-detection magic is rejected as the primary mechanism (Q20b). The core model is
explicit: globs select files, rules assign categories, provenance is recorded.
Conventions still matter — they let common cases use sensible defaults — but the
conventions are documented and overridable, not load-bearing.

### P4. Lossless inventory, policy-driven views

Every doc that exists in any source should be discoverable through the format (G6, Q15).
Shadowing, overriding, ambiguity, and collisions are properties of the *view*, not of
the inventory. The raw graph never hides anything; tooling builds policy views over it.

### P5. Reproducible from config

Given the manifest, the lockfile, and a working network, two clones of a repo produce
caches with identical content (G9). Sync is idempotent; update is the explicit forward
step. Lockfile carries enough identity (Q17) to make this contract robust under bundle
moves and source reshapes.

### P6. tbd never holds credentials

Authentication is always out of band: git’s credential helpers, `gh` CLI, AWS profiles,
etc. (G13). The format has no auth fields, ever.
Public sources just work; private sources rely on the user’s environment.

### P7. The format is a separable artifact

docref and docmap are tool-agnostic specifications with reference implementations.
tbd is the first consumer; others can adopt the formats without depending on tbd code
(G18). Architectural decisions that benefit a single tool but burden the format (e.g.,
baking tbd-specific overrides into the schema) are rejected in favor of layering —
tbd-specific concerns live above the format.

### P8. Hard cuts on format versions, reliable migration

Schema versions are clean breaks at the boundary; runtime supports exactly one shape;
deprecated fields are detected, migrated, and deleted (G11). Forward compatibility lives
in `.strict()` validation and migration tests, not in layered field-level fallbacks.

### P9. Tests are spec mirrors

Every spec example has a corresponding test; every change to either side requires the
matching change to the other.
Synchrony is mechanical, not aspirational.

## Non-Goals

- Real-time / webhook-driven sync.
  Sync remains explicit (`tbd sync --docs`) with the existing 24h-staleness
  auto-trigger.
- A general git client (no merge resolution, no rebases on the cache).
- Conflict resolution between concurrent local edits and upstream changes beyond “show
  the diff and let the user pick” — see G5.
- Migrating issue storage.
  This spec is purely about docs/config.
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

Doc types are a closed union (`packages/tbd/src/file/doc-add.ts:24`). External docs are
addable per-URL via `--add=<url>`, which appends one row to `files`. There is no notion
of a “source” as a first-class entity, no caching of git repos, no namespacing, and no
override workflow.

### PR #87 attempt (f04, unmerged)

PR #87 introduced:

- `docs_cache.sources: [...]` array of
  `{ type: 'internal'|'repo', prefix, url?, ref?, paths }`
- Prefix-based layout: `.tbd/docs/{prefix}/{type-dir}/{name}.md`
- `tbd source add/list/remove` commands
- `RepoCache` doing `git clone --depth 1 --sparse`
- Doc-types registry in code (`DOC_TYPES: Record<DocTypeName, ...>`), adds `reference`
  as a fourth type
- Qualified lookup `prefix:name`
- f03→f04 migration pulling default `internal:` rows out of `files` into synthetic `sys`
  and `tbd` sources

#### What worked

The `sources` concept and prefix namespacing are the right abstractions.
RepoCache is the right primitive for goal 3.

#### What didn’t

1. **Three coexisting layers in the schema** — `sources` + `files` + `lookup_path`.
   Twelve bug-fix commits in the PR fight “lookup_path zombies” (the deprecated field
   reappearing after sync).
2. **`sources` is config-time only** — `resolveSourcesToDocs()` flattens the list back
   to the same `Record<string, string>` the old code used.
   Sources are never used at runtime lookup.
   This is why `files` had to stay as override.
3. **Repo sync is not wired** — `resolveSourcesToDocs()` has
   `// repo type will be added in Phase 2`. `tbd source add github:foo/bar` writes
   config but `tbd sync --docs` doesn’t fetch it.
4. **Local sources are spec-only** — the spec describes a `type: 'local'` with stub
   pointer files, but the implemented enum is `['internal', 'repo']`. G2 is unmet by the
   code.
5. **Doc types still a closed enum** dressed up as a registry.
   G7 half-met.
6. **No promotion / eject / roundtrip.** G4, G5, G8 explicit non-goals in the PR spec.
7. **Source-type vs doc-type conflation.** `DocsSourceSchema.paths` actually means
   doc-type subdirs (`['shortcuts/']`) — the link is implicit.

The PR’s `done/plan-2026-02-02-external-docs-repos.md` (3010 lines) reflects the right
direction; this spec is a re-cut that finishes it.

### Design tensions to resolve

1. **One mechanism vs. layered mechanisms.** PR #87 keeps three; I think one ordered
   source list is enough.
2. **Stub pointers vs. direct local sources.** PR #87 spec proposed stub files in
   `.tbd/docs/` with `_source` / `_path` frontmatter pointing at tracked files
   elsewhere. I think this is unnecessary indirection — DocCache can read tracked dirs
   directly.
3. **Source types: open registry vs.
   enum.** Are `bundled` / `local` / `git` / `url` the only types we ever want?
   Or should it be pluggable (e.g., S3, GCS, custom)?
4. **Doc types: hardcoded vs.
   config-driven.** `tbd guidelines`, `tbd shortcut` etc.
   are dedicated subcommands.
   Is a new doc type also a new command, or does it fall under a generic
   `tbd doc <type>`?
5. **Override mechanics: shadow-by-priority vs.
   explicit override flag.** Does `proj` source higher in the list automatically shadow
   `acme`, or is there an explicit `overrides: acme:python-rules` field?

## Design

The design is **one ordered list of sources, one bundle per source, four source types,
no parallel `files` or `lookup_path` machinery, and doc types as data**. PR #87’s
direction was right; this is the same idea finished — with the override / promotion /
roundtrip workflows that PR #87 didn’t build, and without the three coexisting
compatibility layers that produced PR #87’s twelve bug-fix commits.

A deferred future direction (fully pluggable source-type providers) is also sketched
below to confirm it’s not the right starting target.

### Schema and source types

The schema, manifest, lockfile, doc map, addressing, and resolution algorithm are
defined in two layered architecture documents:
[design-docref-format.md](../../../packages/tbd/docs/design-docref-format.md) (the
URI-like docref grammar) and
[design-docmap-format.md](../../../packages/tbd/docs/design-docmap-format.md) (the
manifest/lockfile/index/sync system on top).
This plan-spec uses those formats and focuses on tbd-specific workflows layered on top
of docmap. A summary follows for context; the format specs are authoritative.

The manifest lives inline in `.tbd/config.yml` under `docmap:`. One concept (an ordered
list of sources, addressed by docrefs) does what three currently do.

```yaml
tbd_format: f05
docmap:
  schema: docmap/0.1

  doc_types:
    - { name: shortcut,  dir: shortcuts,  command: shortcut }
    - { name: guideline, dir: guidelines, command: guidelines }
    - { name: template,  dir: templates,  command: template }
    - { name: reference, dir: references, command: reference }

  sources:
    # tbd-internal core (ships with the npm package). A small builtin
    # source seeded by `tbd setup`.
    - docref: ./packages/tbd/docs/core/
      bundle: sys
      hidden: true

    # Project-local: a tracked directory in the repo. Read directly,
    # no copy. Doubles as the home for shadcn-style local overrides
    # (G4). G2.
    - docref: ./docs/agent/
      bundle: proj

    # External git source — auto-detects subdirectories matching
    # known doc-type folders (G16, G17). Pinned to a tag for
    # reproducibility (G9).
    - docref: github:jlevy/coding-guidelines@main
      bundle: coding

    # Same shape, but with an explicit `contents` mapping when the
    # upstream layout doesn't match the convention.
    - docref: github:jlevy/writing-guidelines@main
      bundle: writing
      contents:
        - { path: docs/style/, type: guideline }
        - { path: docs/refs/,  type: reference }
        - { path: snippets/,   type: shortcut  }
        - { path: README.md,   type: reference, as: writing-overview }

    # Per-URL one-off (current --add=<url> use case).
    - docref: https://example.com/foo.md
      bundle: misc
      type: guideline
      as: foo

  # No `files:`. No `lookup_path:`. Order in `sources` IS the lookup order.
```

The four scheme prefixes (`./`, `https:`, `github:`, `git:`) replace the earlier
sketch’s `type:` discriminator.
The scheme determines how the source is fetched.
(The earlier `type: builtin` is just a `./` docref pointing at a path inside the npm
package.)

**Lookup semantics.** Sources are searched in declared order.
First match wins for unqualified names; qualified names (`coding:typescript`) target a
specific bundle and skip priority.
Overrides are achieved by putting a `local` source higher in the list — there is no
`overrides:` field (G4).

**Upstream layout flexibility (G16, G17).** Without `contents`, auto-detection walks the
upstream tree and matches subdirectory names against the `doc_types:` registry (e.g.,
upstream `guidelines/` → type `guideline`). With `contents`, explicit `{ path, type, as?
}` rules pick upstream paths/globs and assign types, optionally renaming.
Either way, the **landed** layout under `.tbd/docs/<bundle>/` is canonical:
`<bundle>/<doc-type-folder>/<name>.md`.

**Doc types are config-driven, not hardcoded** (G7). Built-in types (`shortcut`,
`guideline`, `template`, `reference`) are seeded by `tbd setup` into `doc_types:`.
Adding a new type — say `playbook` — is just appending a row:

```yaml
- { name: playbook, dir: playbooks, command: playbook }
```

The CLI dispatches `tbd doc <type> <name>` to a generic handler and aliases the named
types as their own subcommands.
Format spec [§1.2](../../../packages/tbd/docs/design-docmap-format.md#12-doc_types)
defines the schema.

**Local sources are real directories, not stubs.** A `./docs/agent/` docref is a tracked
directory read directly by DocCache.
`.tbd/docs/` only holds *builtin* and *cached* content — it remains gitignored.

**Override is just priority.** No `overrides:` field.
To override `acme:python-rules`, copy the file into
`docs/agent/guidelines/python-rules.md` (the `proj` bundle’s directory).
It now wins because `proj` is listed before `acme`. (G4 met by the same mechanism that
gives us local docs.)

**Promotion command (G8).**

```
tbd source eject acme:python-rules
```

Copies the cached upstream into the first writable `local` source’s appropriate type
directory, and `git add`s it.

**Roundtrip commands (G5).**

```
tbd source diff   acme:python-rules     # diff local vs cached upstream
tbd source upstream acme:python-rules    # open PR upstream via gh (if github source)
tbd source unfork acme:python-rules      # delete local override after upstream merge
```

`tbd sync --docs` after the upstream merge picks up the new content; the local override
(now removed) no longer shadows it.

**Status (G6).**

```
tbd doc status [name]
```

Walks sources in order, shows for each doc:
- which source resolved it
- whether shadowed by a higher source
- whether the upstream cache is stale
- whether a local override diverges from cache (and by how much)

**Provenance (G10).** Each cached doc gets a sidecar (or frontmatter augmentation, TBD)
with `{ bundle, source_ref, source_path, fetched_at, content_hash }`. `bundle` is the
user-visible name; everything else is the bundle-internal addressing.

**Migration (G11).** f03/f04 → f05 is a one-shot transformation:

- f03 `files: { dest: internal:src }` rows are absorbed into a synthetic source whose
  docref is `./packages/tbd/docs/core/` (or moved to an external `github:jlevy/tbd-docs`
  git source — see decisions below).
- f03 `files: { dest: https://... }` rows become per-URL `https:` docref sources (with
  auto-suggested bundle name from the URL host, per G15).
- f03 `lookup_path` is dropped.
- f04 `sources` array is rewritten: the `type:` discriminator is replaced by a `docref:`
  (`type: 'internal'` + bundled path → `./...` docref; `type: 'repo'` + url + ref →
  `github:owner/repo@ref` docref), and `prefix:` is renamed to `bundle:`.
- The deprecated fields are deleted with no runtime fallback.
  If you don’t migrate, the CLI errors with a clear “run `tbd doctor --fix`” message.

### Deferred: pluggable source schemes

Worth naming so it’s not lost: a future direction is making the docref scheme set itself
pluggable. A scheme provider would be a Node module (or external command) implementing
`list(source) → docs[]` and `fetch(doc) → content`. Built-in schemes (`./`, `https:`,
`github:`, `git:`) ship with tbd; users could register others (`s3:`, `gs:`, custom
internal stores) via config.

This is significantly more design surface (caching, refs, content addressing, partial
failure all need to be in the provider contract), plus the security and packaging
footguns that come with plugin loading in a CLI tool.
Most users don’t need it.
The current design keeps the option open — the scheme set is an enum at first; opening
to a registry later is a localized change.
**Defer.** The format spec
[§1.9](../../../packages/tbd/docs/design-docref-format.md#19-extensibility) calls out
the scheme prefix as the extension point.

### Decisions to confirm before implementation

The design above is the proposal.
These specific choices are flagged so they can be confirmed (or pushed back on) before
any code is written:

- The four built-in docref schemes (`./`, `https:`, `github:`, `git:`) are sufficient
  for the first cut. `s3:`/`gs:`/etc.
  wait for the deferred pluggable-scheme direction.
- “Override = priority in source list” rather than an explicit `overrides:` field.
  (Simpler model; UX risk acknowledged — mitigated by `tbd doc status`.)
- Clean break with no `lookup_path` runtime fallback (G11).
- Doc types live in config (`doc_types:`) rather than a code-level registry, with
  built-in types seeded by `setup`.
- The bundled doc set mostly moves out to a separate repo (e.g.
  `github:jlevy/tbd-docs`), kept as a `github:`-scheme source by default rather than a
  local `./` source. (G1.)
- Format identifiers are `docref/0.1` (URI-like grammar) and `docmap/0.1` (manifest/sync
  system on top); both are documented as separable artifacts (G18, see
  design-docref-format.md and design-docmap-format.md).

## Open Questions

These need resolution before the implementation spec.

1. **Where do bundled docs live?** A separate public repo (`github:jlevy/tbd-docs`), one
   per category, or stay inside `packages/tbd/docs/`? Mixed (small core internal + most
   external) seems right but specifics matter.
2. **What’s the exact source type for “current repo’s `docs/` dir”?** Do we call it
   `local` or `repo` (and use `git` for external)?
   Naming matters for clarity.
3. **Provenance: sidecar files or frontmatter augmentation?** Sidecars
   (`foo.md.meta.yml`) keep doc files clean but double the entries.
   Frontmatter pollutes the doc but stays inline.
   Lean toward sidecars.
4. **Atomic sync (G12) at what granularity?** Per source (all of acme or none) seems
   right, but per-doc-type may be acceptable.
5. **Reserved bundle names.** `sys` and `tbd` are reserved.
   What else? `local`? `cache`? Should `local` be the always-on default bundle for any
   local-source addition?
6. **Override directory layout.** When `tbd source eject acme:python-rules` runs, the
   local target is `docs/agent/guidelines/python-rules.md` (the `proj` bundle’s
   directory). What if there are multiple `local` bundles?
   Pick first writable, or require `--to <bundle>`?
7. **Bundle name auto-derivation rules.** What’s the canonical mapping from URL → bundle
   name? Examples: `github:acme/docs` → `acme-docs`? `acme/docs`? `acme.docs`?
   `https://example.com/foo` → `example-com` or `example.com`? Need a deterministic rule
   that’s both readable and safe as a directory name.
8. **Bundle = source 1:1, or many sources per bundle?** Current design is 1:1 (one
   source = one bundle).
   Is there a real use case for multiple sources contributing to one bundle (e.g., two
   URL-type sources both labeled `acme`)? Probably not, but worth confirming.
9. **Roundtrip auth boundary (G13).** Confirm tbd’s failure messaging contract: when a
   fetch or push fails because credentials aren’t configured, the error names the
   underlying tool (`git`, `gh`, `aws`, etc.)
   and points at its own auth docs.
   tbd never prompts for or stores credentials.
10. **Hidden vs visible bundles.** Currently `sys` is hidden from `--list`. Is
    `hidden: true` per source still the right knob, or should listing filter by
    source-type / bundle?
11. **Should `builtin` be a source type at all,** given the goal of moving most built-in
    docs out? Maybe a single small `core` builtin source with no user-visible shape, and
    everything else is `git`/`local`/`url`.
12. **`contents` mapping syntax (G16, G17).** Is `path:` a literal prefix, a glob
    (`docs/**/*.md`), or both?
    Are explicit rules additive on top of `- auto`, or do they replace it?
    How are conflicts handled (same upstream file matched by two rules)?
13. **Optional upstream `tbd.yml` manifest (G16).** Defer entirely, or define a thin
    opt-in shape for publishers who want to ship a recommended mapping?
    If we defer, we should still be careful not to burn a filename that we’d want later.
14. **Renaming via `as`.** Is there a real need to rename docs at import (e.g., upstream
    `python.md` → `python-rules`)? If yes, how do qualified names (`bundle:name`)
    reference it — by upstream name or rename?
    Lean toward: rename wins, qualified name is the renamed one.

### Architectural questions surfaced in design review

These are higher-stakes than Q1–Q14 and should be resolved before substantive Phase 2
implementation. Each lists the options surfaced during the senior-design review
(in-PR-comment) plus tradeoffs; none are tentatively chosen — they need joint review.

#### Q15. Resolver semantics: priority-only vs. DocGraph + DocMap policy view

The shipped resolver now does priority-wins on same `(type, name)` and ambiguous across
types (matches the spec’s stated intent).
The review proposes going further: introduce a separate **DocGraph** layer that retains
every item including shadowed ones, then a **DocMap** *effective view* that resolves a
query against the graph using a configurable policy `{ type?, bundle?, mode?
}` where `mode ∈ 'effective' | 'all' | 'strict'`.

- *Option A. Keep current shape.* `resolveLookupKey(documents, query)` takes a flat
  array assumed to be in source-priority order and returns one entry.
  Simple. Works for `tbd guidelines foo` and `tbd doc status`. Doesn’t expose shadowed
  entries or strict mode.
- *Option B. Add a typed mode parameter to the existing function.*
  `resolveLookupKey(documents, query, { type?, mode?
  })`. `mode: 'all'` returns every match (including shadowed); `mode:
  'strict'` refuses to disambiguate across `(type, name)` even by priority.
  Type filter is the natural lift from typed CLI commands.
  Minimum-viable answer to the review.
- *Option C. Two-layer DocGraph + DocMap.* DocGraph is the lossless inventory; DocMap is
  a built view (with policy applied).
  The resolver lives at the DocMap layer.
  Status / collisions read the DocGraph.
  Cleanest separation; biggest refactor; arguably the right shape if/when docref+docmap
  get extracted.

Open: do typed commands (`tbd guidelines typescript-rules`) pass the type constraint at
the call site, or does the dispatcher inject it?
Either way, the genuine-ambiguity case ("typescript matches a guideline AND a shortcut")
goes away once the type is known.

#### Q16. Bundle ↔ source cardinality

Current design: one source = one bundle, with the bundle name on the source entry.
The review argues this should be split:

- *Option A. Keep 1:1 (current).* Simplest.
  Schema is one array of sources.
  Bundle name auto-suggestion is straightforward.
- *Option B. Split bundles from sources.* Two arrays at the top level: `bundles:` (with
  optional priority, hidden, local_root) and `sources:` (each with a `bundle:` reference
  and a stable `id:`). Multiple sources can populate one bundle.
  CLI sugar (`tbd source add ...`) auto-creates bundles when needed.
  Concrete use cases the reviewer cited:
  - org docs bundle = repo + a few canonical web URLs
  - `tbd` bundle during Phase 3 migration = small package-local core + external
    `tbd-docs` repo
  - product bundle = reference docs, examples, code in different repos
  - multiple single-file URL sources presenting as one bundle
- *Option C. Allow optional grouping.* Default is 1:1; a source can opt into “join an
  existing bundle” via `bundle: <existing-name>`. Less schema disruption than B; loses
  the explicit `bundles:` list for priority/policy.

Question for joint review: are the multi-source-per-bundle use cases real and frequent
enough to justify the schema split now (B), or do we postpone (A or C) and revisit
if/when extraction makes the 1:1 limit painful?

#### Q17. Lockfile identity

Current lock entries key on `docref` + materialization.
The review argues this is fragile when sources move bundles, filters change, the same
`docref` appears twice with different `contents` mappings, or upstream content is
remapped. Recommended additions:

- *Option A. Keep current shape.* docref + revision + content hash is enough for “the
  cache reproduces from the lockfile.”
  Reproducibility holds.
  Identity ambiguity is a corner case.
- *Option B. Add `source_id` only.* Every source gets a stable manifest-level id;
  lockfile entries reference it.
  Solves the “same docref twice” case and bundle-rename case without introducing
  config-fingerprinting.
- *Option C. Full reviewer recommendation.* Lock entries carry `source_id`, `docref`,
  `source_config_hash` (hash of all materialization-affecting fields: `docref`,
  `contents`, `glob`, `ignore`, `depth`), `revision`, `content_hash`, and
  `materialization`. Sync/update/remove/orphan-cleanup operate on source ids rather than
  guessing identity from docref.

Q16 (bundle/source split) and Q17 are linked: Option B/C of Q17 needs source ids, which
Option B of Q16 already introduces.

#### Q18. Override provenance: computed-by-name vs. recorded edge

The current state model computes “tracked override vs pure local” by checking whether
another bundle contributes the same `<type>/<name>`. W8 (eject) tentatively records the
original revision in frontmatter or sidecar but doesn’t formalize an override edge.

The review identifies cases that get muddy without explicit provenance:

- A pure-local doc becomes a supposed override just because an upstream bundle is added
  later with the same name.
- Removing an upstream bundle turns an override into pure-local and loses the data
  needed for `tbd source diff` / `unfork`.
- Upstream renames or deletes a doc; the local file still exists but the relationship is
  no longer discoverable by name.
- `tbd source upstream` (PR creation) needs the exact upstream source/path/revision to
  patch.

Options:

- *Option A. Computed-by-name only (current).* Cheap; no extra state.
  Roundtrip workflows degrade silently when upstream changes name or is removed.
- *Option B. Frontmatter pointer.* Eject inserts a small frontmatter block
  (`_upstream: { source_id, docref, revision, content_hash }`) into the override.
  Self-contained; survives upstream changes.
  Pollutes doc content with tbd metadata.
- *Option C. Sidecar edge.* Eject writes a sidecar (e.g. `.tbd/overrides.yml` or
  `<file>.override.yml`) recording the override edge.
  Doc content stays clean; one more file to track.
- *Option D. tbd-internal overlay.* Eject records the edge in a dedicated file under
  `.tbd/` that’s git-tracked alongside the override (e.g. `.tbd/docmap-overrides.yml`).
  Single source of truth; aggregates well; needs migration logic if the overlay format
  evolves.

Linked to Q16/Q17: Option C/D rely on stable source ids.

#### Q19. The `as` field is overloaded

`as` currently means two unrelated things:

- On a source, `as: <name>` means “treat this source as a single named item rather than
  a bag of files” (whole-repo mode, single- URL mode).
- On a `contents` rule, `as: <name>` means “rename this upstream doc on import” (the
  upstream basename `python.md` lands as `python-rules`).

Options for disambiguation:

- *Option A. Keep `as` as-is and document the two meanings.* Cheapest but invites
  confusion. The reviewer flagged this as confusing.
- *Option B. Split into `mode:` discriminator on sources.*
  ```yaml
  mode: files     # default — index files via contents/glob
  mode: file      # one source = one named doc; requires type, name
  mode: repo      # whole-repo aggregate (KDEX-style as: repo)
  ```
  Cleanest. `as` survives only on `contents` rules as the rename semantics.
- *Option C. KDEX-aligned: `as: repo` literal for aggregates.* Keep `as` on sources but
  restrict to literal values like `'repo'` / `'file'`. `as: <name>` for renames lives
  only on `contents` rules.
  Lighter touch than B; loses the flexibility of a generic `as: <user-name>` on sources
  (currently allowed but rarely used).

#### Q20. Categories vs. types vs. folders, glob-first matching, CLI as aliases

The current design uses a single concept (`doc_types`) that conflates three things: the
CLI surface (`tbd guidelines`), the in-cache folder name (`<bundle>/guidelines/`), and
the auto-detection rule (upstream subdir `guidelines/` becomes type `guideline`). Three
concerns inside one field makes the model magical: you can’t have an upstream layout
that looks different from how it lands, you can’t have docs from a flat upstream treated
as guidelines, and the singular/plural mismatch between `type: guideline` and the
command `tbd guidelines` is a constant papercut.

Recommended direction: **separate category (CLI surface) from folder (filesystem layout)
from selection (which files match)**. Use globs as the only matching primitive in
`contents`, drop auto-detection magic, and keep the existing typed CLI commands as
validated aliases over a single flexible `tbd doc` family.

##### Q20a. Rename `type` → `category`

- *Option A. Keep `type`.* Status quo.
  Singular form forces awkward pluralization at the CLI surface (`type: guideline` ↔
  `tbd guidelines`). “type” is also overloaded across the codebase (TypeScript types,
  source types, doc types).
- *Option B. Rename to `category`.* The natural plural form (`category: guidelines`)
  matches the CLI command name (`tbd guidelines`) and removes the singular/plural
  friction. “category” is uncontested vocabulary in this codebase.
- *Option C. Use `kind` instead.* Shorter, also unloaded.
  Doesn’t solve the pluralization issue (`kind: guideline` ↔ `tbd guidelines` still
  mismatches).

Lean: B (`category`).

##### Q20b. Glob-only matching, no auto-detection

- *Option A. Keep auto-detection (current).* Magic but works for the common case where
  upstream layout matches `doc_types[].dir`. Falls apart for any non-conventional
  upstream.
- *Option B. Glob-only (recommended).* Drop the auto-detect mode.
  Every source that needs type/category assignment uses `contents:` with globs.
  A generic default for tbd’s own bundled core can be a single
  `contents: [{ glob: "**/*", category: ... }]` rule.
  The schema’s `path:` field becomes `glob:` (or stays `path:` accepting standard glob
  syntax — see Q20c).
- *Option C. Glob with conventional fallback.* If no `contents` is given, fall back to
  current auto-detection.
  Best of both, but preserves the magic for users who rely on the convention.

Lean: B. The convention being explicit removes the “what does this source actually pick
up?” mystery. Bundled tbd-internal sources can ship a default `contents:` block as part
of their setup.

##### Q20c. `contents` rule shape

If we go glob-first, the rule shape needs to be settled.

- *Option A. Keep `path:`, document it as glob.* Backward-compatible if we ever ship the
  current shape. Confusing because `path:` reads literal in YAML.
- *Option B. Rename `path:` to `glob:`.* Self-describing.
  ```yaml
  contents:
    - { glob: "guidelines/**/*.md", category: guidelines }
    - { glob: "shortcuts/shortcut-*.md", category: shortcuts }
    - { glob: "README.md", category: references, as: writing-overview }
  ```
- *Option C. Per-rule `glob` plus per-source `glob` filter.* Source-level `glob`
  (currently default `**/*.md`) acts as a pre-filter; `contents` rules then partition
  the surviving set into categories.
  Two layers of globbing is more than necessary; consider folding into one.

Lean: B. Single glob per rule, no source-level pre-filter (or only as sugar for “exclude
these files” via `ignore:`).

##### Q20d. Folder layout vs. category assignment

Folders and categories are two different axes:

- **Folder**: where a doc lives on disk under `.tbd/docs/<bundle>/...`. Naturally
  inherited from the upstream provider’s layout — the provider decides their tree shape;
  tbd mirrors it within the bundle.
- **Category**: how tbd surfaces and addresses the doc — which CLI command lists it,
  which canonical key it gets.
  Assigned by the consumer’s config (or by frontmatter; see Q20f).

Decoupling these means the canonical key (`<bundle>:<category>/<name>`) need not match
the on-disk path (`.tbd/docs/<bundle>/<upstream-subpath>/<name>.md`). The doc map
records both: each entry has a `path` (where the content lives) and a `key` (how it’s
looked up).

Options:

- *Option A. Folder = category, coupled (current spec).* Provider must follow
  `guidelines/`, `shortcuts/`, etc.
  Forces conventions on every upstream.
  Files always land in `<bundle>/<category>/`.
- *Option B. Folder mirrors upstream within bundle, category assigned by config.* The
  cache faithfully preserves the upstream’s tree under
  `.tbd/docs/<bundle>/<upstream-relative>/`. Category is whatever the consumer’s
  `contents` rule (or doc frontmatter; see Q20f) assigns.
  The canonical key is decoupled from the file path.
- *Option C. Folder configurable per category.* Each category can declare a `folder:`
  override. Maximum flexibility; probably YAGNI.

Lean: B. Provider chooses the shape (no mandate to use `guidelines/`); consumer decides
the category. The previous “folder must match category” rule was the source of much of
the auto-detect magic — once we drop auto-detection (Q20b), there’s no reason to force
coupling.

Implication: the doc map entry now consistently records both:

```yaml
- key: writing:guidelines/typescript      # lookup address (bundle:category/name)
  bundle: writing
  category: guidelines
  path: writing/docs/style/typescript.md  # actual on-disk path under .tbd/docs/
  upstream_path: docs/style/typescript.md
```

Lookup by `writing:guidelines/typescript` finds the entry; the consumer reads from
`path`. No magic translation between the two.

##### Q20f. Frontmatter `category:` as auto-assignment

A natural addition: a doc can self-declare its category via YAML frontmatter.
If `category: shortcuts` appears in the doc’s frontmatter, the provider has signaled
intent and the consumer doesn’t need to write a `contents:` rule for it.

```markdown
---
category: shortcuts
title: Code review
---
# Code Review
...
```

This makes provider-cooperative bundles (those that opt into the docmap convention)
zero-config for consumers — no `contents:` needed, just `docref:` + `bundle:`.

Options for resolution priority (highest first):

- *Option A. Consumer `contents:` rule beats frontmatter.* Consumer always wins;
  frontmatter is a fallback when no rule matches.
  Matches the existing three-layer metadata resolution (per-file override → frontmatter
  → source default) used elsewhere in the spec.
- *Option B. Frontmatter beats consumer `contents:`.* Provider’s declared category is
  authoritative. Consumer can still override via per-file `metadata:` map (most specific
  wins).
- *Option C. Strict precedence: per-file `metadata:` > frontmatter > `contents:` rule >
  none.* Three-layer model: provider can express intent (frontmatter), consumer can
  broadly classify (`contents:`), consumer can override per file (`metadata:`). Mirrors
  the title/description/when resolution.

Lean: C. Same precedence model as title/description/when keeps the mental model uniform.
The most specific declaration always wins.

If no rule, no frontmatter, and no per-file override assigns a category, the doc is
**unclassified**: it’s still in the cache but doesn’t appear in any `tbd <command>`
listing. Surfacing this in `tbd doc status` ("3 unclassified docs in bundle ‘acme’ —
assign via contents: rule or frontmatter") is the right UX.

##### Q20e. CLI commands as validated aliases over a generic `tbd doc`

- *Option A. Keep dedicated commands as primary surface (current).* `tbd guidelines`,
  `tbd shortcut`, `tbd template`, `tbd reference` each have their own implementation.
  New types require code (or config-driven dispatch).
- *Option B. Single `tbd doc` family with category aliases.*
  `tbd doc list --category guidelines` is the canonical form; `tbd guidelines` is a
  validated alias auto-generated from the `categories:` config.
  A new category needs only a row added to config; the alias surfaces automatically.
  ```yaml
  categories:
    - name: guidelines
      command: guidelines       # alias surfaces as `tbd guidelines`
    - name: shortcuts
      command: shortcut         # alias surfaces as `tbd shortcut`
    - name: playbooks
      command: playbook         # new category, new alias
  ```
- *Option C. `tbd doc <category> ...` only.* Drop typed aliases.
  Most uniform; breaks user muscle memory.
  Probably too aggressive.

Lean: B. Existing aliases stay (zero user-visible churn); new categories added by config
alone (G7’s “extensible, not hardcoded” becomes real).
Tryscript golden tests for the typed-alias commands remain unchanged.

##### Linkage and rollout

Q20a–e are coupled but not all-or-nothing.
A reasonable adoption path:

1. Phase 1 schema can ship Q20a + Q20b + Q20c together (the rename and the glob-first
   `contents` are mechanical and small).
2. Q20d is already implicit — making it explicit costs nothing.
3. Q20e (CLI alias generation) can happen later in Phase 1 or early Phase 2; the
   existing dedicated commands continue to work in the meantime.

Linked questions: Q20a’s `category` rename interacts with Q19 (the `as` overload — once
`category` is a separate concept, `as` for rename and `mode` for source aggregation are
easier to disentangle).
Q20b’s glob-only choice may also affect Q15 (the resolver’s behavior with renamed
entries via `as:`).

## Doc States and Transitions

Every doc visible to a tbd user is in exactly one of three states.
The states differ by source kind, by where the file lives on disk, and by whether git
tracks it.

| State | Source kind | On-disk location | Git status | Description |
| --- | --- | --- | --- | --- |
| **A. Cached** | external (`github:`, `gitlab:`, `https:`, `git:`) | `.tbd/docs/<bundle>/<type>/<name>.md` (gitignored) | invisible | Mirrored upstream content; pinned by lockfile; read-only from the user’s POV |
| **B. Tracked Override** | local bundle listed *before* an upstream bundle that supplies the same `<type>/<name>` | `<local-bundle-path>/<type>/<name>.md` | tracked | A local copy that shadows the upstream version due to source order |
| **C. Pure Local** | local bundle, no upstream version exists | `<local-bundle-path>/<type>/<name>.md` | tracked | Project-only doc with no upstream relationship |

States B and C are physically identical (same file location, same git tracking); they
differ only in whether an upstream version of the doc also exists.
tbd computes the distinction at read time by checking whether any other bundle in the
source list contributes the same `<type>/<name>`.

### Transitions

```
                    eject (W7)
              A ─────────────────────► B
            (cached)  cp + git add  (override)
              ▲                          │
              │                          │
              │ unfork (W10)             │ remove upstream bundle (rare)
              │ rm + sync                ▼
              └────────────────────── C (orphan)
                                    (pure local)
```

- **A → B (eject, W7).** Copy cached file into the first writable local bundle’s
  directory, `git add`. Source order ensures the override wins.
- **B → A (unfork, W10).** Delete the local override; next sync re-populates the cache,
  which is now the live version.
- **B → C (orphan).** If the upstream bundle is removed (`tbd source remove`) or
  upstream deletes the doc, what was an override becomes a pure-local doc.
  No file movement; just a state re-classification at read time.
- **C → B (adopt).** Uncommon.
  Adding an upstream bundle that supplies the same `<type>/<name>` reclassifies a
  pure-local doc as an override.
  No file movement.
- **C → ∅ (delete).** Just `git rm` the file.

### Why three states (and not two or four)

Two states (cached vs local) misses the upstream-relationship axis, which the roundtrip
workflow (W9) and the diff workflow (W8) depend on.
Four states (cached / cached-with-edits / forked / local) would require tbd to track
per-doc edit state separately from git, which duplicates what git already does.
Three states keeps the model git-aligned: the cache is gitignored, overrides and
pure-local docs are tracked, and the difference between B and C is computed not stored.

## Workflow Catalog

For each user-visible workflow, this section gives a one-line scenario, two or three
design options with tradeoffs, a tentative design, and any open questions.
Workflows are grouped by the phase in which they land.

### Phase 1 workflows: basic capabilities and migration

These preserve existing UX while moving to the new docmap-backed implementation.

#### W1. Migrate from f03/f04 to f05 (one-shot)

**Scenario.** An existing tbd repo with `tbd_format: f03` (or `f04`) upgrades the CLI;
the next config read produces a clear migration path.

**Options.**

- *A. Auto-migrate on read, persist on write.* On loading config, detect old format,
  transform in memory, and write back the migrated form on the next config-mutating
  operation. User sees a one-time warning.
- *B. Doctor-only migration.* Refuse to operate on old configs; surface a clear “run
  `tbd doctor --fix`” message.
  Migration runs only when the user opts in.
- *C. Per-command opt-in.* Each command checks the format and migrates only the parts it
  touches. Simplest implementation but produces inconsistent state during the transition.

**Tentative.** *Option A.* Existing users get the migration without extra ceremony; the
warning makes it visible.
Persisting on write matches how `tbd-format.ts` already handles f02→f03. Reading without
writing is non-destructive (in-memory migration only).
G11’s clean-cut contract is preserved because the migrated form is the only thing the
runtime understands.

**Open.** What’s the warning message and exit channel?
(stderr line on first invocation per process; not repeated within the process.)
Should the migrated f05 config be committed automatically or left for the user to
commit? (Lean toward: tbd writes the file; user commits it explicitly.)

#### W2. Read or list existing docs (preserved UX)

**Scenario.** `tbd guidelines typescript-rules`, `tbd shortcut --list`, etc.
continue to work after migration with no visible change to the user.

**Options.**

- *A. Compatibility shim.* Each existing command wraps a generic docmap-backed
  dispatcher. Outputs match the existing tryscripts.
- *B. Re-implement each command.* Native rewrite per command.
  More code, more chances for output drift.
- *C. Replace named commands with a generic `tbd doc <type> <name>`.* Drops aliases.
  Simplest but breaks user muscle memory.

**Tentative.** *Option A.* Existing typed commands stay (they’re discoverable and short
to type), but they delegate to a single implementation backed by `resolveLookupKey` from
the docmap module. A generic `tbd doc <type> <name>` is also added per G7 for new types.

**Open.** Should `tbd guidelines --list` show source bundle in the listing now (e.g.,
`[tbd] python-rules`, `[proj] my-rule`)? Useful once external sources exist (Phase 2);
preview-only flag in Phase 1.

#### W3. Initial setup with default core bundle

**Scenario.** A fresh `tbd setup --auto` produces a working install with the same set of
guidelines/shortcuts/templates available today.

**Options.**

- *A. Single bundled `tbd` source seeded by setup.* `setup` writes a `local`-style
  docref pointing into the npm package’s bundled docs (via `./packages/tbd/docs/...` or
  an internal-content equivalent).
- *B. External git source from day one.* `setup` writes
  `github:jlevy/tbd-docs@<pinned-tag>` as the default source.
  Requires the external repo to exist and a network at first install.
- *C. Hybrid.* A small core ships in the npm package (a `local`-style source); the bulk
  lives external (`github:` source).
  Two default entries.

**Tentative.** *Option A for Phase 1.* Keep all bundled docs internal in Phase 1 to
avoid coupling Phase 1 to Phase 3’s external repo.
Phase 3 transitions to *Option C*.

**Open.** What’s the docref form for “internal to the npm package”?
A relative `./packages/tbd/docs/` works during dev but breaks once installed via npm.
Options: a special `pkg:tbd-docs/...` scheme (a new docref scheme — has to be added
consistently), or a `./` docref that the consumer (tbd) resolves against the package
install location. Lean toward the latter, with the resolution being tbd-internal logic.

### Phase 2 workflows: external bundles and override roundtrip

#### W4. Add an external bundle

**Scenario.** User runs `tbd source add github:jlevy/coding-guidelines@main` to mirror a
new guideline repo.

**Options.**

- *A. Confirm-then-persist.* Print a preview (auto-suggested bundle name, what doc files
  would land where, gitignore changes) and prompt y/N. Default y. (G15.)
- *B. Persist-and-print.* Write the config update and tell the user what was added; they
  can `tbd source remove` to undo.
- *C. Two-step CLI.* `tbd source preview <docref>` and `tbd source add <docref>`; the
  second performs no preview.

**Tentative.** *Option A.* Matches G15’s “previewable before commit” goal.
The preview is short (5–15 lines for a typical bundle); the prompt is one keystroke.
Use `--yes` to skip in scripts.

**Open.** Does `tbd source add` also kick off a sync, or only update the config?
Lean toward: update config, then run sync (since the user explicitly added the source —
they want the docs available).

#### W5. Sync external sources

**Scenario.** `tbd sync --docs` walks all configured sources, fetches or refreshes the
cache, and rebuilds the doc map.

**Options.**

- *A. Always-walk-all.* Every `--docs` sync re-fetches every source.
  Simple but slow on large or many bundles.
- *B. Lockfile-driven.* If the cache hash matches the lockfile and the source’s manifest
  entry is unchanged, skip.
  (The docmap spec §5.1 sync algorithm.)
- *C. Diff-against-upstream.* Always check upstream HEAD; only re-fetch if it advanced.
  Adds a network round-trip per source even on no-op syncs.

**Tentative.** *Option B.* Idempotent and fast.
`tbd sync --docs --update [<bundle>]` (or `tbd source update`) is the explicit “move
forward” operation that bypasses the lockfile.

**Open.** Naming: `tbd sync --docs --update` vs `tbd source update`. The former
parallels `tbd sync` (which today syncs issues); the latter parallels how npm
distinguishes `install` from `update`. Lean toward `tbd source update [<bundle>]` for
clarity.

#### W6. Show status of all docs and bundles

**Scenario.** `tbd doc status` (and `tbd source list`) tells the user where each doc
came from, whether the cache is stale, and whether overrides exist.

**Options.**

- *A. One unified `tbd doc status` command.* Bundle-grouped output with state markers
  per doc (A / B / C; ✓ / ⚠ / ✗ for sync state).
- *B. Two separate commands.* `tbd source list` for source-level state;
  `tbd doc status [<query>]` for per-doc state.
- *C. Add a `--verbose` toggle to `tbd doctor`.* Folds into existing health-check
  output.

**Tentative.** *Option B.* Different audiences.
`tbd source list` answers “what bundles do I have”; `tbd doc status` answers “what’s the
state of doc X” or “show me everything”.
`tbd doctor` calls into both for its own checks.

**Open.** Output format.
JSON via `--json` is mandatory for both; the human-readable form needs design.

#### W7. Add a project-local doc (no upstream)

**Scenario.** User wants a project-specific shortcut.
They put it at `docs/agent/shortcuts/migrate-to-v2.md`; it shows up in
`tbd shortcut --list` and `tbd shortcut migrate-to-v2`.

**Options.**

- *A. Convention-based — no CLI helper.* User creates the file in the right directory;
  tbd picks it up on next read.
- *B. CLI helper.* `tbd doc new shortcut migrate-to-v2 [--bundle proj]` scaffolds the
  file with a frontmatter template.
- *C. Both.* Convention works always; CLI helper is a convenience.

**Tentative.** *Option C.* Convention-based is the foundational behavior (G2: “no copy
step, no separate registration ceremony”). The CLI helper is sugar for the common case
of starting a new doc from a template.

**Open.** Does the helper auto-register a new doc type if the user gives a type that
doesn’t exist in `doc_types`? (Lean toward: no.
That’s a separate explicit step — see W11.)

#### W8. Eject a mirrored doc into a local override

**Scenario.** User wants to fork an upstream guideline locally — shadcn-style — without
losing track of where it came from.

```
$ tbd source eject coding:guideline/typescript
Ejected coding:guideline/typescript →
  docs/agent/guidelines/typescript.md (proj bundle)
The local copy now overrides upstream. Next `tbd sync --docs` will
not affect it. To compare with upstream: `tbd source diff
coding:guideline/typescript`. To unfork: `tbd source unfork ...`.
```

**Options.**

- *A. Copy + git-add.* tbd copies the cached file into the first writable `local`
  bundle’s directory and runs `git add`.
- *B. Copy only.* User runs `git add` themselves.
  Simpler tbd, more steps for the user.
- *C. In-place tracking flip.* Move the file from `.tbd/docs/<bundle>/...` to a tracked
  dir and rewrite source order.
  More magical, harder to reason about.

**Tentative.** *Option A.* Fewest user steps.
The local file path is deterministic from the bundle’s directory + the doc’s
`<type>/<name>`. A frontmatter comment (or sidecar) records the original cached revision
so `tbd source diff` knows what to diff against.

**Open.** What if there are multiple `local` bundles?
Pick the first writable, or require `--to <bundle>`. Lean toward first-writable default
with `--to` override.
What if a doc with the same path already exists locally?
Refuse with a clear error; require `--force` to overwrite.

#### W9. Diff a local override against upstream

**Scenario.** User edited a local override; later upstream changed.
They want to see what’s different.

**Options.**

- *A. tbd-managed three-way pointer.* tbd records the cached revision at eject time.
  `diff` compares: local override vs cached current vs revision-at-eject (a true 3-way
  diff).
- *B. Two-way diff.* `diff` shows local override vs cached current.
  Loses the “what did you fork from” context; simpler.
- *C. Defer to git.* If the upstream content is committed somewhere,
  `git diff <ref> -- <path>`. But the cache isn’t git-tracked, so this requires extra
  plumbing.

**Tentative.** *Option B for v1; option A as future enhancement.* Two-way is enough to
answer “are upstream and my override different”.
Three-way is nice-to-have for understanding “did upstream change in a way that affects
my fork”.

**Open.** Output format: unified diff (`diff -u`) by default; `--side` for side-by-side;
`--stat` for summary.
Should diff include the frontmatter?
Probably yes; users edit it too.

#### W10. Push a local override upstream (PR)

**Scenario.** User refined a local override; now wants to contribute the change back
upstream so future `sync` re-mirrors it cleanly.

**Options.**

- *A. tbd opens a PR via `gh`.* For `github:` sources only.
  tbd builds a branch + commit in the cached repo, pushes, opens a PR with body
  describing the change.
  User completes review/merge upstream.
- *B. tbd prints a patch and instructions.* User applies and pushes themselves.
  Works for any git-style source.
  No `gh` dependency.
- *C. tbd does branch + commit + push, no PR.* User creates the PR in the GitHub UI.
  Halfway between A and B.

**Tentative.** *Option A for `github:`, option B for everything else.* The CLI surface
is the same (`tbd source upstream <key>`); the implementation branches on source kind.
For `gitlab:` we can add `glab` integration later (Phase 2.5 or later).

**Open.** Branch naming convention.
Default to `tbd/upstream-<bundle>-<type>-<name>-<date>`. Editable via flag.
What if the user has uncommitted local edits in the override file?
Refuse and ask them to commit (or use `--include-uncommitted`).

#### W11. Unfork after upstream merge

**Scenario.** Upstream merged the user’s PR. They want to drop the local override and
let the (now-updated) upstream content serve via sync.

**Options.**

- *A. Delete + sync.* `tbd source unfork <key>` runs `git rm` on the local override,
  runs `tbd source update <bundle>`, prints the result.
- *B. Delete only.* User runs sync separately.
- *C. Lazy delete.* tbd marks the override as “to be removed” but leaves the file until
  the next sync. More state, no real benefit.

**Tentative.** *Option A.* Single command, single observable result.

**Open.** What if the local override has uncommitted edits?
Refuse with a clear message ("uncommitted changes in <path>; commit or discard before
unforking").

#### W12. Add a new doc type

**Scenario.** User wants to add a `playbook` doc type for QA test playbooks.

**Options.**

- *A. Config edit only.* User adds a row to `doc_types:` in `.tbd/config.yml`. tbd
  auto-generates the dispatch.
- *B. CLI helper.* `tbd doctype add playbook --dir playbooks [--command playbook]`
  writes the config row.
- *C. Both.* Convention works always; helper is sugar.

**Tentative.** *Option C.* Same pattern as W7: convention works always, helper is sugar
for the common case.

**Open.** Does `--command` auto-create a top-level `tbd playbook` alias?
In v1, lean toward: only the generic `tbd doc playbook <name>` is exposed.
Top-level aliases for new types are a manual opt-in (later phase).

#### W13. Remove a bundle

**Scenario.** User no longer wants to mirror an external bundle.

**Options.**

- *A. Refuse if overrides exist.* `tbd source remove <bundle>` refuses if any local
  override references it; user must `unfork` first.
- *B. Remove and orphan.* Refuses nothing; ejected docs become pure-local (state C).
  Their `tbd source diff` and `unfork` commands stop working since there’s no upstream
  to diff against.
- *C. Remove with `--force-orphan`.* Default refuses; flag opts into orphaning behavior.

**Tentative.** *Option C.* Default-safe; explicit opt-in for orphaning.
Removing a bundle deletes the cache directory; orphaned overrides are flagged in
`tbd doc status`.

**Open.** Should `remove` also delete the lockfile entry?
Yes — keep lockfile and config in sync.

### Phase 3 workflows: internal-to-external doc migration

This phase moves the bulk of bundled docs (guidelines, shortcuts, templates) from
`packages/tbd/docs/` into one or more external repos (e.g., `github:jlevy/tbd-docs`),
then updates `tbd setup` defaults to pull them from there.
After Phase 3, the npm package ships only a small core (essential `sys` shortcuts that
bootstrap tbd itself).

#### W14. Move bundled docs to an external repo

**Scenario.** Maintainer creates `github:jlevy/tbd-docs` with the current bundled
content; future updates ship there independent of the tbd npm release cycle.

**Options.**

- *A. Big-bang move.* Move everything except the truly tbd-specific shortcuts in one PR.
  Fast; a single point of risk.
- *B. Incremental move.* One doc type at a time (guidelines first, then templates, then
  shortcuts). Slower; lower per-step risk.
- *C. Shadow-then-cut.* Publish to the external repo while still shipping internal
  copies for one release; delete internal copies in the next release.
  Catches issues with the external mirror before users depend on it.

**Tentative.** *Option C.* Lowest risk for users; one extra release cycle.
The external repo can be stood up and validated by users opting in
(`tbd source add github:jlevy/tbd-docs`) before we change the default.

**Open.** Which docs are truly tbd-internal (must stay bundled)?
Candidates: `welcome-user`, `prime`, `sync-failure-recovery`, the `sys/`
shortcut-execution helpers.
Working hypothesis: anything that mentions `tbd <command>` runtime invocations stays
bundled; generic guidelines (TypeScript, Python, etc.)
move out.

#### W15. Update default install to pull from the external repo

**Scenario.** A fresh `tbd setup --auto` adds the external repo as a default source.

**Options.**

- *A. Pinned tag default.* Default source is
  `github:jlevy/tbd-docs@<latest-stable-tag>`. Reproducible; needs CLI release for new
  doc updates.
- *B. Branch default.* Default is `github:jlevy/tbd-docs@main`. Doc updates flow without
  CLI release; reproducibility depends on the lockfile.
- *C. Tag default with auto-staleness.* Pin to a tag, but tbd’s existing 24h-staleness
  sync prompts the user to update.

**Tentative.** *Option A.* Reproducibility wins over freshness; the user can opt into
branch tracking (`tbd source update tbd-docs` moves them forward, or they edit the
docref).

**Open.** Versioning of the external repo.
Likely Semver-ish tags (e.g., `v1.0.0`). What triggers a CLI default-pin bump?
(Lean toward: piggyback on tbd minor releases, with an explicit bump in the changeset.)

#### W16. Migrate existing installs to the new default

**Scenario.** Users on the old version had a single internal `tbd` bundle.
After upgrading the CLI, they should pick up the external default without losing local
customizations.

**Options.**

- *A. Auto-add on first run after upgrade.* If the config has a `tbd` bundle pointing at
  the internal source, append the external source after migration to f05.
- *B. Doctor-suggested.* `tbd doctor` reports “external bundle available; run
  `tbd setup --auto` to enable” but doesn’t auto-add.
- *C. Setup-only.* Only `tbd setup --auto` adds the new default; upgrade alone changes
  nothing.

**Tentative.** *Option C.* Re-running setup is a deliberate operation; users opt in.
`tbd doctor` notes the upgrade availability.

**Open.** What happens to user-configured bundles that overlap with the external repo’s
content? They keep priority by source order; no surprises.

## Implementation Plan

The user-visible surface is staged across three phases.
Each phase is releaseable and useful on its own.

### Phase 1: Basic capabilities and migration

**Goal.** Existing UX preserved; new schema and modules are the backing implementation.
No new user-visible features beyond what exists today.

**Already done — committed in this branch as the canonical reference implementations of
both specs:**

- [x] `docref` module: parser (`parseDocref`, `parseGitBody`), type definitions, 31
  tests covering every spec example.
  ([`packages/tbd/src/docref/`](../../../packages/tbd/src/docref/), tests in
  [`packages/tbd/tests/docref-parser.test.ts`](../../../packages/tbd/tests/docref-parser.test.ts))
- [x] `docmap` module: Zod schemas for manifest / lockfile / doc map, the §4.3
  lookup-key resolution algorithm (`resolveLookupKey`, `parseLookupKey`), 21 tests
  covering schema validation against the spec examples and the resolution algorithm on a
  representative index.
  ([`packages/tbd/src/docmap/`](../../../packages/tbd/src/docmap/), tests in
  [`packages/tbd/tests/docmap-schemas.test.ts`](../../../packages/tbd/tests/docmap-schemas.test.ts)
  and
  [`packages/tbd/tests/docmap-resolve.test.ts`](../../../packages/tbd/tests/docmap-resolve.test.ts))

Both modules are standalone and could be extracted as separate npm packages without
modification. Spec ↔ implementation synchrony is enforced by tests.

**Remaining Phase 1 work:**

- [ ] Wire `docmap:` block in `.tbd/config.yml` to use the docmap manifest schema.
  No `files` / `lookup_path`. Workflow: W1.
- [ ] One-shot migration f03/f04 → f05 in `tbd-format.ts`: rewrite `type:`
  discriminators to `docref:`; rename `prefix:` → `bundle:`; drop `lookup_path` and
  `files`. No runtime compat for deprecated fields.
  Workflow: W1.
- [ ] Filesystem-only fetcher (`./` and `/` docrefs — direct read, no cache).
  Workflow: W3.
- [ ] Source resolution: walk `sources` in declared order, produce a
  `(bundle, type, name) → file path` map.
  Supports auto-detection (subdir-name matching) for now; explicit `contents` mapping
  wired in but lightly tested (heavy testing in Phase 2).
- [ ] Replace `DocCache.lookupPath`-based logic with source-walking logic.
  Qualified lookup `bundle:type/name` works.
- [ ] `doc_types` config block with built-in seeds (shortcut, guideline, template,
  reference). Generic `tbd doc <type> <name>` command dispatcher.
  Existing typed commands delegate.
  Workflows: W2, W12.
- [ ] Lockfile: write/read `.tbd/docs.lock.yml` per format spec §3 (filesystem sources
  don’t appear in it).
  Workflow: W1.
- [ ] Doc map: build `.tbd/docs/map.yml` per format spec §4. Three- layer metadata
  resolution.
- [ ] Update `tbd setup` to seed default sources (single internal bundle for Phase 1;
  external repo defaults arrive in Phase 3). Workflow: W3.
- [ ] All existing doc commands (`tbd shortcut`, `tbd guidelines`, `tbd template`,
  `tbd reference`) work via the new resolution path.
  Workflow: W2.
- [ ] Tests: migration golden tests for f03→f05 and f04→f05; source resolution unit
  tests; doc map golden tests; existing tryscripts pass unchanged.

### Phase 2: External bundles and override roundtrip

**Goal.** External docs are first-class; users can mirror, sync, override, and
round-trip changes.

- [ ] URL → docref normalization (GitHub URL → `github:`, GitLab URL → `gitlab:`, etc.)
  — informative per the spec, useful for CLI inputs.
  Workflow: W4.
- [ ] Scheme-specific fetchers:
  - `https:` — single-file fetch with `gh`/HTTP fallback; ETag-aware.
    Workflow: W5.
  - `github:` — sparse `git clone --depth 1 --branch <ref>`, atomic swap on success
    (port `RepoCache` from PR #87, completing the update path).
    Workflow: W5.
  - `git:` and `gitlab:` — same machinery as `github:`, with the SSH/HTTPS remote parsed
    from the docref. Workflow: W5.
- [ ] Explicit `contents` mapping fully wired and tested: `{ path, type, as?
  }` rules; auto-detection fallback; tests for G16/G17 examples (including `jlevy/coding-guidelines`, `jlevy/writing-guidelines`).
- [ ] `tbd source add/list/remove/show` with bundle-name auto-suggestion and
  confirmation preview.
  Workflows: W4, W6, W13.
- [ ] `tbd sync --docs` and `tbd source update [<bundle>]` for scheme-specific fetching,
  lockfile update, doc map rebuild.
  Workflow: W5.
- [ ] `tbd doc status [<query>]` — bundle-grouped output, per-doc state (A/B/C),
  staleness, divergence.
  Workflow: W6.
- [ ] `tbd source eject <key> [--to <local-bundle>]` — copy cached doc into a local
  bundle, `git add`. Workflow: W8.
- [ ] `tbd source diff <key>` — two-way diff (local override vs cached current); flag
  for unified/side-by-side.
  Workflow: W9.
- [ ] `tbd source upstream <key>` — for `github:` sources, branch
  + commit + push + open PR via `gh`. For other source kinds, print a patch with
    instructions. Workflow: W10.
- [ ] `tbd source unfork <key>` — `git rm` the local override, run
  `source update <bundle>`. Workflow: W11.
- [ ] CLI helper for new local docs: `tbd doc new <type> <name> [--bundle <name>]`
  scaffolds with template frontmatter.
  Workflow: W7.
- [ ] `tbd doctor` checks: source health (clone exists, ref reachable, lockfile matches
  cache hashes, no orphaned bundles).
- [ ] Tests: end-to-end eject → edit → diff → unfork against a fixture git source;
  bundle-add preview golden tests; status output golden tests; lockfile round-trip tests
  (G9).

### Phase 3: Migrate bundled docs to an external repo

**Goal.** The bulk of bundled docs lives in `github:jlevy/tbd-docs` (or equivalent); the
npm package ships a small core.
Users get the same default doc set; tbd-docs evolves on its own release cycle.

- [ ] Stand up `github:jlevy/tbd-docs`. Initial content = current `packages/tbd/docs/`
  (excluding tbd-internal shortcuts).
  Workflow: W14, *Option C* (shadow-then-cut).
- [ ] Tag `v1.0.0` of the external repo.
- [ ] Update `tbd setup --auto` to add `github:jlevy/tbd-docs@v1.0.0` as a default
  source (in addition to the small internal core).
  Workflow: W15.
- [ ] Validation period: one tbd release with both internal and external sources active.
  Watch for breakage; fix issues in the external repo.
- [ ] Cut: remove the migrated docs from `packages/tbd/docs/` (keep only the truly
  tbd-internal set). Bump `tbd-docs` if needed.
- [ ] Migration path for existing installs: re-running `tbd setup --auto` (or
  `tbd doctor` with explicit prompt) adds the external source.
  Workflow: W16.
- [ ] Update `tbd-docs` release notes and link from tbd’s docs.
- [ ] Tests: tryscripts that depend on specific bundled-doc content point at the new
  bundle name explicitly.

## Testing Strategy

- **Unit:** schema validation, parser/migrator (f03/f04→f05), source resolution,
  bundle-name collision handling, `parseQualifiedName`.
- **Integration:** RepoCache against a local bare-repo fixture; full sync cycle with
  mixed source types.
- **Golden / tryscript:** existing doc-command tryscripts updated; new ones for
  `tbd source eject`, `tbd doc status`.
- **Migration:** representative f03 configs (with various `files:` shapes including URL
  overrides) and f04 configs migrate cleanly with no zombie fields and no data loss.
  Round-trip validation: migrated config produces identical resolved doc set as the
  source config did.

## Rollout Plan

f05 is a clean break with one-shot migration.
Releasing as a minor bump (0.x → 0.x+1) is acceptable while pre-1.0; document the
migration in release notes.
`tbd doctor --fix` performs the migration; first run after upgrade prompts the user
before mutating config.

## References

- **Format specs (authoritative for schema/docrefs/algorithms):**
  - [design-docref-format.md](../../../packages/tbd/docs/design-docref-format.md) —
    docref grammar (URI-like addressing)
  - [design-docmap-format.md](../../../packages/tbd/docs/design-docmap-format.md) —
    manifest, lockfile, doc map, resolution algorithm, sync semantics
- PR #87 (unmerged): https://github.com/jlevy/tbd/pull/87
- Original spec: `docs/project/specs/done/plan-2026-02-02-external-docs-repos.md` (3010
  lines; useful for prior-art on RepoCache, prefix design, qualified names)
- Current schema: `packages/tbd/src/lib/schemas.ts`
- Current doc commands: `packages/tbd/src/cli/lib/doc-command-handler.ts`
- Current sync: `packages/tbd/src/file/doc-sync.ts`
- shadcn/ui copy-and-own pattern: https://ui.shadcn.com (mentioned for G4)
