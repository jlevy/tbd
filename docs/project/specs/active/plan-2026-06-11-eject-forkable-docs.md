---
title: Eject Workflow for Forkable Docs
description: Minimal shadcn-style eject/uneject workflow so bundled guidelines, shortcuts, and templates can be copied into the repo, customized, tracked in git, and offered back upstream
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Eject Workflow for Forkable Docs

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
   noun-verb convention (`dep add`, `label add`, `attic restore`): `tbd docs eject`
   copies any bundled doc (or all of them, or a language-relevant pack) into a visible,
   git-tracked folder in the repo (default `docs/tbd/`). Ejected docs shadow the bundled
   copies in all lookups, so customizing them Just Works.
   `tbd sync` keeps its scope (project data); `tbd docs sync` takes over cache refresh.
2. **`tbd docs uneject`** — remove an ejected copy and fall back to the bundled version,
   refusing to discard customizations unless `--force` is given.
3. **`tbd docs update`** — after a tbd upgrade, pull upstream changes into ejected docs:
   unmodified copies refresh in place; customized copies get a git three-way merge that
   applies automatically when clean; conflicting docs are listed until you choose a
   resolution: `--merge` (combine, with standard conflict markers) or `--rebase` (keep
   your version and advance the fork point).
4. **A small committed manifest plus stored merge bases** (`.tbd/ejected.yml` +
   `.tbd/eject-base/`) recording, for each ejected doc, exactly which upstream content
   it forked from — making “customized?”, “stale vs upstream?”, and three-way merging
   cheap, exact, offline operations.
5. **Setup opt-in** — `tbd setup --interactive` asks how visible docs should be (current
   hidden default, eject relevant packs, or eject everything); agents are taught to ask
   the same question during onboarding and run eject themselves.
6. **An upstream-contribution playbook** — a bundled shortcut that walks an agent
   through diffing customized docs against upstream and filing a GitHub issue on
   `jlevy/tbd` with the proposed improvements.
   Pure documentation, no new code.

