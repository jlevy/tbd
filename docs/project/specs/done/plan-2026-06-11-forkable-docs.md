---
title: Forkable Docs Workflow
description: Minimal shadcn-style fork/unfork/update workflow so built-in and external guidelines, shortcuts, and templates can be copied into the repo, customized, tracked in git, kept current via merges, and offered back upstream
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Forkable Docs Workflow

**Date:** 2026-06-11

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

## Overview

tbd bundles 25+ guidelines, 30+ shortcuts, and several templates, and installs them into
a gitignored cache (`.tbd/docs/`). This works well for knowledge injection, but users
report a visibility problem: **the docs that shape their project are invisible in their
repo**. They can’t browse them on GitHub, can’t customize them, can’t check the ones
they care about into git, and don’t have a clear story for contributing improvements
back.

PR #117 (`plan-2026-05-07-docs-config-redesign.md`) designed a complete framework for
this — ordered source lists, four source types, lockfiles, a DocGraph/DocMap split — and
surfaced five unresolved architectural questions (Q15–Q19). That redesign may still
happen, but it is too much machinery to block on.

This spec proposes the **minimal kernel** of that vision, implementable now as a small
layout revision (format `f05`, a metadata-only migration from f04):

1. **A `tbd docs` command group** scoped to managed docs, following tbd’s existing
   noun-verb convention (`dep add`, `label add`, `attic restore`): `tbd docs fork`
   copies any bundled doc (one, a category, or all of them) into a visible, git-tracked
   folder in the repo (default `docs/tbd/`). Forked docs shadow the bundled copies in
   all lookups, so customizing them Just Works.
   `tbd sync` keeps its scope (project data); `tbd docs sync` takes over cache refresh.
2. **`tbd docs unfork`** — remove a forked copy and fall back to the upstream version,
   refusing to discard customizations unless `--force` is given.
3. **`tbd docs update`** — after a tbd upgrade, pull upstream changes into forked docs:
   unmodified copies refresh in place; customized copies get a git three-way merge that
   applies automatically when clean; conflicting docs are listed until you choose a
   resolution: `--merge` (combine, with standard conflict markers) or `--keep-ours`
   (keep your version and advance the fork point).
4. **A small committed manifest plus stored merge bases** (`.tbd/doc-forks/forks.yml` +
   `.tbd/doc-forks/base/`) recording, for each forked doc, exactly which upstream
   content it forked from — making “customized?”, “stale vs upstream?”, and three-way
   merging cheap, exact, offline operations.
5. **Agent-first setup opt-in** — no interactive prompts (agents are the operators):
   `tbd setup --auto` keeps current behavior and prints a self-documenting summary of
   the two choices — *scope* (all standard guidelines active, recommended, or a subset
   by category) and *visibility* (leave them in the hidden cache, the “magic” path, or
   fork into `docs/tbd/` for explicit, customizable, git-tracked copies) — while
   `welcome-user`/the skill teach agents to offer the choice conversationally and run
   fork themselves.
6. **An upstream-contribution playbook** — a bundled shortcut that walks an agent
   through diffing customized docs against upstream and filing a GitHub issue on
   `jlevy/tbd` with the proposed improvements.
   Pure documentation, no new code.