This is the shadcn “copy and own” model: bundled docs are the registry, eject is the
copy step, git is the fork, and a GitHub issue is the upstream PR — plus the update path
(merging upstream changes into your fork) that plain copy-and-own registries famously
lack. Everything here is forward-compatible with the larger #117 design (see
[Relationship to PR #117](#relationship-to-pr-117)).

## Goals

- **G1. Visibility:** A user can get any or all bundled docs as plain files in their
  repo, browsable on GitHub and checked into git.
- **G2. Forkability:** An ejected doc can be edited freely; tbd serves the edited
  version everywhere the bundled one was served (CLI lookup, agent shortcuts).
- **G3. Safe reversal:** Un-ejecting an unmodified doc is trivial; un-ejecting a
  customized doc is an error unless forced, so customizations are never silently lost.
- **G4. Provenance:** For every ejected doc, tbd can answer: where did it come from, has
  it been customized, and has upstream changed since eject.
- **G5. Setup choice:** During setup, users confirm how visible they want docs to be.
  The default remains exactly the current behavior (hidden cache).
- **G6. Language relevance:** Users can say what language(s) they work in and eject just
  the relevant guidelines (with auto-detection as a convenience).
- **G7. Upstream loop:** A documented, low-ceremony path from “I improved a guideline”
  to “an issue with the diff is filed on jlevy/tbd.”
- **G8. Agent-operable:** Every step is a plain CLI command with `--json` output, and
  the tbd skill routes natural requests ("I want to customize the Python guidelines") to
  the right commands.
- **G9. Safe updates:** Upgrading tbd flows upstream improvements into ejected docs
  without losing customizations: trivial and cleanly mergeable updates apply by default,
  conflicts are surfaced explicitly and merged only on opt-in, and nothing is ever
  silently overwritten.
- **G10. Open location conventions:** Source addresses and the doc index follow small,
  documented, tool-agnostic conventions (the docref grammar; docmap’s generated-map
  schema), shipped as bundled reference docs — so docs in locations beyond
  bundled/ejected have a stable addressing story from day one, shared with the future
  source framework.

## Non-Goals

- **No data-model rework.** The f05 bump is a layout-version stamp plus new committed
  artifacts; issue storage, sync, and the docs-cache format are untouched.
  The larger source-framework redesign (PR #117) remains future work.
- **No multi-file external sources yet.** The docref *grammar* is adopted now for all
  source addresses, single-file `tbd docs add <docref>` generalizes today’s `--add`, and
  `docs_cache.local_dirs` serves other in-repo directories — but whole-repo/bundle
  sources, lockfiles, and external-source sync (docmap’s manifest/write side) stay in
  the f06+ framework.
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
- There is no eject/override command, no provenance tracking, and no content hashing;
  doc kinds are a closed union `'guideline' | 'shortcut' | 'template'`
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
lockfile identity). It models eject as one workflow (W8) inside a much larger source
framework.
The kernel below delivers W7–W11’s user value with ~3 small modules and only a
stamp-style format migration, and produces real usage data that will inform the bigger
design if we still want it.

## Design

### The `tbd docs` command group

All operations on managed docs consolidate under one noun-scoped group, matching tbd’s
existing `dep`/`label`/`attic`/`config`/`workspace` convention.
Commands are split by scope: **`tbd sync` moves project data** (issues/beads —
unchanged), **`tbd docs` manages the doc layer** (cache + ejected files).
Verbs-as-flags (`--update`, `--status`, …) are avoided; each operation is a subcommand:

```bash
tbd docs                      # bare = status overview of managed docs
tbd docs list                 # all docs across kinds, with [ejected]/[customized] markers
tbd docs show <name>          # read any doc by name, kind-agnostic
tbd docs sync                 # refresh the gitignored cache (absorbs `tbd sync --docs`)
tbd docs add <docref>         # register a single external doc (URL, github:, local path)
tbd docs eject / uneject      # fork into the repo / return to bundled
tbd docs update               # reconcile forks with upstream (--merge / --rebase)
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
  ejectable like everything else.
  The `tbd-` prefix is reserved for tbd self-docs (`tbd doctor` warns on user docs
  claiming it).
- **The old bare `tbd docs` manual viewer is repurposed**: bare `tbd docs` now shows the
  status overview (the scope’s landing page); the CLI reference it used to display is
  `tbd docs show tbd-docs`, with `tbd docs manual` as a convenience alias.
  No backward compatibility is kept for the old bare behavior.
  The sibling viewers `tbd readme` and `tbd design` are unchanged for now (candidates
  for the same treatment later).

### The eject directory

One repo-relative directory holds all ejected (and any hand-authored) tbd docs:

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

- Default: `docs/tbd/`. The location is surfaced as an explicit, editable customization
  during setup (and changeable any time); a non-default choice is persisted to the new
  config key `docs_cache.eject_dir` (part of the f05 layout).
- Layout is `<eject_dir>/<kind-dir>/<name>.md`. The bundled
  `shortcuts/system|standard|custom` subdivision is **flattened** to `shortcuts/` on
  eject — that split is an implementation detail; the manifest preserves the original
  source path for uneject and provenance.
- Files are copied **verbatim** (no frontmatter injection, no stamping).
  Provenance lives in the manifest, so ejected files stay clean, diffable, and forkable.
- A small `README.md` index is generated into the eject dir (and regenerated on every
  eject/uneject/update).
  It explains what these docs are (engineering guidelines, shortcuts, and templates
  forked from tbd’s bundled set), lists each doc with its frontmatter description, notes
  that the folder is managed by `tbd docs eject`, and points readers at
  `npx get-tbd@latest docs` for further info.
  This makes the folder self-explanatory when browsed on GitHub.

### The eject manifest and stored merge bases

`.tbd/ejected.yml` — committed (the existing `.tbd/.gitignore` only excludes specific
paths, so this is tracked automatically, like `config.yml`):

```yaml
# Managed by `tbd docs eject` / `uneject` / `update`.
ejected:
  - name: python-rules
    kind: guideline
    path: docs/tbd/guidelines/python-rules.md   # repo-relative
    source: internal:guidelines/python-rules.md # or the URL for --add'ed docs
    tbd_version: 0.2.3                          # version when base was last set
    base_hash: sha256:9f2c…                     # hash of the stored base content
    conflicted: true                            # only present after `update --merge`
                                                # left conflict markers; auto-clears
```

Alongside it, **`.tbd/eject-base/<kind>/<name>.md`** (also committed) stores a verbatim
copy of the upstream content the fork is based on — set at eject time and advanced by
`tbd docs update`. This is the *base* of every three-way merge:

- A hash alone cannot drive a merge; the actual base content is required, and it must be
  committed so any collaborator (or CI) can run `tbd docs update` later with full
  fidelity, regardless of which tbd version originally ejected the doc.
- `base_hash` is the SHA-256 of the LF-normalized base content (line-ending
  normalization avoids false “customized” results from `core.autocrlf` on Windows).
  `tbd doctor` verifies the base file still hashes to it.
- This manifest + base pair is the *recorded override edge* that the PR #117 design
  review called for (its point 4), in miniature — and it records “enough data to add
  three-way merge later without changing the format,” which that review asked for, by
  shipping three-way merge now.
  It makes these exact, offline checks:
  - **customized**: current file hash ≠ `base_hash`
  - **stale**: current bundled/cache content hash ≠ `base_hash` (upstream moved since
    the base was last advanced — independent of whether the user edited)
- Because manifest and bases are committed, collaborators who pull get identical
  resolution, status, and merge behavior.

The cost is a committed second copy of each ejected doc.
That duplication is the price of a real update story (see Alternatives #5); shadcn-style
registries that skip it have no upgrade path at all.

### Format bump: f05

The new committed layout artifacts (`.tbd/ejected.yml`, `.tbd/eject-base/`, the
`docs_cache.eject_dir` and `docs_cache.local_dirs` keys) constitute a layout revision,
so `tbd_format` bumps to **f05** with a step in the existing migration chain
(`src/lib/tbd-format.ts`, following the f03→f04 precedent):

- The f04→f05 migration is metadata-only: stamp the format id and refresh the
  `.tbd/.gitignore` template/comments.
  No files move; eject artifacts appear only when eject is first used.
- Older CLIs encountering an f05 repo detect the newer format id via the existing
  compatibility machinery and prompt to upgrade — an explicit signal, rather than
  silently serving bundled copies while upgraded teammates see customized ones.
- Layout documentation updates alongside: format history in `tbd-format.ts`,
  `tbd-design.md` layout sections, and the path conventions in `development.md`.
- Naming note: PR #117’s draft called its future format “f05”; since this kernel claims
  f05, that redesign would land as f06+.

### The cache stays complete

`tbd setup --auto` / `tbd docs sync` continue to install **all** docs into `.tbd/docs/`,
including ones that are ejected.
The cache copy is the pristine reference: it is what `diff` and staleness compare
against, it is the “theirs” side of every `update` merge, and it is what serving falls
back to after `uneject`. Setup and cache sync never touch files in the eject dir —
tracked files change only via the explicit eject/uneject/update commands.

### Resolution precedence

Effective lookup order per kind, applied structurally (not by asking users to hand-edit
`lookup_path` — the PR #87 “lookup_path zombie” lesson):

```
<eject_dir>/<kind-dir>/        # ejected + hand-authored local docs (highest)
<local_dirs entries>           # other in-repo doc dirs (optional config; see below)
<existing lookup paths>        # .tbd/docs/... as today
```

- Implemented by prepending the eject-dir path when building each command’s `DocCache`
  path list. As part of this, guidelines and templates start honoring the same
  config-driven path mechanics that shortcuts already use (small unification of
  `guidelines.ts:69` / `template.ts:19`).
- The existing first-match-wins shadowing in `DocCache` then does all the work: an
  ejected `python-rules.md` shadows the cache copy with no new resolution code.
- **Local docs for free:** any `.md` file a user drops into the eject dir is served with
  top precedence even with no manifest entry.
  Status reports it as `local` (no provenance, nothing to uneject).
  This cheaply delivers “easy project-local docs” (PR #117’s G2) without any
  registration ceremony.
- When a reading command serves an ejected/local doc, it prints a one-line provenance
  note to stderr, e.g. `(serving ejected copy: docs/tbd/guidelines/python-rules.md)`,
  and `--list` output marks such docs `[ejected]` / `[ejected, customized]` / `[local]`.

### Docs in other locations: docref, `local_dirs`, and the docmap view

The kernel so far assumes two locations: the bundled cache and the eject dir.
Three measured adoptions from the PR #117 branch generalize *location* without pulling
in the source framework:

**1. docref is adopted now as the universal source-address grammar.** Every “where does
this doc come from” string — `docs_cache.files` values, the eject manifest’s `source:`
field, `tbd docs add` arguments, `local_dirs` entries — is a docref: a single-string,
URI-like address (`./path/`, `https://…`, `github:org/repo@ref//path`, plus
consumer-defined schemes — tbd’s `internal:` already fits the grammar).
Adoption is nearly free: the parser is ~100 lines, standalone, already written and fully
tested on the #117 branch (`src/docref/`), and today’s `internal:` prefixes and URLs are
already valid docrefs.
It also rationalizes the ad-hoc GitHub blob-URL conversion in `--add` into principled
normalization (`https://github.com/o/r/blob/main/f.md` → `github:o/r@main//f.md`), and
it means the f06 source framework later inherits addresses instead of migrating them.

**2. `docs_cache.local_dirs` serves docs from other directories in the repo.** An
ordered list of local-path docrefs (`./`-prefixed) naming additional in-repo doc
directories:

```yaml
docs_cache:
  eject_dir: docs/tbd
  local_dirs:
    - ./docs/general/agent-rules/   # e.g. a team guidelines dir that already exists
```

These slot into the effective lookup order between the eject dir and the cache (see
above). Docs found there are first-class for reading — `list`, `show`, serving, with
provenance notes — and report state `local`; they are not ejectable or updatable, since
there is no upstream: they already live in the repo.
`DocCache`’s multi-directory shadowing handles this with zero new resolution code; it is
the supported, documented form of what `lookup_path` half-allowed today.

**3. docmap’s *generated-map schema* is adopted as the read contract.**
`tbd docs list --json` and `status --json` emit entries per the docmap map schema
(`key`, `type`, `path`, `title`/`description`, `word_count`, with tbd’s state fields as
extensions) — docmap as a *view*, not a system.
Agents and other tools get a stable machine-readable index of every doc tbd can serve,
and when f06 adds docmap’s manifest/lockfile/sync half, the read side already exists.
For v1 the `bundle` field is provisional: `tbd` for bundled-origin docs, `proj` for
local/eject-dir-authored ones.

**The line deliberately not crossed:** pulling a *directory* of docs from another repo
(a true external bundle) requires sync, pinning, and cache identity — docmap’s write
side — and stays in f06. Until then the supported answers are: single files via
`tbd docs add <docref>`, in-repo directories via `local_dirs`, and (if a team must share
a guidelines repo today) vendoring/submoduling it and pointing `local_dirs` at it.

Both format docs ship as bundled `reference`-kind docs (`docref-format`,
`docmap-format`), adapted from the #117 branch with status banners — docref marked
adopted (v0.1); docmap marked draft, with a note that tbd currently implements the map
schema only. As regular docs they are listable, ejectable, and forkable like everything
else — the conventions document themselves through the system they describe.