This is the shadcn “copy and own” model: bundled docs are the registry, fork is the copy
step, git is the fork, and a GitHub issue is the upstream PR — plus the update path
(merging upstream changes into your fork) that plain copy-and-own registries famously
lack. Everything here is forward-compatible with the larger #117 design (see
[Relationship to PR #117](#relationship-to-pr-117)).

## Goals

- **G1. Visibility:** A user can get any or all bundled docs as plain files in their
  repo, browsable on GitHub and checked into git.
- **G2. Forkability:** A forked doc can be edited freely; tbd serves the edited version
  everywhere the upstream one was served (CLI lookup, agent shortcuts).
- **G3. Safe reversal:** Unforking an unmodified doc is trivial; unforking a customized
  doc is an error unless forced, so customizations are never silently lost.
- **G4. Provenance:** For every forked doc, tbd can answer: where did it come from, has
  it been customized, and has upstream changed since fork.
- **G5. Setup choice, without interactivity:** Setup surfaces how visible docs can be —
  via self-documenting output and agent-led conversation, never prompts; the default
  remains exactly the current behavior (hidden cache).
- **G6. Category-based selection:** Docs are organized by their frontmatter `category`,
  so an agent forks the general guidelines plus the categories for the repo’s languages
  and frameworks — from a clear list, with no auto-detection and no hard-coded pack map.
- **G7. Upstream loop:** A documented, low-ceremony path from “I improved a guideline”
  to “an issue with the diff is filed on jlevy/tbd.”
- **G8. Agent-operable:** Every step is a plain CLI command with `--json` output, and
  the tbd skill routes natural requests ("I want to customize the Python guidelines") to
  the right commands.
- **G9. Safe updates:** Upgrading tbd flows upstream improvements into forked docs
  without losing customizations: trivial and cleanly mergeable updates apply by default,
  conflicts are surfaced explicitly and merged only on opt-in, and nothing is ever
  silently overwritten.
- **G10. Open location conventions:** Source addresses and the doc index follow small,
  documented, tool-agnostic conventions (the docref grammar; the docmap inventory
  format), shipped as bundled reference docs — so docs in locations beyond
  built-in/forked have a stable addressing story from day one, shared with any future
  source framework.

## Non-Goals

- **No data-model rework.** The f05 bump is a layout-version stamp plus new committed
  artifacts; issue storage, sync, and the docs-cache format are untouched.
  The larger source-framework redesign (PR #117) remains future work.
- **No multi-file external sources yet.** The docref *grammar* is adopted now for all
  source addresses, single-file `tbd docs add <docref>` generalizes today’s `--add`, and
  `docs_cache.local_dirs` serves other in-repo directories — but whole-repo/bundle
  sources, lockfiles, and external-source sync (“operations over docmaps”) stay in the
  f06+ framework.
- **No automated upstream PRs.** The upstream loop is a playbook the agent follows with
  user confirmation (filing an issue), not an automated `tbd upstream` command.
- **No interactive merge-resolution tooling.** Updates use git’s file-level three-way
  merge (`git merge-file`) and standard conflict markers; resolving a conflicted doc is
  ordinary editing (by the user or their agent), not a custom UI.
- **No changes to issue sync, beads, or the sync worktree.**

## Background

### Current behavior (f04)

- Bundled docs live in
  `packages/tbd/docs/{guidelines,shortcuts/{system,standard},templates}` and ship inside
  the npm package (`dist/docs/`).
- `tbd setup --auto` / `tbd sync --docs` install them into `.tbd/docs/` via
  `syncDocsWithDefaults()` (`src/file/doc-sync.ts:534`): the `docs_cache.files` map in
  `.tbd/config.yml` maps destination paths to sources (`internal:` prefix or URL),
  defaults are merged with user entries (user wins, `mergeDocCacheConfig()`,
  `doc-sync.ts:373`), and files are overwritten on content mismatch.
- **The entire `.tbd/docs/` directory is gitignored** (`.tbd/.gitignore` entry written
  by `setup.ts:1642`), which is the root of the visibility complaint.
- Name resolution goes through `DocCache` (`src/file/doc-cache.ts`): an ordered list of
  directories is scanned and **the first file with a given name wins; later ones are
  marked shadowed** (`doc-cache.ts:228`, `isShadowed()` at `:371`). Shortcuts honor
  `docs_cache.lookup_path` from config; guidelines and templates currently hardcode
  their default paths (`guidelines.ts:69`, `template.ts:19`).
- URL-added docs (`tbd shortcut --add=<url>`) are written under `.tbd/docs/` too (e.g.
  `shortcuts/custom/`) and recorded in `docs_cache.files` — also gitignored, also
  invisible.
- There is no fork/override command, no provenance tracking, and no content hashing; doc
  kinds are a closed union `'guideline' | 'shortcut' | 'template'`
  (`src/file/doc-add.ts:24`).

### What users asked for

- “I’d just like to *see* all the guidelines that are relevant” — in the repo, not
  behind a CLI.
- Pull bundled docs into the repo, fork them, keep the ones they want as visible,
  git-tracked files.
- A way to push good local improvements back upstream without ceremony.

### Why not finish PR #117 instead

PR #117 is a design-options spec with 18 goals, 16 workflows, and 20 open questions,
including unresolved architecture (DocGraph vs DocMap, bundle/source cardinality,
lockfile identity). It models fork as one workflow (W8) inside a much larger source
framework.
The kernel below delivers W7–W11’s user value with ~3 small modules and only a
stamp-style format migration, and produces real usage data that will inform the bigger
design if we still want it.

## Design

### The `tbd docs` command group

All operations on managed docs consolidate under one noun-scoped group, matching tbd’s
existing `dep`/`label`/`attic`/`config`/`workspace` convention.
Commands are split by scope: **`tbd sync` moves project data** (issues/beads —
unchanged), **`tbd docs` manages the doc layer** (cache + forked files).
Verbs-as-flags (`--update`, `--status`, …) are avoided; each operation is a subcommand:

```bash
tbd docs                      # bare = status overview of managed docs
tbd docs list                 # all docs across kinds, with [forked]/[customized] markers
tbd docs show <name>          # read any doc by name, kind-agnostic
tbd docs sync                 # refresh the gitignored cache (absorbs `tbd sync --docs`)
tbd docs add <docref>         # register a single external doc (URL, github:, local path)
tbd docs fork / unfork      # fork into the repo / return to upstream
tbd docs update               # reconcile forks with upstream (--merge / --keep-ours)
tbd docs diff / status        # inspect
```

Notes:

- **`tbd docs sync`** takes over cache refresh; `tbd sync --docs` remains as a
  deprecated alias until the next format cut.
  Subcommand grammar also removes a hazard the flag design had: a doc named `update` can
  never collide with the verb.
- **tbd’s own docs join the system under a `tbd-` name prefix** instead of dedicated
  viewer commands. The bundled files already carry these names (`tbd-docs.md`,
  `tbd-design.md`); they become regular cached docs of a new kind `reference` (dir
  `references/`), so they are listable, readable (`tbd docs show tbd-docs`), and even
  forkable like everything else.
  The `tbd-` prefix is reserved for tbd self-docs (`tbd doctor` warns on user docs
  claiming it).
- **The old bare `tbd docs` manual viewer is repurposed**: bare `tbd docs` now shows the
  status overview (the scope’s landing page); the CLI reference it used to display is
  `tbd docs show tbd-docs`, with `tbd docs manual` as a convenience alias.
  No backward compatibility is kept for the old bare behavior.
  The sibling viewers `tbd readme` and `tbd design` are unchanged for now (candidates
  for the same treatment later).

#### Disposition of today’s `tbd docs` surface

`tbd docs` already carries **four** behaviors today, and the kernel must re-home all of
them explicitly — not just the bare viewer — so no current capability is silently
dropped and the new `tbd docs list` verb does not collide with today’s
`tbd docs --list`:

| Today (f04) | Current behavior | Under f05 |
| --- | --- | --- |
| `tbd docs` (bare) | renders the full `tbd-docs.md` manual | **status overview** of managed docs (the scope’s landing page) |
| `tbd docs <topic>` / `--section <name>` | jumps to a manual section | `tbd docs show tbd-docs --section <name>` (the manual is now a `reference` doc) |
| `tbd docs --list` | lists the manual’s **sections** | retired as a top-level flag; `tbd docs list` now lists **docs across kinds**. Section navigation moves to `tbd docs show tbd-docs` |
| `tbd docs --all` | the “tbd Documentation Resources” orientation card | folded into the bare `tbd docs` overview, whose “menu” block (browse / fork / learn-more pointers) carries the same orientation value |

The one real hazard is the `--list` meaning flip (sections → docs).
The f05 gate makes older CLIs refuse to run against an f05 repo (see “Format bump:
f05”), so there is no window where a user gets the old meaning against a new layout.
The flip is recorded in Backward Compatibility within the `tbd docs` reorganization (CLI
change 1), and **every doc and golden test that exercised the old `tbd docs` / `--list`
/ `--all` / `--section` surface is rewritten in the same release** — the affected tests
are catalogued exactly in [Golden-Test Maps](#golden-test-maps), the largest single one
being `cli-help-all.tryscript.md` (seven `tbd docs` assertions tied to the old surface).

### Three kinds of sync, kept deliberately separate

tbd now has three update surfaces, and they stay distinct.
A universal “sync everything” command was considered and rejected: the three differ in
scope, risk, and failure modes — doc updates can involve merges and tracked-file
mutation; nothing else does:

| Command | Scope | Touches | Network | Modifies tracked files? |
| --- | --- | --- | --- | --- |
| `tbd sync` | project data (issues/beads) | sync worktree + `tbd-sync` branch | yes | never |
| `tbd setup --auto` | installation + integrations | skills, hooks, settings, `AGENTS.md`; invokes a docs-cache sync as a convenience | yes | only generated integration files |
| `tbd docs sync` | doc cache | gitignored `.tbd/docs/` only | yes (grouped by source, failure-isolated) | never |
| `tbd docs update` | your forked docs | fork dir + bases + manifest | no (offline, against the cache) | **yes — the only doc command that does** |

Disambiguation worth stating once: `tbd update <id>` is an issue operation,
`tbd docs update` a doc operation — the noun scope always disambiguates.
Setup may *invoke* a docs-cache sync (as it effectively does today) and *report* pending
doc updates, but the canonical doc commands are `tbd docs sync` / `tbd docs update`, and
only the latter ever writes tracked files.
This table lands in `tbd-docs.md` so the taxonomy is documented for users and agents,
not just in this spec.

### The fork directory

One repo-relative directory holds all forked (and any hand-authored) tbd docs:

```
docs/tbd/                  # default; configurable
├── README.md              # generated index (see below)
├── guidelines/
│   └── python-rules.md
├── shortcuts/
│   └── review-code.md
└── templates/
    └── plan-spec.md
```

- Default: `docs/tbd/`, fixed for the initial f05 release.
  Making the location configurable (persisted to a `docs_cache.fork_dir` key, surfaced
  during setup) is planned within the f05 era as an additive, optional config key; until
  then the constant in `paths.ts` is the single source of truth.
- Layout is `<fork_dir>/<kind-dir>/<name>.md`. The bundled
  `shortcuts/system|standard|custom` subdivision is **flattened** to `shortcuts/` on
  fork — that split is an implementation detail; the manifest preserves the original
  source path for unfork and provenance.
- Files are copied **verbatim** (no frontmatter injection, no stamping).
  Provenance lives in the manifest, so forked files stay clean, diffable, and forkable.
- A small `README.md` index is generated into the fork dir (and regenerated on every
  fork/unfork/update).
  It explains what these docs are (engineering guidelines, shortcuts, and templates
  forked from tbd’s built-in set or external sources), lists each doc with its
  frontmatter description, notes that the folder is managed by `tbd docs fork`, and
  points readers at `npx get-tbd@latest docs` for further info.
  This makes the folder self-explanatory when browsed on GitHub.

### The fork manifest and stored merge bases

All fork state lives under one committed directory, **`.tbd/doc-forks/`**: the manifest
(`forks.yml`) and the base snapshots (`base/`). (The existing `.tbd/.gitignore` only
excludes specific paths, so the directory is tracked automatically, like `config.yml`.)

```yaml
# .tbd/doc-forks/forks.yml — managed by `tbd docs fork` / `unfork` / `update`.
forks:
  - name: python-rules
    kind: guideline
    path: docs/tbd/guidelines/python-rules.md   # repo-relative
    source: internal:guidelines/python-rules.md # provenance docref (any docref form)
    tbd_version: 0.2.3                          # version when base was last set
    base_hash: sha256:9f2c…                     # hash of the stored base content
    conflicted: true                            # only present after `update --merge`
                                                # left conflict markers; auto-clears
  - name: acme-style
    kind: guideline
    path: docs/tbd/guidelines/acme-style.md
    source: github:acme/eng-docs@main//guidelines/style.md
    source_revision: 8f31c2d4…                  # git commit at base time (git sources)
    source_tag: v1.4.0                          # exact/matching tag, when one exists
    base_hash: sha256:77ab…
```

Alongside it, **`.tbd/doc-forks/base/<kind>/<name>.md`** (also committed) stores a
verbatim copy of the upstream content the fork is based on — set at fork time and
advanced by `tbd docs update`. This is the *base* of every three-way merge:

- A hash alone cannot drive a merge; the actual base content is required, and it must be
  committed so any collaborator (or CI) can run `tbd docs update` later with full
  fidelity, regardless of which tbd version originally forked the doc.
- **Git provenance is recorded when the source is git-hosted.** For `github:` /
  `gitlab:` docrefs (the git schemes in docref v0.1; additional protocols may be added
  in future versions), fork and every base advance also record the upstream commit
  (`source_revision`) and, when the pinned ref is a tag or the commit matches one
  exactly, `source_tag`. Non-git sources (`internal:`, bare URLs) have no revision to
  record — which is precisely why bases are *snapshots* rather than pointers: the stored
  copy is the universal provenance fallback that works for every source kind, with
  revisions as extra precision when the source can provide them.
- `base_hash` is the SHA-256 of the LF-normalized base content (line-ending
  normalization avoids false “customized” results from `core.autocrlf` on Windows).
  `tbd doctor` verifies the base file still hashes to it.
- This manifest + base pair is the *recorded override edge* that the PR #117 design
  review called for (its point 4), in miniature — and it records “enough data to add
  three-way merge later without changing the format,” which that review asked for, by
  shipping three-way merge now.
  It makes these exact, offline checks:
  - **customized**: current file hash ≠ `base_hash`
  - **stale**: current upstream/cache content hash ≠ `base_hash` (upstream moved since
    the base was last advanced — independent of whether the user edited)
- Because manifest and bases are committed, collaborators who pull get identical
  resolution, status, and merge behavior.

The cost is a committed second copy of each forked doc.
That duplication is the price of a real update story (see Alternatives #5); shadcn-style
registries that skip it have no upgrade path at all.

### Format bump: f05

The new committed layout artifacts (the `.tbd/doc-forks/` directory and the
`docs_cache.fork_dir` / `docs_cache.local_dirs` keys) constitute a layout revision, so
`tbd_format` bumps to **f05** with a step in the existing migration chain
(`src/lib/tbd-format.ts`, following the f03→f04 precedent):

- The f04→f05 migration is metadata-only: stamp the format id.
  No files move; `.tbd/docs/` is untouched and fork artifacts appear only when fork is
  first used — the upgrade path is exactly as smooth as f03→f04. (The `.tbd/.gitignore`
  template refresh and the generated `.tbd/README.md` layout contract are additive setup
  outputs planned within the f05 era, not part of the migration stamp;
  `FORMAT_HISTORY.f05` in `tbd-format.ts` is the authoritative record of what the stamp
  does.)
- Older CLIs encountering an f05 repo detect the newer format id via the existing
  compatibility machinery and refuse to run, prompting an upgrade — an explicit signal,
  rather than silently serving the upstream copies while upgraded teammates see
  customized ones. **This gate is also what makes the rest of this spec safe**: because
  an upgrade is enforced before any tbd runs against an f05 config dir, the command
  reorganization and semantics changes ship without old/new coexistence hazards.
- Layout documentation updates alongside: format history in `tbd-format.ts`,
  `tbd-design.md` layout sections, and the path conventions in `development.md`.
- Naming note: PR #117’s draft called its future format “f05”; since this kernel claims
  f05, that redesign would land as f06+.

### The `.tbd/` layout contract

With doc forking, `.tbd/` gains one directory — so the contract of every entry is stated
explicitly, both here and in a generated **`.tbd/README.md`** (written by
setup/migration, kept current like the gitignore):

```
.tbd/
├── README.md          # generated: this contract, in-place
├── config.yml         # committed: project configuration (hand-editable)
├── .gitignore         # generated: controls what below is ignored
├── docs/              # GITIGNORED CACHE — unchanged f04 contract: machine-managed
│                      #   mirror of all upstream docs, regenerated by `tbd docs sync`,
│                      #   safe to delete anytime, never hand-edit, never committed
├── doc-forks/         # COMMITTED fork state — owned by `tbd docs fork/unfork/update`:
│   ├── forks.yml      #   manifest (provenance, hashes, revisions)
│   └── base/          #   verbatim base snapshots (the merge bases)
├── workspaces/        # committed: persistent state (outbox etc.) — unchanged
└── state.yml          # gitignored: local state — unchanged
```

The two doc directories answer different questions: `.tbd/docs/` is *what upstream
currently provides* (everything, always, disposable); `.tbd/doc-forks/` is *what this
repo has forked and from where* (a subset, precious, committed).
The user-facing forked files themselves live outside `.tbd/` entirely, in the fork dir
(`docs/tbd/` by default).
`.tbd/docs/` keeps its f04 mechanics verbatim — same path, same regeneration, same
gitignore entry — so the upgrade does not perturb it; `tbd doctor` validates
`doc-forks/` consistency (manifest ↔ base files ↔ fork dir).

### The cache stays complete; sync is grouped by source

`tbd setup --auto` / `tbd docs sync` continue to install **all** docs into `.tbd/docs/`,
including ones that are forked.
The cache copy is the pristine reference: it is what `diff` and staleness compare
against, it is the “theirs” side of every `update` merge, and it is what serving falls
back to after `unfork`. Setup and cache sync never touch files in the fork dir — tracked
files change only via the explicit fork/unfork/update commands.

With docref sources, docs in the cache can have different *source roots*, so sync
operates per source group rather than per file:

- **Grouping.** `docs_cache.files` entries are grouped by source root: all `internal:`
  docs form one group (copied from the installed package); all docs sharing a git repo +
  ref (e.g. `github:acme/eng-docs@main//…`) form one group, fetched with **one** network
  operation per repo (a single checkout/archive at that revision, files extracted from
  it — never N fetches for N docs); each standalone URL is its own group.
- **Failure isolation.** A group that fails — network error, repo or ref gone, URL 404,
  moved content — is reported in the sync summary and its docs keep serving from the
  last-good cache copy; all other groups proceed.
  One bad doc or one vanished source never aborts the rest of the sync.
  Cache entries are pruned only when a doc is explicitly removed from config, never on
  fetch failure.
- **Update stays offline.** `tbd docs update` merges against the cache, so a source
  being unreachable never blocks updating docs from healthy sources — it only means that
  group’s staleness information is as fresh as its last successful sync.
  `tbd docs status` annotates affected docs
  (`source unreachable — serving cached copy from <date>`), and `tbd doctor` reports
  unreachable sources per group.

### Resolution precedence

Effective lookup order per kind, applied structurally (not by asking users to hand-edit
`lookup_path` — the PR #87 “lookup_path zombie” lesson):

```
<fork_dir>/<kind-dir>/        # forked + hand-authored local docs (highest)
<local_dirs entries>           # other in-repo doc dirs (optional config; see below)
<existing lookup paths>        # .tbd/docs/... as today
```

- Implemented by prepending the fork-dir path when building each command’s `DocCache`
  path list. As part of this, guidelines and templates start honoring the same
  config-driven path mechanics that shortcuts already use (small unification of
  `guidelines.ts:69` / `template.ts:19`).
- The existing first-match-wins shadowing in `DocCache` then does all the work: a forked
  `python-rules.md` shadows the cache copy with no new resolution code.
- **Local docs for free:** any `.md` file a user drops into the fork dir is served with
  top precedence even with no manifest entry.
  Status reports it as `local` (no provenance, nothing to unfork).
  This cheaply delivers “easy project-local docs” (PR #117’s G2) without any
  registration ceremony.
- When a reading command serves a forked/local doc, it prints a one-line provenance note
  to stderr, e.g. `(serving forked copy: docs/tbd/guidelines/python-rules.md)`, and
  `--list` output marks such docs `[forked]` / `[forked, customized]` / `[local]`.

### Docs in other locations: docref, `local_dirs`, and the docmap view

The kernel so far assumes two locations: the gitignored cache and the fork dir.
Three measured adoptions from the PR #117 branch generalize *location* without pulling
in the source framework:

**1. Rule: every document reference, everywhere, is a docref.** Any string in tbd that
says “where a doc comes from” or “where a doc lives” — `docs_cache.files` values, the
fork manifest’s `source:` field, `tbd docs add` arguments, `local_dirs` entries,
provenance fields in JSON output, examples in our own docs — uses the docref grammar: a
single-string, URI-like address (`./path/`, `https://…`, `github:org/repo@ref//path`,
plus consumer-defined schemes — tbd’s `internal:` already fits the grammar).
This is a hard convention with no exceptions, so there is exactly one address syntax to
learn, parse, validate, and document.
Adoption is nearly free: the parser is ~100 lines, standalone, already written and fully
tested on the #117 branch (`src/docref/`), and today’s `internal:` prefixes and URLs are
already valid docrefs.
It also rationalizes the ad-hoc GitHub blob-URL conversion in `--add` into principled
normalization (`https://github.com/o/r/blob/main/f.md` → `github:o/r@main//f.md`), and
any future source framework inherits addresses instead of migrating them.

**2. `docs_cache.local_dirs` serves docs from other directories in the repo.** An
ordered list of local-path docrefs (`./`-prefixed) naming additional in-repo doc
directories:

```yaml
docs_cache:
  fork_dir: docs/tbd
  local_dirs:
    - ./docs/general/agent-rules/   # e.g. a team guidelines dir that already exists
```

These slot into the effective lookup order between the fork dir and the cache (see
above). Docs found there are first-class for reading — `list`, `show`, serving, with
provenance notes — and report state `local`; they are not forkable or updatable, since
there is no upstream: they already live in the repo.
`DocCache`’s multi-directory shadowing handles this with zero new resolution code; it is
the supported, documented form of what `lookup_path` half-allowed today.

**3. docmap, reduced to its essence: a doc inventory format.** The #117 draft bundles
several ideas under the “docmap” name — source manifests, lockfiles, sync semantics,
bundles, resolution.
Stripped to its core, the simple, well-defined, reusable concept is just the
*inventory*:

> A **docmap** is a machine-readable inventory of a collection of documents: one entry
> per doc, each with an identity (`type` + `name`, unique within the map), a location
> (`path`, and/or a provenance `source` docref — every entry carries at least one), and
> presentation metadata (`title`, `description`). It describes a doc collection; it says
> nothing about how the collection is assembled, fetched, or kept fresh — a docmap is a
> generated *view* of a collection, never an input to resolution.

For a docmap committed as a file, `path` is relative to the docmap file’s own directory
(the sitemap convention); size metrics (`word_count`, `size_bytes`, token estimates) are
producer extension fields, not core.
A sitemap for docs, with docref as its addressing primitive:

```yaml
docmap: docmap/0.1
name: tbd-docs                                    # optional collection name
documents:
  - name: python-rules
    type: guideline
    path: guidelines/python-rules.md              # location within the collection
    source: internal:guidelines/python-rules.md   # provenance docref
    title: Python Coding Rules
    description: Type hints, docstrings, exception handling, resource management
```

Producers may *generate* a docmap (as tbd does: **every** list/inventory command emits
exactly this — `tbd docs list` / `tbd docs status` and the per-kind
`tbd guidelines/shortcut/template --list`, in both `--json` and, via one shared
renderer, text — with tbd’s state fields as extension fields) or *hand-author* one.
Consumers must ignore unknown fields.
That producer-agnosticism is what makes the concept useful beyond tbd: any repo can
commit a docmap to advertise its doc collection, and a future source framework would
*discover* external docs by reading one — the inventory format becomes the interface
between doc publishers and doc consumers, with the heavy machinery (manifests,
lockfiles, sync — the speculative #117 layer) defined later as *operations over
docmaps*, not as part of the format.
v0.1 deliberately has no bundles, no lockfile fields, no sync semantics.

**The line deliberately not crossed:** pulling a *directory* of docs from another repo
(a true external bundle) requires sync, pinning, and cache identity — operations over
docmaps — and stays in the future framework.
Until then the supported answers are: single files via `tbd docs add <docref>`, in-repo
directories via `local_dirs`, and (if a team must share a guidelines repo today)
vendoring/submoduling it and pointing `local_dirs` at it.

Both formats ship as bundled `reference`-kind docs.
`docref-format` is adapted from the #117 branch essentially as-is (marked adopted,
v0.1). `docmap-format` is **authored fresh and minimal** for v0.1 — just the inventory
definition above — citing the #117 draft only as exploratory background, since that PR
is speculative and may never land in its current form.
As regular docs they are listable and forkable like everything else — the conventions
document themselves through the system they describe, and our other docs can
cross-reference them by name.

### Doc states

| State | Meaning | Detected by |
| --- | --- | --- |
| `upstream` | not forked; served from its upstream via the cache | not in manifest |
| `forked` | forked, unmodified | file hash == `base_hash` |
| `customized` | forked and edited locally | file hash ≠ `base_hash` |
| `stale` | upstream changed since base was set (orthogonal to customized) | cache hash ≠ `base_hash` |
| `conflicted` | `update --merge` left unresolved conflict markers | manifest `conflicted` flag AND markers still present in file |
| `local` | file in fork dir with no manifest entry, or served from a `local_dirs` directory | file present, no entry |
| `missing` | manifest entry but file deleted | entry present, file absent |
| `orphaned` | manifest entry whose upstream no longer provides the doc | source absent from its group’s last successful sync |

`customized` and `stale` can combine (`customized+stale`): the user edited *and*
upstream moved — exactly the case the update merge and the upstream-contribution
playbook care about.
The `conflicted` flag is set only by `update --merge` and clears automatically once the
standard markers (`<<<<<<<`/`=======`/`>>>>>>>`) are gone; scanning for markers only in
flagged docs avoids false positives on docs that legitimately discuss merge conflicts.

**Out-of-band deletion — the user removes a forked file (or the whole fork dir) without
telling tbd.** This is an expected case, not an error: the fork dir is ordinary repo
files, and people delete files.
Because lookups fall through the precedence list, a deleted forked file **transparently
falls back to the upstream cache copy** — the doc keeps working and
`tbd guidelines <name>` still serves it (from upstream now, with no provenance note,
since nothing is forked there anymore).
The dangling manifest entry surfaces as `missing`, and tbd offers exactly two clean
resolutions everywhere it is reported:

- **restore** it — `tbd docs fork <name> --force` re-creates the file from the recorded
  base (your fork point), or
- **finalize** the removal — `tbd docs unfork <name>` clears the manifest entry and base
  snapshot.

`tbd docs status` lists `missing` docs with those two options; `tbd doctor` flags them
and `tbd doctor --fix` **finalizes the unfork** (the deletion is read as intent to stop
forking — it removes the orphaned manifest entry and base, leaving the doc served from
upstream); `tbd docs update` skips `missing` docs.
Deleting the entire fork dir is just this case in bulk: every entry becomes `missing`,
all serving falls back to upstream, and `doctor --fix` clears the manifest.
Nothing is ever silently re-created against the user’s deletion.

### Updating forked docs after a tbd upgrade

The most common lifecycle event: you forked docs, upgraded tbd (or `tbd docs sync`
pulled fresh content), and the upstream versions moved.
`tbd docs update` reconciles forked copies with upstream, outsourcing the merge itself
to git (`git merge-file current base other` — works on plain files, exit code reports
conflict count, standard markers, no repo state touched):

When a doc isn’t cleanly updatable, the user chooses one of two resolution strategies
(mutually exclusive flags): **`--merge`** combines both sides, writing standard conflict
markers to resolve by editing; **`--keep-ours`** keeps the local version untouched and
just advances the fork point to current upstream (“my fork supersedes this upstream
change” / “I already folded it in by hand”).

| Doc state | `update` (default) | `update --merge` | `update --keep-ours` |
| --- | --- | --- | --- |
| `forked` (unmodified) + stale | replace file with new upstream; advance base | same | same |
| `customized` + stale, three-way merge is clean | apply merged result; advance base | same | keep file as-is; advance base only |
| `customized` + stale, merge conflicts | **skip**; warn and list the docs: “re-run with `--merge` (combine, resolve markers) or `--keep-ours` (keep your version)” | write conflict markers into the file; advance base; set `conflicted` | keep file as-is; advance base only |
| `customized`, not stale | no-op | no-op | no-op |
| `conflicted` (unresolved markers) | skip + warn: resolve first | skip + warn | skip + warn |
| `orphaned` | skip + note (upstream removed the doc; keep your copy or `unfork`) | same | same |
| `missing` / `local` | skip (doctor’s problem / nothing upstream) | same | same |
| base file missing (manual deletion) | cannot merge; skip + point at `--keep-ours` | same | re-establish base from current upstream (repair) |
| fork point set by a **newer tbd** (`tbd_version` > running version) | skip + warn: upgrade tbd first (this client’s bundled “upstream” is older than the fork point; updating would silently downgrade the doc) | same | same |

Design points:

- **Version-skew guard.** The manifest’s per-entry `tbd_version` records which tbd
  advanced the fork point; `update` (every strategy) and a re-fork refresh both refuse
  to act when the running tbd is older than that, since their bundled content predates
  the fork point (re-fork accepts `--force` as the explicit downgrade escape hatch).

- **Clean merges apply by default deliberately.** The forked file is git-tracked, so
  every auto-merge is fully visible in `git diff` and trivially revertible — git is the
  undo. Conflicted docs are never touched by default; the listing names the two
  strategies and the user (or agent) re-runs with one.

- **Base advance happens at merge time.** After any update (replace, clean merge, or
  conflicted `--merge`), the base becomes the new upstream content.
  So post-resolution, the doc is simply “a customized fork of current upstream” — states
  stay coherent with no extra bookkeeping.

- **`--keep-ours` keeps your content and advances the fork point.** For a single file
  there is no diff to replay — keeping your version *is* the operation; upstream’s
  change is acknowledged, staleness clears, and future updates diff against the new
  base. It also repairs a missing base file.
  (This was `--rebase` in an earlier draft, renamed because the operation is not
  git-rebase content semantics — it does not replay your diff, it keeps it.)

- **Only the explicit command mutates tracked files.** `tbd setup --auto` and the
  24-hour doc auto-sync refresh the gitignored cache as today and then *report* pending
  updates (`2 forked docs have upstream updates — run 'tbd docs update'`), but never
  write into the fork dir.
  `tbd sync` likewise prints a one-line drift notice (stale / conflicted / missing
  counts) after its cache refresh — awareness only, never action.
  Background paths rewriting committed files would be surprising and hard to audit.

- **Convergence is the unfork path.** If you customized a doc, upstream later adopted
  your change, and `update` merges cleanly such that the file now equals upstream, the
  doc returns to plain `forked` (unmodified) — and `tbd docs unfork` works without
  `--force`.

- `--dry-run` previews all of the above, including which docs would conflict.

### CLI surface

```bash
# Read and browse (works with zero forked docs)
tbd docs                                   # status overview (bare command)
tbd docs list [--kind=guideline]           # all docs across kinds, with state markers
tbd docs show python-rules                 # read any doc by name (kind-agnostic)
tbd docs show tbd-docs                     # tbd's own manual, via the tbd- prefix
tbd docs manual                            # alias for `tbd docs show tbd-docs`
tbd docs sync                              # refresh the gitignored cache

# Add external docs (single files; consolidates the per-kind --add flags)
tbd docs add https://example.com/style.md --kind=guideline --name=acme-style
tbd docs add github:org/repo@main//docs/rules.md --kind=guideline   # any docref form

# Fork
tbd docs fork python-rules                # one doc (name resolution as in `tbd guidelines`)
tbd docs fork python-rules review-code    # several
tbd docs fork --kind=guideline typescript # disambiguate if a name exists in two kinds
tbd docs fork --category=python           # a whole category (reads frontmatter; repeatable)
tbd docs fork --category=general --category=typescript  # general + a language
tbd docs fork --all                       # everything
tbd docs fork --all --dry-run             # preview what would be written

# Inspect
tbd docs status [--json]                   # table of all forked docs + states
tbd docs diff python-rules                 # your file vs current upstream (the net fork)
tbd docs diff python-rules --base          # your file vs its base (what you changed)
tbd docs diff python-rules --upstream      # base vs current upstream (incoming changes)

# Update (after a tbd upgrade; see "Updating forked docs" above)
tbd docs update                            # refresh unmodified + apply clean merges; list conflicts
tbd docs update python-rules               # limit to specific docs
tbd docs update --merge                    # conflicts: combine, write conflict markers to resolve
tbd docs update --keep-ours                   # conflicts: keep your version, advance the fork point
tbd docs update --dry-run                  # preview, including which docs would conflict

# Reverse
tbd docs unfork python-rules              # delete file + base + manifest entry; ERROR if customized
tbd docs unfork python-rules --force      # discard customizations deliberately
tbd docs unfork --all [--force]
```

The existing per-kind readers (`tbd guidelines <name>`, `tbd shortcut <name>`,
`tbd template <name>`) are unchanged — `tbd docs show` is the kind-agnostic superset
that also reaches `reference` docs.

Behavior details:

- **Fork refuses to overwrite.** If the target path exists and is not an unmodified
  forked copy (e.g. a pre-existing user file), fork errors and lists the conflict;
  `--force` overwrites.
  Never silently clobber user content.
- **Re-forking an already-forked doc** is just an update: on an *unmodified* doc it
  refreshes to current upstream content (same as `update`); on a customized doc it
  errors and points at `update` / `diff` (`--force` remains the explicit
  start-over-from-upstream escape hatch, discarding customizations).
- **Unfork of a `missing` doc** cleans up the manifest entry (with a note).
- **Added external docs (`tbd docs add <docref>`) are forkable too** — the manifest
  `source` is the normalized docref and staleness compares against the cache copy, which
  `tbd docs sync` already refreshes.
  No special casing. The per-kind `--add`/`--name` flags remain as aliases for
  `tbd docs add`.
- All subcommands support `--json` and `--dry-run` per the existing CLI conventions.
- `tbd status` gains one summary line (e.g.
  `Docs: 4 forked (1 customized, 2 with upstream updates — run 'tbd docs update', 1 conflict pending)`)
  and `tbd doctor` gains checks: missing files, orphaned entries, base files
  missing/corrupt (hash mismatch), unresolved `conflicted` docs, reserved `tbd-` name
  collisions, unreachable sources (per source group, serving last cached copy), fork dir
  covered by a `.gitignore` (defeats the purpose — warn), manifest/dir drift.

### Doc categories and the fork recommendation

There is **no `--relevant` flag, no repo auto-detection, and no hard-coded pack→doc
map.** Detection rules and a central pack list both drift out of sync with the docs and
substitute brittle logic for an agent’s judgment.
Instead, each doc declares its **category** in frontmatter, so a doc joins a category by
setting one field — nothing central to keep in sync — and the agent picks based on what
the repo actually is.
(This also retires the ad-hoc name-based `inferGuidelineCategory` inference, which today
mis-files docs like `convex-rules` as `general` and has no `convex`/`electron` category
at all; Phase 0 curates the frontmatter so each doc lands in the right category.)

The basic categories:

| Category | What’s in it |
| --- | --- |
| **general** | The foundational guidelines that apply to every repo — the `general-*` rules plus coding, comment, error-handling, TDD/testing, commit, and doc guidelines. |
| **typescript** | TypeScript rules, including CLI tooling (and the sorting / YAML / coverage / monorepo rules). |
| **python** | Python rules, including CLI patterns. |
| **convex** | Convex rules and limits / best-practices. |
| **electron** | Electron app development patterns. |

`tbd docs list` shows every doc grouped by category, so the choices are visible.
The **recommendation** — stated in the bare `tbd docs` overview, the setup summary, the
skill, and `welcome-user`, and kept identical across all of them — is simply: **fork the
general guidelines, plus the categories for whatever languages and frameworks the repo
uses.** An agent that knows the project applies it directly (general + typescript for a
TypeScript CLI; general + python + convex for a Convex/Python backend) with no detection
table to maintain.

Selection reuses the existing `category` metadata — no new construct, no central map:

```bash
tbd docs fork python-rules review-code               # by name
tbd docs fork --category=typescript                  # a whole category (reads frontmatter; repeatable)
tbd docs fork --category=general --category=python   # general + a language
tbd docs fork --all                                  # everything
```

Categories are guidelines-oriented; shortcuts and templates are forked by name or with
`--all`.

### Setup integration (agent-first, non-interactive)

tbd is operated almost exclusively by agents, and agents don’t benefit from prompts — so
there is **no interactive visibility menu**. The `--interactive` flag, which exists
today but has never had prompts (`setup.ts:1281`), is removed rather than built out.
Setup is instead designed to be excellent non-interactively:

- **`tbd setup --auto`: unchanged behavior, self-documenting output.** Cache-only
  remains the default (guidelines are active either way).
  The summary *is* the menu, and it states the two choices explicitly so an agent — or a
  user reading the output — can make them deliberately:

  ```
  Docs: 37 available in cache (.tbd/docs/, gitignored); none forked into the repo.
    Guidelines are active from the cache. To make them visible and customizable, fork
    them into docs/tbd/ (same behavior — just explicit and git-tracked):

    Scope:         all standard guidelines (recommended), or a category:
                   general, typescript, python, convex, electron
    Make visible:  tbd docs fork --category=general --category=<your-languages>
                   tbd docs fork --all          (everything)
    Browse / read: tbd docs list / tbd docs show <name>
  ```

  When forked docs exist with pending upstream updates (typically right after an
  upgrade), the summary reports the count and suggests `tbd docs update` — but setup
  itself never modifies files in the fork dir.

- **Agent-led onboarding makes both choices explicit.** `welcome-user` and the skill
  instruct the agent to put two questions to the user conversationally:
  1. **Scope** — keep *all* standard guidelines active (recommended), or just the
     categories for your stack (general plus your languages/frameworks)?
  2. **Visibility** — leave them in tbd’s hidden cache (they just work — the “magic”
     path), or fork them into `docs/tbd/` so they are visible on GitHub, reviewable, and
     customizable (checked into git)?

  The agent explains that forking changes nothing about how guidelines work — both paths
  make the same guidelines active — it only makes them explicit and editable.
  It then runs `tbd docs fork --category=…` / `--all` (or leaves the cache as-is)
  accordingly, using `--dry-run` to preview first.
  No setup flags needed: `tbd docs` *is* the API.

### Upstream-contribution playbook

New bundled shortcut `shortcuts/standard/suggest-upstream-improvements.md` — pure
documentation, no code.
It instructs the agent to:

1. Run `tbd docs status --json` and collect docs in `customized` (or `customized+stale`)
   state.
2. For each, run `tbd docs diff <name>` and classify hunks: generally applicable
   improvements vs project-specific customizations.
3. Draft an issue body: which doc, why the change is generally useful, the relevant diff
   hunks in fenced blocks, and project context.
4. Show the draft to the user for confirmation, then file with
   `gh issue create -R jlevy/tbd` (the `gh` integration and `use_gh_cli` setting already
   exist).
5. Suggest the follow-up loop: once upstream ships the change and tbd is upgraded, run
   `tbd docs update` — if upstream adopted the customization, the merge converges, the
   doc returns to unmodified `forked` state, and a plain `tbd docs unfork` (no `--force`
   needed) completes the unfork.

The skill routing table gets matching rows, e.g.:

| User says | Agent runs |
| --- | --- |
| “What guidelines are there?” | `tbd docs list` |
| “Make the guidelines visible / put the relevant ones in my repo” | `tbd docs fork --category=general` plus the repo’s languages, after confirming scope + visibility |
| “I want to customize the Python guidelines” | `tbd docs fork python-rules` then edit |
| “Put all of tbd’s docs in my repo” | `tbd docs fork --all` |
| “Stop customizing X / go back to the default” | `tbd docs unfork X` (`--force` only after confirming) |
| “I deleted a forked guideline file” | `tbd docs status` shows it `missing`; `tbd docs fork X --force` to restore or `tbd docs unfork X` to finalize |
| “Update the guidelines to the latest” (or after `tbd setup` reports pending updates) | `tbd docs update`; if conflicts are listed, ask the user, then `--merge` (combine + resolve) or `--keep-ours` (keep ours) |
| “Could we contribute these improvements back?” | `tbd shortcut suggest-upstream-improvements` |

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN (internal modules;
  the `DocCache`/`DocSync` extensions may refactor freely).
- **Library APIs**: N/A (nothing exported).
- **CLI surface**: three deliberate 0.x changes.
  (1) The whole `tbd docs` surface is reorganized (see “Disposition of today’s
  `tbd docs` surface”): bare `tbd docs` becomes the status overview; `tbd docs <topic>`
  / `--section` and the section-listing `--list` move onto `tbd docs show tbd-docs`;
  `--all` folds into the overview; `tbd docs list` now lists docs across kinds.
  DO NOT MAINTAIN any of the old `tbd docs` behaviors — confirmed; the manual stays
  reachable as `tbd docs show tbd-docs` / `tbd docs manual`, and all routing docs and
  goldens are updated in the same release.
  (2) `tbd sync --docs` becomes a deprecated alias of `tbd docs sync` (KEEP DEPRECATED
  until the next format cut).
  (3) The `tbd setup --interactive` flag is removed (DO NOT MAINTAIN — it never had
  prompts; setup is agent-first and non-interactive).
  `tbd readme` / `tbd design` / per-kind readers unchanged.
- **Server APIs**: N/A.
- **File formats**: MIGRATE. `tbd_format` bumps f04 → f05 (new committed layout
  artifacts: `docs_cache.fork_dir`, `.tbd/doc-forks/forks.yml`, `.tbd/doc-forks/base/`)
  via the existing one-shot migration chain — metadata-only, no file moves (see “Format
  bump: f05”). Older CLIs detect the newer format id and prompt to upgrade, per the
  established format-compatibility policy.
- **Database schemas**: N/A.

The default behavior of every existing command is unchanged when nothing has been
forked.

## Alternatives Considered

1. **Stop gitignoring `.tbd/docs/` (commit the cache).** One-line change, full
   visibility — but every tbd upgrade churns dozens of files in user repos, generated
   and authored content become indistinguishable, and there are no fork/unfork
   semantics. Rejected.

2. **Finish the PR #117 f05 framework first.** Right long-term shape, but blocked on
   five open architecture questions and a format migration; delivers user value months
   later. Rejected as the *first* step; this spec is its forward-compatible kernel.

3. **Symlinks from `docs/` into `.tbd/docs/`.** Not portable (Windows), breaks on GitHub
   rendering, and git-tracking symlinked generated content is worse than either mode.
   Rejected.

4. **Frontmatter provenance stamps instead of a manifest.** Self-contained files, but
   fork would modify content on copy (breaking clean diffs against upstream) and
   “customized” detection would need fragile frontmatter-stripping/normalization.
   Rejected in favor of verbatim copies + manifest.

5. **Updates without stored bases (hash-only provenance).** Smaller footprint, but a
   hash cannot drive a three-way merge, so *every* upstream change to a customized doc
   would surface as a wall-of-conflicts two-way diff — clean merges become impossible
   and `update` degrades to “overwrite or do it by hand.”
   Reconstructing bases from old npm versions (network, unpublished versions,
   `development` builds) or from git history (squashes, mixed commits) is unreliable.
   Rejected: committed base copies are the price of a real update story.

6. **Auto-merging during `tbd setup --auto` or background doc auto-sync.** Tempting
   (zero extra commands) but background paths rewriting committed files is surprising
   and unauditable; doc auto-sync can trigger from any read command.
   Rejected: setup/status only *report*; `tbd docs update` is the single explicit
   mutation point.

7. **Verbs as flags on a top-level `tbd eject` command** (`--update`, `--status`,
   `--rebase`, plus a separate `tbd uneject` — the original verb names; see decision
   14). The original draft of this spec.
   Rejected: flags-as-verbs is unintuitive, burns two top-level command slots, and a doc
   named `update` would be ambiguous with the verb.
   The noun-scoped `tbd docs` group matches existing tbd conventions
   (`dep`/`label`/`attic`/`config`) and gives sync/show/list a coherent home.

8. **Copy *all* docs into the fork dir and gitignore the unforked ones** (fork =
   flipping a gitignore entry).
   Full local browsability, but it fails the actual goal: gitignored mirrors are exactly
   as invisible on GitHub and in PRs as the cache is, so only the tracked subset gains
   visibility either way.
   It also creates the worst silent failure mode available — an edit to a gitignored
   mirror is served locally (top precedence) but never reaches the team, with no
   git-visible artifact; fork state becomes a predicate over two systems (git index +
   ignore rules, with the classic ignored-but-tracked confusions); and cache refresh
   would either resurrect deleted mirror files or need tombstones, contradicting
   “nothing is ever silently re-created against the user’s deletion.”
   `tbd docs fork --all` already provides the all-visible posture in tracked form, with
   `unfork` as the undo.
   Rejected.

## Resolved Decisions

Settled during design review (2026-06-11):

1. **One noun-scoped command group, `tbd docs <verb>`**, replaces the earlier top-level
   `tbd eject`/`tbd uneject` + verb-flags design (see Alternatives #7). Scope split:
   `tbd sync` = project data; `tbd docs` = the doc layer.

2. **Verb pair is `fork`/`unfork`** (not shadcn-style `add`, and not the original
   `eject`/`uneject` — see decision 14 for the rename rationale).

3. **`tbd docs sync` absorbs `tbd sync --docs`** (old flag kept as a deprecated alias).

4. **tbd self-docs use a reserved `tbd-` name prefix** as regular docs in the system
   (kind `reference`), rather than a `tbd docs self` subcommand or dedicated viewers;
   bare `tbd docs` becomes the status overview and the manual is
   `tbd docs show tbd-docs` (alias `tbd docs manual`). No backward compatibility for the
   old self-doc viewer behavior.

5. **Update semantics**: clean three-way merges apply by default (tracked files make git
   the undo); non-clean updates require an explicit strategy — `--merge` (combine with
   conflict markers) or `--keep-ours` (keep local content, advance the fork point) — and
   tracked files are mutated only by explicit `tbd docs` verbs, never by setup or
   background sync. The earlier standalone `rebase` subcommand is folded into
   `update --keep-ours`.

6. **Default fork dir is `docs/tbd/`**, surfaced as an editable customization during
   setup and persisted to `docs_cache.fork_dir` when changed.

7. **Generated README index ships in v1**: explains what the docs are, lists them, and
   points to `npx get-tbd@latest docs` for further info.

8. **All fork state lives under one committed directory, `.tbd/doc-forks/`** —
   `forks.yml` (manifest) plus `base/` (snapshots) — consolidated into one
   self-describing directory (rather than scattered top-level files) so `.tbd/docs/`
   remains purely the cache.

9. **Format bump to f05** with a metadata-only f04→f05 migration, following the f04
   precedent: gitignore template refresh, format-history and layout-doc updates; older
   CLIs prompt to upgrade on encountering f05.

10. **docref everywhere, as a hard rule.** Every document reference in tbd — config
    values, the fork manifest, CLI arguments, JSON output, our own docs — is a docref
    string, with no exceptions.
    Parser ported from the #117 branch; the spec ships as a bundled `reference` doc.

11. **docmap is redefined as a minimal inventory format** (docmap/0.1: per-doc identity,
    location, and metadata — no bundles, lockfiles, or sync semantics).
    The reference doc is authored fresh for this spec and does not depend on the
    speculative #117 design, which is cited only as exploratory background.
    `tbd docs list/status --json` emit it; hand-authored docmaps are valid; source
    machinery is deferred as future “operations over docmaps.”

12. **Three sync surfaces, no universal sync.** `tbd sync` = issues; `tbd setup` =
    installation/integrations (may invoke a docs-cache sync and report pending doc
    updates); `tbd docs sync`/`update` = the doc layer.
    A combined “sync everything” command was rejected: doc updates can involve merges
    and tracked-file mutation, unlike the others.
    The taxonomy table is documented in `tbd-docs.md`.

13. **No interactive setup.** The unused `--interactive` flag is removed; setup is
    agent-first and non-interactive, with self-documenting summary output (naming the
    scope and visibility choices) and conversational onboarding via the skill and
    `welcome-user`.

14. **Terminology: fork/unfork, upstream, built-in.** The original `eject`/`uneject`
    vocabulary (create-react-app heritage: a one-way escape from a managed bundle) fit
    when every doc came from inside tbd; with docref sources, docs are multi-origin and
    the fork lifecycle (fork point, merge, advance base, unfork, contribute back) is the
    accurate model. Renames: verbs `fork`/`unfork`; state `forked`; config
    `docs_cache.fork_dir`; the former `bundled` state is now `upstream` (not forked;
    served from its upstream via the cache); “bundled”/“built-in” is reserved for
    tbd-shipped `internal:` docs, where it remains literally true.
    (For reference, shadcn names the model — “open code,” “copy and own” — but its verb
    is just `add`, with no update story.)

15. **The `.tbd/` layout contract is explicit and documented in-place.** A generated
    `.tbd/README.md` (written by setup/migration) documents what each entry is — see
    “The `.tbd/` layout contract” — and the same contract lands in `tbd-docs.md` and
    `tbd-design.md`. Because the f05 gate makes older CLIs refuse to run against newer
    config dirs, this layout reorganization and the CLI-semantics changes are safe to
    ship together with no old/new coexistence hazards.

16. **Phase 0 writes the doc and golden contracts first.** Before any feature code, the
    refinement pins (a) the per-doc change map
    ([Documentation Contract Changes](#documentation-contract-changes)) and (b) the
    exact console output of every new/changed command
    ([Golden-Test Maps](#golden-test-maps)), against one canonical fixture and a shared
    console-output style contract.
    Writing the expected output first is the design tool that keeps the command surface,
    the docmap `--json` shape, and cross-command style consistent — and it turns the
    `tbd docs` surface migration into a reviewed, test-backed change rather than an
    afterthought.

17. **All four of today’s `tbd docs` behaviors are re-homed explicitly** (decision 4
    named only the bare viewer): bare → status overview; `<topic>`/`--section` and the
    section-listing `--list` → `tbd docs show tbd-docs`; `--all` → folded into the
    overview; `tbd docs list`/`status` take the verbs.
    This is part of CLI change 1 in Backward Compatibility, safe because the f05 gate
    blocks old/new coexistence.
    The `--list` meaning flip (sections → docs) is the one behavior change to call out
    in release notes.

Settled during refinement (2026-06-12):

18. **The forked-doc serve note is on by default.** When a read command serves a
    forked/local copy it prints the one-line stderr provenance note without `--verbose`
    (suppressed only by `--quiet`/`--json`). The extra context is deliberate — it helps
    agents recall which docs are customized in a session.

19. **`tbd docs --all` is removed, not aliased.** Its orientation value moves into the
    bare `tbd docs` overview; no compatibility shim, since the f05 gate prevents old/new
    confusion.

20. **The update strategy flag is `--keep-ours`, not `--rebase`.** `--rebase` collided
    with git-rebase’s meaning, while the operation simply keeps the local version and
    advances the fork point.
    It pairs with `--merge` (combine, with conflict markers).

21. **docmap is the single data model for all doc output; no backward-compat
    carve-out.** Every list/inventory command builds one docmap and renders it to text
    or `--json`; the per-kind `--list --json` therefore changes from today’s flat array
    to a docmap (accepted — no backward-compat requirement).
    Single-doc reads emit one docmap document entry plus `content`. Text and JSON derive
    from the same structure, so they cannot drift and any field/state addition is a
    one-place change. This supersedes the earlier OQ3.

22. **Strict output-style consistency is structural.** All doc-command rendering goes
    through one shared rendering layer (no per-command `console.log` formatting); the
    Console output style contract is authoritative, and a cross-command contract/golden
    test pins it. The mandate is “everything is consistent and systematic, easy to
    update.” Pre-existing cross-command drift *outside* the docs surface (e.g. the
    status/doctor INTEGRATIONS divergence documented in
    `cli-orientation-golden.tryscript.md`) is real but out of scope here; it is tracked
    as a separate follow-up bead rather than silently folded into this spec.

23. **docref and docmap ship as standalone, fully-tested, dependency-free modules**
    (`src/docref/`, `src/docmap/`) designed for later extraction into their own package:
    no tbd-internal imports, a public API surface, and their own spec-mirror test suites
    (the docref parser comes over from the #117 branch already in this shape).
    tbd consumes them; they do not consume tbd.

24. **No detection, no hard-coded pack map; categories come from doc frontmatter.** The
    `--relevant` flag, repo auto-detection, and a central pack→doc list are all dropped
    — they drift out of sync with the docs and replace agent judgment with brittle
    rules. Each doc declares its category in frontmatter (`general`, `typescript`,
    `python`, `convex`, `electron`), the name-based `inferGuidelineCategory` inference
    is retired, and the agent forks the general category plus the repo’s
    languages/frameworks.
    `tbd docs fork` accepts names, `--category`, or `--all`.

25. **Onboarding presents two explicit axes: scope and visibility.** Setup and
    `welcome-user` make clear that (a) all standard guidelines are active by default
    (recommended; can be subset by category), and (b) the user can keep them in the
    hidden cache (the “magic” path) or fork them into `docs/tbd/` for explicit,
    customizable, git-tracked copies.
    Both paths make the *same* guidelines active — forking only adds visibility and
    editability — and that equivalence is stated wherever the choice is offered.

26. **Out-of-band deletion of a forked file is a supported state, not an error.**
    Serving falls back to upstream automatically; `tbd docs status` reports `missing`
    with two resolutions (restore via `fork --force`, or finalize via `unfork`);
    `tbd doctor --fix` finalizes the unfork; deleting the whole fork dir is the same
    case in bulk. Covered by a golden test.

## Open Questions

The questions raised during earlier reviews are all now resolved:

- *Should `--relevant` become the fresh-setup default?* — Moot: the `--relevant` flag
  and repo auto-detection are removed entirely (Resolved Decision 24); selection is by
  category, chosen by the agent.
- *Pack definitions in code vs frontmatter tags?* — Resolved: categories come from each
  doc’s frontmatter, with no central pack map (Resolved Decision 24).
- *Should the per-kind list JSON also be docmap?* — Resolved: yes, docmap everywhere
  (Resolved Decision 21).

No open questions remain; new ones will be surfaced here as implementation proceeds.

## Implementation Plan

Phases are ordered so each lands independently shippable.
Each numbered item is intended to be one bead.

**Phase 0 comes first by design.** Before any code, we pin the two contracts the rest of
the work implements against: (1) exactly how each tbd doc changes
([Documentation Contract Changes](#documentation-contract-changes)), and (2) the exact
console output every new and changed command must produce
([Golden-Test Maps](#golden-test-maps)). Writing the expected output first is itself a
design tool — it forces the command surface, the JSON/docmap shape, and the
cross-command style to be consistent before they are built, and it turns each later
phase into “make this golden block real.”
Phase 0 is the refinement this spec asks for; Phases 1–5 then fill it in.

### Phase 0: Documentation contracts and golden-test maps

No production code.
This phase produces the two reviewable contracts and updates the docs
whose wording does not depend on the code (it does not stamp the format id — that lands
with the f05 code in Phase 1 — but it fixes the *text* those code changes must match).
Each item is one bead (labeled `0.1`–`0.5` so it sits before the global `1`–`20`
numbering the later phases use):

- **0.1 — Author the contracts** (this spec): the
  [Documentation Contract Changes](#documentation-contract-changes) and
  [Golden-Test Maps](#golden-test-maps) sections — the per-doc before/after table, the
  console output style contract, and the per-command expected-output blocks.
  This is the design artifact the rest of Phase 0 and all later phases consume; it is
  the deliverable of the current refinement.
- **0.2 — Doc edits independent of the new code** (the contract’s “Phase 0” rows):
  rewrite `tbd-docs.md` (the `tbd docs` group, the three-sync taxonomy table, the
  `.tbd/` layout contract, the managed-docs / fork / update / states sections, the
  `docs_cache` config reference); update `tbd-design.md` (layout + CLI-group + format
  narrative) and this repo’s `development.md` / `docs-overview.md` path and doc-command
  sections. These land now because their wording is fixed by the contract, not by the
  implementation.
- **0.3 — New bundled reference docs** `references/docref-format.md` (adopted from the
  #117 branch, marked adopted v0.1) and `references/docmap-format.md` (authored fresh
  and minimal per the Design section).
  Authoring them now lets the docmap/0.1 schema in the golden `--json` maps be reviewed
  against its own spec before any code emits it.
- **0.4 — New playbook shortcut** `shortcuts/standard/suggest-upstream-improvements.md`
  (follows `new-guideline.md` conventions; references `tbd docs status --json` /
  `tbd docs diff`). Pure documentation, so it lands in Phase 0; the skill/README routing
  rows that point at it land with the agent surface in Phase 5 (kept together to avoid a
  half-wired routing table).
- **0.5 — Lock the golden-test maps against reality.** For every *existing* command the
  maps reference unchanged (`tbd guidelines --list`, `tbd status` with zero forks, the
  `--json` doc shape), capture the current built-CLI output and paste it verbatim into
  the maps, so the “consistency baseline” is real output, not a guess.
  Catalog every existing golden/tryscript test the feature will break (see
  [Existing golden tests that change](#existing-golden-tests-that-change)) and file a
  bead per rewrite, each blocked on the phase that ships the corresponding behavior — so
  no golden is left silently failing.

Phase 0 ships as a docs-only PR. Its only test impact is that the new reference docs and
the new shortcut must resolve — which `doc-references.test.ts` already enforces once its
extractor learns the `reference` kind (the extractor change itself is tracked with the
rest of the test wiring in Phase 5).

### Phase 1: Format bump and fork kernel

1. **f05 format bump**: `CURRENT_FORMAT = 'f05'`, f04→f05 step in `migrateToLatest()`
   (metadata-only: stamp + `.tbd/.gitignore` template refresh + generated
   `.tbd/README.md` layout contract), format-history and layout-doc updates
   (`tbd-design.md`, `development.md`), older-CLI newer-format-detection behavior
   verified with a test.
2. **docref + docmap modules — standalone, fully tested, extraction-ready**
   (`src/docref/`, `src/docmap/`): bring the docref parser, types, and spec-mirror tests
   over from the #117 branch, and add a `src/docmap/` module (the docmap/0.1 type,
   (de)serialize, and validate, authored against `references/docmap-format.md`). Both
   are **dependency-free** (no tbd-internal imports), expose a small public API, and
   carry their own full test suites — structured so they can move to a standalone
   package later without change (Resolved Decision 23); tbd imports them, never the
   reverse. Wire docref normalization into config source strings and the `--add` /
   `docs add` URL handling, and make `DocMap` the type every list/inventory command
   produces (Resolved Decisions 21–22).
3. **Manifest + base module** (`src/file/fork-manifest.ts`): zod schema, read/write of
   `.tbd/doc-forks/forks.yml`, base copies under `.tbd/doc-forks/base/`, LF-normalized
   SHA-256 hashing, state computation
   (`forked`/`customized`/`stale`/`conflicted`/`missing`/`orphaned`/`local`) given
   manifest + fork dir + base dir + cache.
   Pure functions; full unit coverage including the state matrix.
4. **`tbd docs` group scaffolding + `fork` subcommand** (rework
   `src/cli/commands/docs.ts` into the group; old manual-viewer behavior relocates per
   item 18): name resolution via `DocCache` (reusing fuzzy-match + suggestions),
   `--kind`, multiple names, `--all`, `--dry-run`, `--json`, overwrite refusal +
   `--force`, re-fork semantics, README index generation (with the
   `npx get-tbd@latest docs` pointer), `docs_cache.fork_dir` support.
   `tbd docs sync` subcommand delegating to `syncDocsWithDefaults()` (`tbd sync --docs`
   kept as deprecated alias).
5. **`tbd docs unfork` subcommand**: single/multi/`--all`, customized refusal +
   `--force`, base-file and missing-entry cleanup, README regeneration.
6. **Precedence wiring**: prepend fork-dir paths in guidelines/shortcut/template lookups
   (unifying guidelines/templates onto config-driven paths), provenance line on serve,
   `[forked]`/`[customized]`/`[local]` markers in `--list`.
7. **E2E tests** (pattern of `doc-add-e2e.test.ts`): fork → list marker → serve shows
   forked content → edit → unfork refuses → `--force` succeeds → upstream serving
   restored; **delete a forked file out-of-band → serve transparently falls back to
   upstream and `tbd docs status` reports `missing`**; `tbd setup --auto` refresh leaves
   forked files untouched; f04 repo migrates to f05 on setup.

### Phase 2: Status, browse, diff, doctor

8. **`tbd docs status` (+ bare `tbd docs`)** with `--json` per the docmap map schema;
   one-line summary in `tbd status`.
9. **Shared docmap renderer + `tbd docs list` / `show <name>`**: build the single
   rendering layer (Resolved Decision 22) that turns a `DocMap` into either text
   (grouped list, status table, overview, single-entry read) or `--json`, then implement
   cross-kind `list` (with state markers) and kind-agnostic `show` on top of it.
   **Migrate the per-kind readers (`guidelines`/`shortcut`/`template`) onto the same
   renderer**: their `--list --json` switches from the flat array to a docmap (Resolved
   Decision 21) and their text output becomes the one canonical format.
   The reader *commands* stay; only their shared rendering path changes.
10. **`docs_cache.local_dirs` + `tbd docs add <docref>` + grouped sync**: local-dirs
    wiring into the effective lookup order; `add` consolidating the per-kind `--add`
    flags (kept as aliases) with docref normalization replacing the ad-hoc blob-URL
    conversion in `doc-add.ts`; sync refactored to group `files` entries by source root
    (one fetch per git repo+ref; per-group failure isolation; git revision/tag capture
    for manifest provenance; no cache pruning on fetch failure).
11. **`tbd docs diff <name>`** with `--base` / `--upstream` variants
    (`git diff --no-index` style output against base and cache copies, no network).
12. **`tbd doctor` checks**: missing (deleted) / orphaned entries, base missing/corrupt,
    unresolved conflicts, reserved `tbd-` names, gitignored fork dir warning; `--fix`
    finalizes the unfork for `missing` forked files (treating an out-of-band deletion as
    intent to stop forking) and cleans orphaned manifest entries.

### Phase 3: Update and merge

13. **Merge module** (`src/file/fork-update.ts`): `git merge-file` wrapper (labels,
    exit-code handling, dry-run via `-p`), the per-state decision logic from the update
    table, base advancement, `conflicted` flag set/auto-clear.
    Unit tests cover every row × strategy of the table.
14. **`tbd docs update` command surface** with mutually exclusive `--merge` /
    `--keep-ours` strategy flags: name filtering, `--dry-run` preview with conflict
    listing, the skip-warning naming both strategies, summary counts; pending-update
    reporting wired into `tbd setup --auto` output and `tbd status`.

### Phase 4: Setup and categories

15. **Categories from doc frontmatter** (no `doc-packs.ts`, no detection function):
    curate the `category` field on the bundled docs so each lands in exactly one
    category (`general`, `typescript`, `python`, `convex`, `electron`), retire the
    name-based `inferGuidelineCategory` inference in favor of the declared field, and
    add `--category` selection to `tbd docs fork` (reusing the existing
    `--list --category` metadata — no new map).
    Unit tests: category-based fork selection, and that every bundled doc resolves to
    exactly one category.
16. **Setup integration**: self-documenting `--auto` summary naming the two choices —
    *scope* (all standard guidelines, recommended, or a category subset) and
    *visibility* (hidden cache vs fork into `docs/tbd/`) — plus the pending-update
    count; removal of the unused `--interactive` flag; the fork dir documented as a
    config customization (`docs_cache.fork_dir`); the sync-taxonomy table added to
    `tbd-docs.md`.

### Phase 5: Docs and agent surface

17. **Playbook shortcut** `suggest-upstream-improvements.md` (follows `new-guideline.md`
    conventions; references `tbd docs status --json` and `tbd docs diff`).
18. **Self-docs and format-docs migration**: add kind `reference` (dir `references/`),
    register `tbd-docs` and `tbd-design` in the cache under their existing `tbd-` names,
    bundle `docref-format` (adapted nearly as-is from the #117 branch, marked adopted)
    and `docmap-format` (authored fresh and minimal per the design section, #117 cited
    as exploratory background only) as reference docs, retire the bare-`tbd docs` manual
    viewer in favor of `tbd docs show tbd-docs` + the `tbd docs manual` alias
    (`tbd readme`/`tbd design` untouched).
19. **Agent docs**: routing rows (fork / update / upstream + the missing-file row) in
    the skill (`shortcuts/system/skill-baseline.md`) and a fork/update section in
    `tbd-docs.md`; the two-axis (*scope* + *visibility*) `welcome-user` onboarding;
    README section ("Forkable guidelines: fork them into your repo"); `tbd prime`
    mention if warranted.
    (`install/claude-header.md` needs no change — `Bash(tbd:*)` already covers
    `tbd docs`.)
20. **CHANGELOG + release notes** per `release-notes-guidelines`.

## Documentation Contract Changes

This is the per-doc map the user asked for: exactly what changes in each tbd doc, and
when. “Phase 0” rows are wording fixed by this design and land in the docs-only Phase 0
PR; “with code” rows are wording coupled to an implementation phase (e.g. a stamped
format id) and land with that phase, but still follow the contract written here.
Blocks already specified in the Design section (the three-sync taxonomy, the `.tbd/`
layout contract, the doc-states table, the update decision table) are **referenced, not
duplicated** — the contract is that those exact blocks appear in the named docs.

| Doc | Lands | Contract change |
| --- | --- | --- |
| `packages/tbd/docs/tbd-docs.md` (the CLI manual; also the `tbd-docs` reference doc) | Phase 0 | Replace the “Documentation Commands” section with the `tbd docs` group (per “The `tbd docs` command group”); add a “Managing forked docs” section (fork/unfork/update/diff/status + the doc-states and update-decision tables); add the three-sync taxonomy table and the `.tbd/` layout contract verbatim; extend “Configuration Reference” with `docs_cache.fork_dir` and `docs_cache.local_dirs` and the note that `files`/`source`/`local_dirs` values are docrefs; cross-link `docref-format` and `docmap-format`. |
| `packages/tbd/docs/tbd-design.md` | Phase 0 (narrative) + Phase 1 (format id) | §2 File Layer + path conventions: document `.tbd/doc-forks/` (manifest + base snapshots), the external fork dir, and the resolution precedence (fork dir → `local_dirs` → cache, first-match-wins). §4 CLI Layer: add the `tbd docs` group and the three-sync taxonomy. Format narrative: add f05 alongside f04. docref/docmap named as the addressing conventions. |
| `packages/tbd/src/lib/tbd-format.ts` (`FORMAT_HISTORY`) | Phase 1 (with code) | Add the `f05` entry: `introduced` (next minor), description “Adds forkable-docs layout”, `changes` = [`docs_cache.fork_dir`, `docs_cache.local_dirs`, `.tbd/doc-forks/forks.yml` + `base/`, generated `.tbd/README.md`], `migration` = “metadata-only: stamp f05, refresh `.tbd/.gitignore`, write `.tbd/README.md` layout contract”. `CURRENT_FORMAT = 'f05'`. This file is the authoritative format history; its wording is the contract Phase 0 references but does not edit. |
| `docs/development.md` (this repo) | Phase 0 | “Path Conventions” block: add `.tbd/doc-forks/` (committed) and note the fork dir lives **outside** `.tbd/` (default `docs/tbd/`). Add a “Testing forkable docs” pointer to the new e2e/tryscript files. |
| `docs/docs-overview.md` (this repo) | Phase 0 | “tbd CLI Documentation Commands” + “Adding external docs by URL”: replace with the `tbd docs` group; `tbd docs add <docref>`; add a line on forking docs into a visible `docs/tbd/`. |
| `README.md` | Phase 0 | “Shortcuts, Guidelines, and Templates”: add a “Forkable: see them in your repo” paragraph with a `tbd docs fork --category=general` example. “Documentation” block: `tbd docs` is now an overview; the manual is `tbd docs show tbd-docs`. Per-kind `--add` lines annotated as aliases for `tbd docs add`. |
| `packages/tbd/docs/shortcuts/system/skill-baseline.md` (injected agent skill) | Phase 5 | Add the fork/update/upstream rows to “User Request → Agent Action” (the rows in “Upstream-contribution playbook”); add `tbd docs list` / `tbd docs fork` to the “Documentation” command table; one-line “Forkable docs” note. Kept within the skill’s size budget; lands with the rest of the agent surface so routing is never half-wired. |
| `packages/tbd/docs/install/claude-header.md` | none | **No change.** Its `allowed-tools: Bash(tbd:*)` already covers `tbd docs`. Stated here so the audit is explicit. |
| `packages/tbd/docs/shortcuts/standard/welcome-user.md` | Phase 5 | Add the two-axis onboarding offer after the status summary — *scope* (all guidelines vs a category subset) and *visibility* (hidden cache vs forked into `docs/tbd/`) — plus a “make guidelines visible” row routing to `tbd docs fork --category=…`. |
| `packages/tbd/docs/shortcuts/standard/suggest-upstream-improvements.md` (**new**) | Phase 0 | The upstream-contribution playbook (per “Upstream-contribution playbook”). Pure docs. |
| `packages/tbd/docs/references/docref-format.md` (**new**) | Phase 0 | Adopted from the #117 branch, marked adopted v0.1. First doc of the new `reference` kind. |
| `packages/tbd/docs/references/docmap-format.md` (**new**) | Phase 0 | Authored fresh, minimal (docmap/0.1 inventory only) per the Design section; #117 cited as background. |
| Generated `.tbd/README.md` (**new**, by setup/migration) | Phase 1 (with code) | The `.tbd/` layout contract block, written in place; kept current like the gitignore. |
| Generated `<fork_dir>/README.md` (**new**, by fork/unfork/update) | Phase 1 (with code) | The fork-dir index: what these docs are, one line per doc with its description, “managed by `tbd docs fork`”, and the `npx get-tbd@latest docs` pointer. |
| `packages/tbd/CHANGELOG.md` + release notes | Phase 5 | f05 entry per `release-notes-guidelines`. |
| `tbd --help` (the `docs` command `.description()` + subcommand help, in `src/cli/commands/docs.ts`) | Phase 1 (with code) | Description changes from “Display CLI documentation (use tbd sync --docs …)” to a managed-docs summary; subcommand help strings per the [Golden-Test Maps](#golden-test-maps). User-facing text, so it is part of the contract. |

Two consistency points the contract pins down:

- **One data model, one renderer — docmap is it (no backward-compat carve-outs).** Every
  command that lists or inventories docs builds a single in-memory **docmap** and then
  renders it; `--json` serializes that docmap, and text mode runs it through one shared
  renderer. This applies uniformly: `tbd docs list` / `tbd docs status`, the per-kind
  `tbd guidelines/shortcut/template --list` (whose `--json` **changes** from today’s
  flat array to a docmap — accepted, since we have no backward-compat requirement here),
  and the bare `tbd docs` overview (a docmap rendered in summary form).
  Single-doc reads (`tbd docs show`, the per-kind `<name>` readers) emit one docmap
  *document entry* plus a `content` field — the same entry shape, so list and read never
  drift. Because text and JSON derive from the same structure, they cannot disagree, and
  adding a field or a state is a one-place change.
  This is the systematic consistency the design optimizes for; see Resolved Decisions
  21–22.
- **`tbd-docs.md` is both a rendered manual and a forkable `reference` doc.** Its
  bundled source stays at the docs root (`packages/tbd/docs/tbd-docs.md`); the
  cache/kind-dir is `references/` and the lookup name is `tbd-docs`. The doc-sync map
  records that root-to-`references/` mapping (a small `doc-sync.ts` detail, Phase 5 item
  18).

## Golden-Test Maps

These are the expected console outputs the new and changed commands must produce.
They are written here (not as live test files) because they run against the built CLI
and would fail until the feature ships; each block is **lift-ready** — the
implementation phase pastes it into the named harness.
Two harnesses are in use, matching today’s repo: **tryscript** (`*.tryscript.md`,
`NO_COLOR=1`, `[..]` matches intra-line, `...` matches whole lines, custom `[PATTERN]`s
for unstable fields) and **vitest inline snapshots** (`golden-output.test.ts`,
`FORCE_COLOR=0`). All maps below are shown as captured with color disabled (the state
the golden files store), so bold/dim render as plain text.

Unstable fields use placeholders that become tryscript patterns: `[SIZE]` =
`\([0-9.]+ .B, ~[0-9.]+k? tok\)`, `[PATH]`, `[HASH]`, `[VERSION]`. Per
`golden-testing-guidelines`, everything else (names, kinds, states, counts, ordering) is
shown literally — no patterns on values we control.

Status convention: blocks for **shipped** commands are captured from the built CLI and
match the live goldens; blocks for commands that have **not landed yet** are marked
*(Phase N contract)* and must be re-captured against the real CLI when that phase ships
(the Phase 0.5 discipline, applied per phase).

### Console output style contract

This contract is **authoritative and enforced structurally, not by convention**. Doc
commands must not hand-roll `console.log` formatting; all of them route through a single
shared rendering layer (extend `output.ts` / `sections.ts`, or a small `docs-render.ts`
that builds on them) that owns list-entry layout, state markers, the summary line,
tables, and the overview.
One docmap in, one renderer out (see the consistency point above), so there is exactly
one place to change any of these and no command can drift from another.
Every rule below is verified against today’s `output.ts`, `sections.ts`, and
`doc-command-handler.ts`; the maps that follow are just this contract applied:

- **Section headers** are `formatHeading()` — UPPERCASE, bold (`INTEGRATIONS`,
  `HEALTH CHECKS`); bodies indent two spaces.
  The `tbd docs` overview reuses this.
- **Icons** come only from `ICONS` — `✓` success/closed, `✗` error, `⚠` warn, `•`
  notice, `○` open, `◐` in_progress, `●` blocked.
  No new glyphs are invented for doc states.
- **Color roles** (from `createColors`): `id`=cyan for doc names, `dim` for
  metadata/sizes/paths, `bold` for names and headers, `success`/`warn`/`error` for the
  matching icons. Forked doc names render with the `id` role, like issue IDs.
- **Doc-state markers are dim bracket tags** appended to the list entry, exactly like
  the existing `[shadowed]` tag: `[forked]`, `[forked, customized]`, `[local]`. State
  *icons* are never used for doc states — brackets are the established convention.
  (Staleness and `conflicted` are lifecycle facts shown by `tbd docs status` / the
  summary line, not list markers — list markers describe ownership.)
- **Provenance on serve** is one dim line to **stderr** (so piped stdout stays clean),
  reusing the existing stderr-note channel: `(serving forked copy: [PATH])`. It is **on
  by default** (suppressed only by `--quiet`/`--json`), deliberately not gated behind
  `--verbose` — the small amount of extra context helps an agent remember which docs are
  customized in a session.
- **Outcomes**: success → `✓ <msg>` green to stdout; refusal/error → `✗ <msg>` red to
  stderr + non-zero exit; preview → `[DRY-RUN] <msg>` yellow (the `output.dryRun` form).
- **`--json`** goes through `output.data(...)`: docmap object for `list`/`status`,
  per-doc object for `show`; no ANSI; consumers ignore unknown fields.
- **Footer** uses `renderFooter`: `Use 'cmd' for X, 'cmd' for Y.`
- **Width** wraps at 88 columns (`getTerminalWidth`).
- **Command/scope parallels** kept on purpose: `tbd docs` (overview/summary) is to
  `tbd docs status` (the per-doc table) as `tbd status` is to `tbd stats`; the bare
  overview’s “menu” block and the `tbd setup --auto` Docs summary share identical
  wording.

A single canonical fixture is used across every map below (a repo just upgraded, so
upstream has moved):

| name | kind | customized | stale | merge on update |
| --- | --- | --- | --- | --- |
| `python-rules` | guideline | yes | yes | clean |
| `acme-style` | guideline | yes | yes | conflicts |
| `review-code` | shortcut | no | yes | n/a (refresh) |
| `tbd-docs` | reference | no | no | untouched |

### `tbd docs` (bare overview)

Mirrors `tbd status`: a summary plus pointers, never the full table.
Zero-fork case is the default and stays the orientation card the old `tbd docs --all`
provided:

```text
$ tbd docs                       # no docs forked yet
tbd docs — managed documentation

  [..] docs available in the cache (.tbd/docs/, gitignored); none forked into the repo.
  Guidelines are active from the cache. Three postures, all serving the same docs:

  Hidden (default):  keep the cache as-is — zero repo footprint
  Curated:           tbd docs fork <name> [...]  fork chosen docs into docs/tbd/
                     tbd docs fork --category=<name>  (general, typescript, python, convex, electron)
  Everything:        tbd docs fork --all         all docs, visible and editable

  Browse / read: tbd docs list / tbd docs show <name>
  Learn more:    tbd docs show tbd-docs   (the manual; alias: tbd docs manual)
? 0
```

The menu body lives in one shared module (`docs-menu.ts`) used by both this overview and
the setup Docs summary, so the two surfaces cannot drift — and the menu only names
selectors that exist (the `--category` hint shipped before the flag once; never again).

With forks present:

```text
$ tbd docs
tbd docs — managed documentation

  [..] available  ([..] upstream, 4 forked into docs/tbd/)
  4 forked: 2 customized, 3 with upstream updates — run 'tbd docs update'

  Inspect:    tbd docs status
  Browse:     tbd docs list
  Update:     tbd docs update
  Learn more: tbd docs show tbd-docs
? 0
```

### `tbd docs list`

Grouped by kind (bold header), each entry in the established two-line form
(`name [SIZE]` then 3-space-indented `Title: Description`), with dim ownership markers
appended:

```text
$ tbd docs list
guideline
  acme-style [SIZE] [forked, customized]
   ACME House Style: Internal style overrides for ACME repos
  python-rules [SIZE] [forked, customized]
   Python Coding Rules: Type hints, docstrings, exception handling, resource management
  typescript-rules [SIZE]
   TypeScript Rules: Strictness, module boundaries, and error handling for TypeScript
  [.. remaining guidelines ..]
shortcut
  review-code [SIZE] [forked]
   Review Code: Comprehensive code review across uncommitted, branch, or PR scopes
  [.. remaining shortcuts ..]
reference
  docmap-format [SIZE]
   Docmap Format: A minimal inventory format for a collection of documents
  docref-format [SIZE]
   Docref Grammar: A single-string, URI-like address for any document
  tbd-docs [SIZE] [forked]
   tbd CLI Documentation: Command reference for the tbd CLI
? 0
```

`tbd docs list --kind=guideline` filters to one group (no kind header needed).
JSON is the docmap object (see “docmap” in Design); the array form is the per-kind
commands’ contract, not this one:

```text
$ tbd docs list --json
{
  "docmap": "docmap/0.1",
  "name": "tbd-docs",
  "documents": [
    {
      "name": "python-rules",
      "type": "guideline",
      "path": "docs/tbd/guidelines/python-rules.md",
      "source": "internal:guidelines/python-rules.md",
      "title": "Python Coding Rules",
      "description": "Type hints, docstrings, exception handling, resource management",
      "state": "customized",
      "stale": true
    }
    [.. one entry per doc; upstream docs have state "upstream" and a source docref
       (their provenance) but no path — every entry carries a location ..]
  ]
}
? 0
```

`tbd guidelines --list --json` (and `shortcut`/`template`) emit the **same** docmap
object, filtered to that kind — the consistency the design mandates: one shape, one
renderer, so the only difference between these commands’ output is the set of documents
in it.

### `tbd docs show` / `tbd docs manual`

Kind-agnostic read; `reference` docs carry no agent header (unlike guidelines).
The manual moves here from the old bare `tbd docs`:

```text
$ tbd docs show tbd-docs | head -3
# tbd CLI Documentation

Git-native issue tracking for AI agents and humans.
? 0

$ tbd docs manual | head -1     # alias for: tbd docs show tbd-docs
# tbd CLI Documentation
? 0

$ tbd docs show python-rules    # serves the forked copy; provenance to stderr
[.. forked file content on stdout ..]
# stderr: (serving forked copy: docs/tbd/guidelines/python-rules.md)
? 0
```

### `tbd docs sync`

Refreshes the gitignored cache; `tbd sync --docs` remains a deprecated alias with
identical output (both render through one shared module, `docs-sync-output.ts`):

```text
$ tbd docs sync
✓ Docs up to date
? 0

$ tbd docs sync                  # after an upgrade changed bundled docs; forks stale
✓ Synced docs: ~1 doc(s)
• Docs: 1 forked doc(s) have upstream updates — run 'tbd docs update'
? 0
```

### `tbd docs fork`

```text
$ tbd docs fork python-rules
✓ Forked python-rules → docs/tbd/guidelines/python-rules.md
  Regenerated docs/tbd/README.md

Edit in place — tbd now serves your copy wherever it served upstream.
? 0

$ tbd docs fork --all --dry-run
[DRY-RUN] Would fork [..] doc(s) into docs/tbd/
...
No files written. Re-run without --dry-run to apply.
? 0

$ tbd docs fork python-rules       # target exists and is not an unmodified fork
Error: docs/tbd/guidelines/python-rules.md already exists and is not an unmodified fork. Refusing to overwrite it. Options:
  tbd docs diff python-rules           # see how it differs
  tbd docs fork python-rules --force   # overwrite with upstream
? 1
```

`--category` selection (shipped with Phase 4; categories come from each doc’s declared
frontmatter, the name-based inference retired):

```text
$ tbd docs fork --category=python --dry-run
[DRY-RUN] Would fork 3 doc(s) into docs/tbd/ (categories: python)
  guideline   python-cli-patterns
  guideline   python-modern-guidelines
  guideline   python-rules
No files written. Re-run without --dry-run to apply.
? 0
```

### `tbd docs unfork`

```text
$ tbd docs unfork python-rules         # customized → refuse
Error: python-rules has local customizations (differs from its base). Refusing to discard them. Options:
  tbd docs diff python-rules             # review your changes
  tbd docs unfork python-rules --force   # discard and fall back to upstream
? 1

$ tbd docs unfork review-code          # unmodified → succeeds
✓ Unforked review-code — served from upstream again.
? 0
```

### `tbd docs status`

The per-doc table (dim header row, `output.table` convention).
The closing summary line matches the bare overview and the `tbd status` Docs line
exactly:

```text
$ tbd docs status
NAME           KIND        STATE              SOURCE
acme-style     guideline   customized, stale  github:acme/eng-docs@main//guidelines/style.md
python-rules   guideline   customized, stale  internal:guidelines/python-rules.md
review-code    shortcut    stale              internal:shortcuts/standard/review-code.md
tbd-docs       reference   forked             internal:tbd-docs.md

4 forked: 2 customized, 3 with upstream updates — run 'tbd docs update'
? 0
```

### Removed forked file (out-of-band deletion)

The user deletes a forked file directly (`rm docs/tbd/guidelines/review-code.md`)
without telling tbd.
Serving keeps working (falls back to upstream), `status` reports `missing` with both
resolutions, and `doctor --fix` finalizes the unfork:

```text
$ rm docs/tbd/shortcuts/review-code.md

$ tbd docs show review-code          # still works — falls back to upstream
[.. upstream review-code content on stdout, no provenance note ..]
? 0

$ tbd docs status
NAME           KIND        STATE              SOURCE
acme-style     guideline   customized, stale  github:acme/eng-docs@main//guidelines/style.md
python-rules   guideline   customized, stale  internal:guidelines/python-rules.md
review-code    shortcut    missing            internal:shortcuts/standard/review-code.md
tbd-docs       reference   forked             internal:tbd-docs.md

1 doc(s) missing (forked file deleted or renamed):
  review-code   restore with 'tbd docs fork review-code --force', or finalize with 'tbd docs unfork review-code'
? 0

$ tbd doctor --fix                   # excerpt
⚠ Forked docs - 1 missing (review-code: forked file deleted)
    Fixed: finalized unfork (removed manifest entry + base); now served from upstream
? 0
```

### `tbd docs diff`

Git-style, no network (`git diff --no-index` against the relevant copy):

```text
$ tbd docs diff python-rules           # your file vs current upstream (the net fork)
--- upstream:guidelines/python-rules.md
+++ docs/tbd/guidelines/python-rules.md
@@
[.. unified diff hunks ..]
? 0

$ tbd docs diff python-rules --base    # your file vs its base (what you changed)
$ tbd docs diff python-rules --upstream # base vs current upstream (incoming changes)
```

### `tbd docs update`

Default run on the canonical fixture: refresh the unmodified-stale doc, apply the clean
merge, and *list* the conflict for a decision (never touch it by default):

```text
$ tbd docs update
Updated 2 forked doc(s):
  ✓ review-code: refreshed to upstream (was unmodified)
  ✓ python-rules: merged upstream cleanly (review with: git diff)

1 doc(s) need a decision:
  ⚠ acme-style: your changes conflict with upstream
  re-run with one of:
    tbd docs update <name> --merge      # combine, then resolve conflict markers
    tbd docs update <name> --keep-ours  # keep your version, advance the fork point
? 0

$ tbd docs update acme-style --merge
Updated 1 forked doc(s):
  ✓ acme-style: wrote merged content with conflict markers; resolve them, then it returns to 'customized'
? 0

$ tbd docs update acme-style --keep-ours
Updated 1 forked doc(s):
  ✓ acme-style: kept your version; fork point advanced
? 0

$ tbd docs update --dry-run
Would update 2 forked doc(s):
  ✓ review-code: refreshed to upstream (was unmodified)
  ✓ python-rules: merged upstream cleanly (review with: git diff)
...
? 0
```

### `tbd docs add`

Aligned with the per-kind `--add` output (kept as aliases), restated for docrefs — the
canonical docref is what config records; git docrefs require an explicit `@ref`:

```text
$ tbd docs add github:acme/eng-docs@main//guidelines/style.md --kind=guideline --name=acme-style
Adding guideline: acme-style
  Source: github:acme/eng-docs@main//guidelines/style.md
✓ Added to .tbd/docs/guidelines/acme-style.md
  Config updated (docs_cache.files): github:acme/eng-docs@main//guidelines/style.md

Run 'tbd docs list' to verify, or 'tbd docs fork acme-style' to make it visible.
? 0

$ tbd docs add ./team/team-rules.md --kind=guideline     # local docrefs work offline
Adding guideline: team-rules
  Source: ./team/team-rules.md
✓ Added to .tbd/docs/guidelines/team-rules.md
  Config updated (docs_cache.files): ./team/team-rules.md

Run 'tbd docs list' to verify, or 'tbd docs fork team-rules' to make it visible.
? 0
```

### `tbd status` (Docs line) and `tbd setup --auto` (Docs summary)

`tbd status` gains a Docs line **only when forks exist** — so with zero forks the output
is byte-identical to today’s `cli-orientation-golden.tryscript.md` (honoring the
“default behavior unchanged when nothing is forked” guarantee).
When forks exist it appears after the Worktree line, before the footer:

```text
$ tbd status                      # excerpt, forks present
[.. INTEGRATIONS, Worktree as today ..]

Docs: 4 forked (2 customized, 3 with upstream updates — run 'tbd docs update')

Use 'tbd stats' for issue statistics, 'tbd doctor' for health checks.
? 0
```

`tbd setup --auto` prints the Docs summary (zero-fork = the menu; with forks = a
pending-update report); setup never writes the fork dir:

```text
# zero forks — same three-posture menu as the bare overview, prefixed Docs:
Docs: [..] docs available in the cache (.tbd/docs/, gitignored); none forked into the repo.
  Guidelines are active from the cache. Three postures, all serving the same docs:
  Hidden (default):  keep the cache as-is — zero repo footprint
  Curated:           tbd docs fork <name> [...]  fork chosen docs into docs/tbd/
                     tbd docs fork --category=<name>  (general, typescript, python, convex, electron)
  Everything:        tbd docs fork --all         all docs, visible and editable
  Browse / read: tbd docs list / tbd docs show <name>

# after an upgrade, forks present
Docs: 1 forked into docs/tbd/. 1 have upstream updates — run 'tbd docs update'.
```

The setup menu and the bare-overview menu share wording by construction
(`docs-menu.ts`), and `tbd status` adds its one Docs line only when forks exist:

```text
$ tbd status                      # excerpt, forks present
Docs: 4 forked (2 customized, 3 with upstream updates — run 'tbd docs update')
```

### `tbd doctor` (new HEALTH CHECKS)

Appended to the existing `HEALTH CHECKS` list, following doctor’s `✓`/`⚠` + `Run:`
convention (icon at column 0, no indent):

```text
$ tbd doctor                      # excerpt
[.. existing health checks ..]
✓ Forked docs - 4 forked, base snapshots intact
⚠ Forked docs - 1 unresolved merge conflict (acme-style)
    Run: resolve the conflict markers, then re-run tbd docs update
✓ Fork dir - docs/tbd/ tracked in git (not gitignored)
✓ Reserved tbd- names - no user docs claim the prefix
? 0
```

### Existing golden tests that change

The plan’s original Testing Strategy listed only *new* tests.
These *existing* goldens break and must be rewritten in the same release; each is one
bead, blocked on the phase that ships the behavior:

| Test | Change | Phase |
| --- | --- | --- |
| `cli-help-all.tryscript.md` (≈7 `tbd docs` blocks: `--help` `[topic]`/`--section`, `--list` sections, positional topic, `--section` content, `--list --json`, bare manual) | **Done (this PR).** Rewrite to the new surface: `docs` subcommand help; no top-level `--section`/section-`--list`; section nav becomes `tbd docs show tbd-docs --section`. Largest single change. | 1–2 |
| `cli-doc-output.tryscript.md` ("Docs Command" block: `tbd docs --list` → “Available documentation sections:”) | **Done (this PR).** Section listing retargeted to `tbd docs show tbd-docs --sections`; the cross-kind `tbd docs list` golden lives in `cli-docs-fork.tryscript.md`. | 2 |
| `cli-doc-output.tryscript.md` ("Guidelines --json returns structured data" block: flat `[ { … } ]` array) | **Done (this PR).** Rewrite: per-kind `--list --json` now emits a docmap object, not an array (Resolved Decision 21). The per-kind `--list` *text* blocks stay (same canonical format), so only the JSON assertion changes. | 2 |
| `golden-output.test.ts` (`tbd docs --all` inline snapshot) | **Done (this PR).** Replace with the bare `tbd docs` overview snapshot (`--all` folded into the overview). | 2 |
| `golden-output.test.ts` ("post-setup What’s Next") | **Done (this PR).** Extend to assert the Docs menu lines. | 4 |
| `cli-orientation-golden.tryscript.md` (`tbd status`) | **Unchanged** for zero forks (verifies the guarantee); **add** a new forked-state status golden in a fixture with a fork. | 1 |
| `setup-flows.test.ts` | **Done (this PR).** Extend for the Docs summary (menu + pending-update report). | 4 |
| `doc-references.test.ts` | **Done (this PR).** Extend the extractor: add `tbd docs <subcommand>` and the `reference` kind; remove the `reference`/`prefix:` skips so `tbd docs show tbd-docs`, `suggest-upstream-improvements`, and the new reference docs all resolve. | 5 (extractor); 0 (the new docs it must resolve) |
| `doc-add-e2e.test.ts` | **Done (this PR).** Keep (per-kind `--add` stays an alias) and **extend** with `tbd docs add <docref>`. | 2 |

New golden/e2e files (named for the phases that add them): `fork-manifest` +
state-matrix units (Phase 1); a `cli-docs-fork.tryscript.md` lifecycle (fork → list
marker → serve → edit → unfork refuse → `--force`) (Phase 1); `fork-update`
decision-table units + a `cli-docs-update.tryscript.md` upgrade/merge scenario (Phase
3); category-selection units + a `fork --category` e2e (Phase 4); a deleted-fork
scenario in the Phase 1 lifecycle test (serve falls back to upstream, status `missing`,
`doctor --fix` finalizes).

## Testing Strategy

- **Unit (vitest)**: manifest round-trip; hash normalization (CRLF/LF); the full state
  matrix as a table-driven test (base hash × file hash × cache hash × conflicted flag →
  state); the update decision table row by row and per strategy (replace, clean
  three-way, conflict skip, `--merge` markers + base advance, `--keep-ours` keep-file +
  base advance, strategy-flag mutual exclusion, conflicted-pending skip, missing-base
  repair via `--keep-ours`, orphaned); marker auto-clear; f04→f05 migration; the ported
  docref spec-mirror tests; local_dirs precedence ordering; source-root grouping (N docs
  from one repo → one fetch; per-group failure isolation; cache preserved on fetch
  failure); git revision/tag capture in the manifest; `--json` output validating against
  the docmap schema; category-based fork selection; fork path mapping (incl.
  shortcuts flattening); README index generation.
- **E2E (spawn against built CLI, like `doc-add-e2e.test.ts`)**: the Phase 1 scenario
  above; precedence (forked shadows upstream; local file with no entry is served); an
  upgrade simulation (fork → customize → mutate the cache copy to simulate a new
  upstream version → `update` cleanly merges non-overlapping edits, then a conflicting
  edit is listed and only merged with `--merge`, resolving markers returns the doc to
  `customized`); convergence-unfork (upstream adopts the customization → `update` →
  plain `unfork` succeeds); group surface (bare `tbd docs` shows status,
  `tbd docs show tbd-docs` serves the manual, `tbd sync --docs` alias still works);
  `fork --category=python`; out-of-band deletion of a forked file (serve falls back to
  upstream, status `missing`, `doctor --fix` finalizes the unfork); collision/overwrite
  refusal; doctor findings.
- **Docs-reference test**: extend `doc-references.test.ts` so every command named in the
  new shortcut/docs resolves (extractor learns `tbd docs <subcommand>` and the
  `reference` kind; the `reference`/`prefix:` skips are removed).
- **Golden output**: the expected console output for every new and changed command is
  specified in [Golden-Test Maps](#golden-test-maps) (the consistency contract plus a
  per-command map against one canonical fixture).
  Each map is lifted into its harness (tryscript or vitest inline snapshot) by the phase
  that ships the command.
- **Existing goldens that break** are catalogued in
  [Existing golden tests that change](#existing-golden-tests-that-change) — notably
  `cli-help-all.tryscript.md`, `cli-doc-output.tryscript.md`, and the `tbd docs --all`
  snapshot in `golden-output.test.ts`. Each rewrite is a bead blocked on the behavior’s
  phase, so CI never carries a silently-failing golden.
  A red-then-green pass on these (run the rewritten golden against the old binary to
  confirm it fails, then against the new one) verifies the surface actually changed.

## Relationship to PR #117

This spec deliberately implements the smallest forward-compatible slice of that redesign
(note: #117’s draft used “f05” as its format id; this spec’s layout bump now claims f05,
so the full framework would land as f06+):

| #117 concept | Here | Future-proofing |
| --- | --- | --- |
| W8 fork / G4 local override | `tbd docs fork` + shadowing | fork dir becomes a `local` source in the source framework |
| G10 provenance / review pt. 4 “recorded override edge” | `.tbd/doc-forks/forks.yml` manifest | manifest entries become the framework’s override edges; fields chosen to match (source, hash, version) |
| W9 diff / G6 status | `tbd docs diff`/`status`, doctor | states map onto the framework’s status vocabulary |
| W10/W11 upstream roundtrip + unfork | playbook shortcut + convergence via `update` + `unfork` | can later be automated as `tbd docs upstream` |
| W5 sync vs. update separation; review pt. “record enough for three-way later” | cache refresh stays passive (`tbd docs sync`); `tbd docs update` is the explicit advance, with stored bases enabling three-way merge now | maps onto the framework’s `sync`/`source update` contract |
| G2 local project docs | `local` files in fork dir + `docs_cache.local_dirs` | becomes a first-class local source |
| docref format (design-docref-format.md) | **adopted wholesale**: parser ported, universal source-address grammar, shipped as a reference doc | the framework inherits addresses with no migration |
| docmap format (design-docmap-format.md) | **redefined and reduced**: the minimal inventory format (docmap/0.1) is extracted, freshly specced, and adopted as the `--json` contract | #117’s manifest/lockfile/sync becomes future “operations over docmaps,” consuming the same format |
| Source framework, lockfiles, DocGraph split, doc types as data | **not built** | unchanged decision space; nothing here constrains Q15–Q19 |

Recommendation: keep PR #117 open as the long-horizon design reference (or convert its
spec to `specs/future/`), and note there that the fork kernel shipped separately.

## References

- `docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md` (PR #117 branch
  `claude/review-config-format-2wxh8`) — the full framework design and its review
  thread.
- `packages/tbd/docs/design-docref-format.md` and
  `packages/tbd/docs/design-docmap-format.md` (same #117 branch) — the docref grammar
  and the exploratory docmap draft this spec distills into docmap/0.1, along with the
  `src/docref/` reference implementation and tests.
- `src/file/doc-sync.ts`, `src/file/doc-cache.ts`, `src/file/doc-add.ts` — current
  cache, lookup/shadowing, and add-by-URL implementations this builds on.
- Done specs: `plan-2026-01-22-doc-cache-abstraction.md`,
  `plan-2026-01-26-configurable-doc-cache-sync.md`,
  `plan-2026-02-02-external-docs-repos.md`.
- [shadcn/ui](https://ui.shadcn.com) — the “open code / copy and own” registry model
  this borrows.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