### Doc states

| State | Meaning | Detected by |
| --- | --- | --- |
| `bundled` | served from cache, not ejected | not in manifest |
| `ejected` | ejected, unmodified | file hash == `base_hash` |
| `customized` | ejected and edited locally | file hash ≠ `base_hash` |
| `stale` | upstream changed since base was set (orthogonal to customized) | cache hash ≠ `base_hash` |
| `conflicted` | `update --merge` left unresolved conflict markers | manifest `conflicted` flag AND markers still present in file |
| `local` | file in eject dir with no manifest entry, or served from a `local_dirs` directory | file present, no entry |
| `missing` | manifest entry but file deleted | entry present, file absent |
| `orphaned` | manifest entry whose source no longer exists in the bundle | `internal:` source absent |

`customized` and `stale` can combine (`customized+stale`): the user edited *and*
upstream moved — exactly the case the update merge and the upstream-contribution
playbook care about.
The `conflicted` flag is set only by `update --merge` and clears automatically once the
standard markers (`<<<<<<<`/`=======`/`>>>>>>>`) are gone; scanning for markers only in
flagged docs avoids false positives on docs that legitimately discuss merge conflicts.

### Updating ejected docs after a tbd upgrade

The most common lifecycle event: you ejected docs, upgraded tbd (or `tbd docs sync`
pulled fresh content), and the bundled versions moved.
`tbd docs update` reconciles ejected copies with upstream, outsourcing the merge itself
to git (`git merge-file current base other` — works on plain files, exit code reports
conflict count, standard markers, no repo state touched):

When a doc isn’t cleanly updatable, the user chooses one of two resolution strategies
(mutually exclusive flags): **`--merge`** combines both sides, writing standard conflict
markers to resolve by editing; **`--rebase`** keeps the local version untouched and just
advances the fork point to current upstream (“my fork supersedes this upstream change” /
“I already folded it in by hand”).

| Doc state | `update` (default) | `update --merge` | `update --rebase` |
| --- | --- | --- | --- |
| `ejected` (unmodified) + stale | replace file with new upstream; advance base | same | same |
| `customized` + stale, three-way merge is clean | apply merged result; advance base | same | keep file as-is; advance base only |
| `customized` + stale, merge conflicts | **skip**; warn and list the docs: “re-run with `--merge` (combine, resolve markers) or `--rebase` (keep your version)” | write conflict markers into the file; advance base; set `conflicted` | keep file as-is; advance base only |
| `customized`, not stale | no-op | no-op | no-op |
| `conflicted` (unresolved markers) | skip + warn: resolve first | skip + warn | skip + warn |
| `orphaned` | skip + note (upstream removed the doc; keep your copy or `uneject`) | same | same |
| `missing` / `local` | skip (doctor’s problem / nothing upstream) | same | same |
| base file missing (manual deletion) | cannot merge; skip + point at `--rebase` | same | re-establish base from current upstream (repair) |

Design points:

- **Clean merges apply by default deliberately.** The ejected file is git-tracked, so
  every auto-merge is fully visible in `git diff` and trivially revertible — git is the
  undo. Conflicted docs are never touched by default; the listing names the two
  strategies and the user (or agent) re-runs with one.
- **Base advance happens at merge time.** After any update (replace, clean merge, or
  conflicted `--merge`), the base becomes the new upstream content.
  So post-resolution, the doc is simply “a customized fork of current upstream” — states
  stay coherent with no extra bookkeeping.
- **`--rebase` is not git-rebase content semantics** (for single files, replaying your
  diff onto the new base is just the same three-way merge).
  Here it means *re-base the fork point*: your content stands, upstream’s change is
  acknowledged, staleness clears, and future updates diff against the new base.
  It also repairs a missing base file.
- **Only the explicit command mutates tracked files.** `tbd setup --auto` and the
  24-hour doc auto-sync refresh the gitignored cache as today and then *report* pending
  updates (`2 ejected docs have upstream updates — run 'tbd docs update'`), but never
  write into the eject dir.
  Background paths rewriting committed files would be surprising and hard to audit.
- **Convergence is the unfork path.** If you customized a doc, upstream later adopted
  your change, and `update` merges cleanly such that the file now equals upstream, the
  doc returns to plain `ejected` (unmodified) — and `tbd docs uneject` works without
  `--force`.
- `--dry-run` previews all of the above, including which docs would conflict.

### CLI surface

```bash
# Read and browse (works with zero ejected docs)
tbd docs                                   # status overview (bare command)
tbd docs list [--kind=guideline]           # all docs across kinds, with state markers
tbd docs show python-rules                 # read any doc by name (kind-agnostic)
tbd docs show tbd-docs                     # tbd's own manual, via the tbd- prefix
tbd docs manual                            # alias for `tbd docs show tbd-docs`
tbd docs sync                              # refresh the gitignored cache

# Add external docs (single files; consolidates the per-kind --add flags)
tbd docs add https://example.com/style.md --kind=guideline --name=acme-style
tbd docs add github:org/repo@main//docs/rules.md --kind=guideline   # any docref form

# Eject
tbd docs eject python-rules                # one doc (name resolution as in `tbd guidelines`)
tbd docs eject python-rules review-code    # several
tbd docs eject --kind=guideline typescript # disambiguate if a name exists in two kinds
tbd docs eject --pack=python               # curated pack (repeatable: --pack=python --pack=core)
tbd docs eject --relevant                  # packs chosen by repo detection (see below)
tbd docs eject --all                       # everything
tbd docs eject --all --dry-run             # preview what would be written

# Inspect
tbd docs status [--json]                   # table of all ejected docs + states
tbd docs diff python-rules                 # your file vs current upstream (the net fork)
tbd docs diff python-rules --base          # your file vs its base (what you changed)
tbd docs diff python-rules --upstream      # base vs current upstream (incoming changes)

# Update (after a tbd upgrade; see "Updating ejected docs" above)
tbd docs update                            # refresh unmodified + apply clean merges; list conflicts
tbd docs update python-rules               # limit to specific docs
tbd docs update --merge                    # conflicts: combine, write conflict markers to resolve
tbd docs update --rebase                   # conflicts: keep your version, advance the fork point
tbd docs update --dry-run                  # preview, including which docs would conflict

# Reverse
tbd docs uneject python-rules              # delete file + base + manifest entry; ERROR if customized
tbd docs uneject python-rules --force      # discard customizations deliberately
tbd docs uneject --all [--force]
```

The existing per-kind readers (`tbd guidelines <name>`, `tbd shortcut <name>`,
`tbd template <name>`) are unchanged — `tbd docs show` is the kind-agnostic superset
that also reaches `reference` docs.

Behavior details:

- **Eject refuses to overwrite.** If the target path exists and is not an unmodified
  ejected copy (e.g. a pre-existing user file), eject errors and lists the conflict;
  `--force` overwrites.
  Never silently clobber user content.
- **Re-ejecting an already-ejected doc** is just an update: on an *unmodified* doc it
  refreshes to current bundled content (same as `update`); on a customized doc it errors
  and points at `update` / `diff` (`--force` remains the explicit
  start-over-from-upstream escape hatch, discarding customizations).
- **Uneject of a `missing` doc** cleans up the manifest entry (with a note).
- **Added external docs (`tbd docs add <docref>`) are ejectable too** — the manifest
  `source` is the normalized docref and staleness compares against the cache copy, which
  `tbd docs sync` already refreshes.
  No special casing. The per-kind `--add`/`--name` flags remain as aliases for
  `tbd docs add`.
- All subcommands support `--json` and `--dry-run` per the existing CLI conventions.
- `tbd status` gains one summary line (e.g.
  `Docs: 4 ejected (1 customized, 2 with upstream updates — run 'tbd docs update', 1 conflict pending)`)
  and `tbd doctor` gains checks: missing files, orphaned entries, base files
  missing/corrupt (hash mismatch), unresolved `conflicted` docs, reserved `tbd-` name
  collisions, eject dir covered by a `.gitignore` (defeats the purpose — warn),
  manifest/dir drift.

### Packs and language detection

A small constant map in code (e.g. `src/file/doc-packs.ts`), not config — easy to test,
easy to extend later if we move it to frontmatter tags:

| Pack | Contents (guidelines unless noted) |
| --- | --- |
| `core` | general-eng-agent-principles, general-coding-rules, general-comment-rules, error-handling-rules, general-tdd-guidelines, general-testing-rules, commit-conventions, common-doc-guidelines |
| `typescript` | typescript-rules, typescript-cli-tool-rules, typescript-sorting-patterns, typescript-yaml-handling-rules, typescript-code-coverage, pnpm-monorepo-patterns, bun-monorepo-patterns |
| `python` | python-rules, python-modern-guidelines, python-cli-patterns |
| `convex` | convex-rules, convex-limits-best-practices |
| `electron` | electron-app-development-patterns |

`--relevant` = `core` plus packs chosen by cheap repo detection: `package.json`/
`tsconfig.json` → `typescript`; `pyproject.toml`/`uv.lock`/`requirements.txt` →
`python`; `convex/` dir or `convex` dependency → `convex`; `electron` dependency →
`electron`. Detection is a pure function over the repo root — trivially unit-testable.
Shortcuts/templates are not in packs v1 (eject them by name or `--all`); revisit if
there is demand.

### Setup integration

- **`tbd setup --auto`: unchanged.** Cache-only remains the default; the summary output
  gains one hint line:
  `Docs are cached in .tbd/docs/ (gitignored). Run 'tbd docs eject' to copy guidelines into your repo as visible, forkable files.`
  When ejected docs exist and have pending upstream updates (typically right after an
  upgrade), the summary also reports the count and suggests `tbd docs update` — but
  setup itself never modifies files in the eject dir.

- **`tbd setup --interactive`** gains its first real prompt (the flag exists today but
  has no prompts — `setup.ts:1281`):

  ```
  How visible do you want tbd's bundled docs (guidelines/shortcuts/templates)?
    1. Hidden cache only (current default) — available via tbd CLI, not in git
    2. Eject relevant guidelines into docs/tbd/ — visible, git-tracked, forkable
    3. Eject everything into docs/tbd/
  ```

  Option 2 runs the `--relevant` flow and shows the detected packs for confirmation
  (including the eject dir, editable).

- **Agent-driven onboarding** is the more common path, so the same choice is offered
  conversationally: `welcome-user` and the skill docs instruct the agent to ask the user
  ("Do you want tbd’s guidelines visible in your repo?
  Which languages do you use?") and then run `tbd docs eject --pack=…` / `--all` itself.
  No new setup flags needed: `tbd docs` *is* the API.

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
   doc returns to unmodified `ejected` state, and a plain `tbd docs uneject` (no
   `--force` needed) completes the unfork.

The skill routing table gets matching rows, e.g.:

| User says | Agent runs |
| --- | --- |
| “What guidelines are there?” | `tbd docs list` |
| “Show me / let me browse the guidelines in this repo” | `tbd docs eject --relevant` (after confirming) |
| “I want to customize the Python guidelines” | `tbd docs eject python-rules` then edit |
| “Put all of tbd’s docs in my repo” | `tbd docs eject --all` |
| “Stop customizing X / go back to the default” | `tbd docs uneject X` (`--force` only after confirming) |
| “Update the guidelines to the latest” (or after `tbd setup` reports pending updates) | `tbd docs update`; if conflicts are listed, ask the user, then `--merge` (combine + resolve) or `--rebase` (keep ours) |
| “Could we contribute these improvements back?” | `tbd shortcut suggest-upstream-improvements` |

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN (internal modules;
  the `DocCache`/`DocSync` extensions may refactor freely).
- **Library APIs**: N/A (nothing exported).
- **CLI surface**: two deliberate 0.x changes.
  (1) Bare `tbd docs` is repurposed from manual viewer to status overview; the manual
  stays reachable as `tbd docs show tbd-docs` / `tbd docs manual` (DO NOT MAINTAIN the
  old bare behavior — confirmed; update all routing docs in the same release).
  (2) `tbd sync --docs` becomes a deprecated alias of `tbd docs sync` (KEEP DEPRECATED
  until the next format cut).
  `tbd readme` / `tbd design` / per-kind readers unchanged.
- **Server APIs**: N/A.
- **File formats**: MIGRATE. `tbd_format` bumps f04 → f05 (new committed layout
  artifacts: `docs_cache.eject_dir`, `.tbd/ejected.yml`, `.tbd/eject-base/`) via the
  existing one-shot migration chain — metadata-only, no file moves (see “Format bump:
  f05”). Older CLIs detect the newer format id and prompt to upgrade, per the
  established format-compatibility policy.
- **Database schemas**: N/A.

The default behavior of every existing command is unchanged when nothing has been
ejected.

## Alternatives Considered

1. **Stop gitignoring `.tbd/docs/` (commit the cache).** One-line change, full
   visibility — but every tbd upgrade churns dozens of files in user repos, generated
   and authored content become indistinguishable, and there are no fork/uneject
   semantics. Rejected.
2. **Finish the PR #117 f05 framework first.** Right long-term shape, but blocked on
   five open architecture questions and a format migration; delivers user value months
   later. Rejected as the *first* step; this spec is its forward-compatible kernel.
3. **Symlinks from `docs/` into `.tbd/docs/`.** Not portable (Windows), breaks on GitHub
   rendering, and git-tracking symlinked generated content is worse than either mode.
   Rejected.
4. **Frontmatter provenance stamps instead of a manifest.** Self-contained files, but
   eject would modify content on copy (breaking clean diffs against upstream) and
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
   `--rebase`, plus a separate `tbd uneject`). The original draft of this spec.
   Rejected: flags-as-verbs is unintuitive, burns two top-level command slots, and a doc
   named `update` would be ambiguous with the verb.
   The noun-scoped `tbd docs` group matches existing tbd conventions
   (`dep`/`label`/`attic`/`config`) and gives sync/show/list a coherent home.

## Resolved Decisions

Settled during design review (2026-06-11):

1. **One noun-scoped command group, `tbd docs <verb>`**, replaces the earlier top-level
   `tbd eject`/`tbd uneject` + verb-flags design (see Alternatives #7). Scope split:
   `tbd sync` = project data; `tbd docs` = the doc layer.
2. **Verb pair is `eject`/`uneject`** (not `fork`/`unfork`).
3. **`tbd docs sync` absorbs `tbd sync --docs`** (old flag kept as a deprecated alias).
4. **tbd self-docs use a reserved `tbd-` name prefix** as regular docs in the system
   (kind `reference`), rather than a `tbd docs self` subcommand or dedicated viewers;
   bare `tbd docs` becomes the status overview and the manual is
   `tbd docs show tbd-docs` (alias `tbd docs manual`). No backward compatibility for the
   old self-doc viewer behavior.
5. **Update semantics**: clean three-way merges apply by default (tracked files make git
   the undo); non-clean updates require an explicit strategy — `--merge` (combine with
   conflict markers) or `--rebase` (keep local content, advance the fork point) — and
   tracked files are mutated only by explicit `tbd docs` verbs, never by setup or
   background sync. The earlier standalone `rebase` subcommand is folded into
   `update --rebase`.
6. **Default eject dir is `docs/tbd/`**, surfaced as an editable customization during
   setup and persisted to `docs_cache.eject_dir` when changed.
7. **Generated README index ships in v1**: explains what the docs are, lists them, and
   points to `npx get-tbd@latest docs` for further info.
8. **Base copies live in `.tbd/eject-base/`.**
9. **Format bump to f05** with a metadata-only f04→f05 migration, following the f04
   precedent: gitignore template refresh, format-history and layout-doc updates; older
   CLIs prompt to upgrade on encountering f05.
10. **docref adopted now; docmap adopted read-side only.** The docref grammar is the
    universal source-address syntax (parser ported from the #117 branch); docmap’s
    generated-map schema becomes the `--json` output contract, while its
    manifest/lockfile/sync write side stays in the f06+ framework.
    Both format docs ship as bundled `reference` docs with status banners.

## Open Questions

1. **Should `eject --relevant` ever become the fresh-setup default?** Recommended: no
   for now — current behavior stays default per the explicit product call; revisit with
   usage feedback.
2. **Pack definitions in code vs doc frontmatter tags**: code const now (recommended);
   migrate to frontmatter `tags:` if packs grow or third-party doc sources arrive.

## Implementation Plan

Phases are ordered so each lands independently shippable.
Each numbered item is intended to be one bead.

### Phase 1: Format bump and eject kernel

1. **f05 format bump**: `CURRENT_FORMAT = 'f05'`, f04→f05 step in `migrateToLatest()`
   (metadata-only: stamp + `.tbd/.gitignore` template refresh), format-history and
   layout-doc updates (`tbd-design.md`, `development.md`), older-CLI
   newer-format-detection behavior verified with a test.
2. **docref module port** (`src/docref/`): bring the parser, types, and spec-mirror
   tests over from the #117 branch (standalone, already fully covered); wire docref
   normalization into config source strings and URL handling.
3. **Manifest + base module** (`src/file/eject-manifest.ts`): zod schema, read/write of
   `.tbd/ejected.yml`, base copies under `.tbd/eject-base/`, LF-normalized SHA-256
   hashing, state computation
   (`ejected`/`customized`/`stale`/`conflicted`/`missing`/`orphaned`/`local`) given
   manifest + eject dir + base dir + cache.
   Pure functions; full unit coverage including the state matrix.
4. **`tbd docs` group scaffolding + `eject` subcommand** (rework
   `src/cli/commands/docs.ts` into the group; old manual-viewer behavior relocates per
   item 18): name resolution via `DocCache` (reusing fuzzy-match + suggestions),
   `--kind`, multiple names, `--all`, `--dry-run`, `--json`, overwrite refusal +
   `--force`, re-eject semantics, README index generation (with the
   `npx get-tbd@latest docs` pointer), `docs_cache.eject_dir` support.
   `tbd docs sync` subcommand delegating to `syncDocsWithDefaults()` (`tbd sync --docs`
   kept as deprecated alias).
5. **`tbd docs uneject` subcommand**: single/multi/`--all`, customized refusal +
   `--force`, base-file and missing-entry cleanup, README regeneration.
6. **Precedence wiring**: prepend eject-dir paths in guidelines/shortcut/template
   lookups (unifying guidelines/templates onto config-driven paths), provenance line on
   serve, `[ejected]`/`[customized]`/`[local]` markers in `--list`.
7. **E2E tests** (pattern of `doc-add-e2e.test.ts`): eject → list marker → serve shows
   ejected content → edit → uneject refuses → `--force` succeeds → bundled serving
   restored; `tbd setup --auto` refresh leaves ejected files untouched; f04 repo
   migrates to f05 on setup.

### Phase 2: Status, browse, diff, doctor

8. **`tbd docs status` (+ bare `tbd docs`)** with `--json` per the docmap map schema;
   one-line summary in `tbd status`.
9. **`tbd docs list` and `tbd docs show <name>`**: cross-kind listing with state markers
   (`--json` per the docmap map schema); kind-agnostic read (per-kind readers
   unchanged).
10. **`docs_cache.local_dirs` + `tbd docs add <docref>`**: local-dirs wiring into the
    effective lookup order; `add` consolidating the per-kind `--add` flags (kept as
    aliases) with docref normalization replacing the ad-hoc blob-URL conversion in
    `doc-add.ts`.
11. **`tbd docs diff <name>`** with `--base` / `--upstream` variants
    (`git diff --no-index` style output against base and cache copies, no network).
12. **`tbd doctor` checks**: missing/orphaned entries, base missing/corrupt, unresolved
    conflicts, reserved `tbd-` names, gitignored eject dir warning, `--fix` for manifest
    cleanup.

### Phase 3: Update and merge

13. **Merge module** (`src/file/eject-update.ts`): `git merge-file` wrapper (labels,
    exit-code handling, dry-run via `-p`), the per-state decision logic from the update
    table, base advancement, `conflicted` flag set/auto-clear.
    Unit tests cover every row × strategy of the table.
14. **`tbd docs update` command surface** with mutually exclusive `--merge` / `--rebase`
    strategy flags: name filtering, `--dry-run` preview with conflict listing, the
    skip-warning naming both strategies, summary counts; pending-update reporting wired
    into `tbd setup --auto` output and `tbd status`.

### Phase 4: Setup and packs

15. **Packs + detection** (`src/file/doc-packs.ts`): pack map, `--pack`, `--relevant`,
    detection function with unit tests.
16. **Setup integration**: hint line in `--auto` summary; the visibility prompt in
    `--interactive` wired to the eject flows, with the eject dir shown as an editable
    customization persisted to config.

### Phase 5: Docs and agent surface

17. **Playbook shortcut** `suggest-upstream-improvements.md` (follows `new-guideline.md`
    conventions; references `tbd docs status --json` and `tbd docs diff`).
18. **Self-docs and format-docs migration**: add kind `reference` (dir `references/`),
    register `tbd-docs` and `tbd-design` in the cache under their existing `tbd-` names,
    bundle `docref-format` and `docmap-format` (adapted from the #117 branch with status
    banners) as reference docs, retire the bare-`tbd docs` manual viewer in favor of
    `tbd docs show tbd-docs` + the `tbd docs manual` alias (`tbd readme`/`tbd design`
    untouched).
19. **Agent docs**: routing rows + eject/update section in `tbd-docs.md`, skill header
    (`install/claude-header.md`), `welcome-user` onboarding question, README section
    ("Forkable guidelines: eject them into your repo"), `tbd prime` mention if
    warranted.
20. **CHANGELOG + release notes** per `release-notes-guidelines`.

## Testing Strategy

- **Unit (vitest)**: manifest round-trip; hash normalization (CRLF/LF); the full state
  matrix as a table-driven test (base hash × file hash × cache hash × conflicted flag →
  state); the update decision table row by row and per strategy (replace, clean
  three-way, conflict skip, `--merge` markers + base advance, `--rebase` keep-file +
  base advance, strategy-flag mutual exclusion, conflicted-pending skip, missing-base
  repair via `--rebase`, orphaned); marker auto-clear; f04→f05 migration; the ported
  docref spec-mirror tests; local_dirs precedence ordering; `--json` output validating
  against the docmap map schema; pack detection; eject path mapping (incl.
  shortcuts flattening); README index generation.
- **E2E (spawn against built CLI, like `doc-add-e2e.test.ts`)**: the Phase 1 scenario
  above; precedence (ejected shadows bundled; local file with no entry is served); an
  upgrade simulation (eject → customize → mutate the cache copy to simulate a new
  bundled version → `update` cleanly merges non-overlapping edits, then a conflicting
  edit is listed and only merged with `--merge`, resolving markers returns the doc to
  `customized`); convergence-unfork (upstream adopts the customization → `update` →
  plain `uneject` succeeds); group surface (bare `tbd docs` shows status,
  `tbd docs show tbd-docs` serves the manual, `tbd sync --docs` alias still works);
  `eject --relevant` in a fixture repo with `pyproject.toml`; collision/overwrite
  refusal; doctor findings.
- **Docs-reference test**: extend `doc-references.test.ts` so every command named in the
  new shortcut/docs resolves.

## Relationship to PR #117

This spec deliberately implements the smallest forward-compatible slice of that redesign
(note: #117’s draft used “f05” as its format id; this spec’s layout bump now claims f05,
so the full framework would land as f06+):

| #117 concept | Here | Future-proofing |
| --- | --- | --- |
| W8 eject / G4 local override | `tbd docs eject` + shadowing | eject dir becomes a `local` source in the source framework |
| G10 provenance / review pt. 4 “recorded override edge” | `.tbd/ejected.yml` manifest | manifest entries become the framework’s override edges; fields chosen to match (source, hash, version) |
| W9 diff / G6 status | `tbd docs diff`/`status`, doctor | states map onto the framework’s status vocabulary |
| W10/W11 upstream roundtrip + unfork | playbook shortcut + convergence via `update` + `uneject` | can later be automated as `tbd docs upstream` |
| W5 sync vs. update separation; review pt. “record enough for three-way later” | cache refresh stays passive (`tbd docs sync`); `tbd docs update` is the explicit advance, with stored bases enabling three-way merge now | maps onto the framework’s `sync`/`source update` contract |
| G2 local project docs | `local` files in eject dir + `docs_cache.local_dirs` | becomes a first-class local source |
| docref format (design-docref-format.md) | **adopted wholesale**: parser ported, universal source-address grammar, shipped as a reference doc | the framework inherits addresses with no migration |
| docmap format (design-docmap-format.md) | **read side adopted**: generated-map schema as the `--json` contract; shipped as a reference doc (draft banner) | manifest/lockfile/sync (write side) is the f06 framework itself |
| Source framework, lockfiles, DocGraph split, doc types as data | **not built** | unchanged decision space; nothing here constrains Q15–Q19 |

Recommendation: keep PR #117 open as the long-horizon design reference (or convert its
spec to `specs/future/`), and note there that the eject kernel shipped separately.

## References

- `docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md` (PR #117 branch
  `claude/review-config-format-2wxh8`) — the full framework design and its review
  thread.
- `packages/tbd/docs/design-docref-format.md` and
  `packages/tbd/docs/design-docmap-format.md` (same #117 branch) — the docref grammar
  and docmap format drafts adopted (fully / read-side) by this spec, along with the
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
