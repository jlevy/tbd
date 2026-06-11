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

This spec proposes the **minimal kernel** of that vision, implementable now on the
current f04 format with no schema break:

1. **`tbd eject`** — copy any bundled doc (or all of them, or a language-relevant pack)
   into a visible, git-tracked folder in the repo (default `docs/tbd/`). Ejected docs
   shadow the bundled copies in all lookups, so customizing them Just Works.
2. **`tbd uneject`** — remove an ejected copy and fall back to the bundled version,
   refusing to discard customizations unless `--force` is given.
3. **A small committed manifest** (`.tbd/ejected.yml`) recording provenance (source +
   content hash at eject time), which makes “customized?”
   and “stale vs upstream?”
   cheap, exact questions.
4. **Setup opt-in** — `tbd setup --interactive` asks how visible docs should be (current
   hidden default, eject relevant packs, or eject everything); agents are taught to ask
   the same question during onboarding and run eject themselves.
5. **An upstream-contribution playbook** — a bundled shortcut that walks an agent
   through diffing customized docs against upstream and filing a GitHub issue on
   `jlevy/tbd` with the proposed improvements.
   Pure documentation, no new code.

This is the shadcn “copy and own” model: bundled docs are the registry, eject is the
copy step, git is the fork, and a GitHub issue is the upstream PR. Everything here is
forward-compatible with the larger #117 design (see
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

## Non-Goals

- **No config format break.** We stay on f04. Additions are one optional config key and
  one new committed file.
  The f05 redesign (PR #117) remains future work.
- **No external source framework.** No new git/URL/S3 source types, no lockfiles, no
  bundle registry. `--add` URL docs keep working as today.
- **No automated upstream PRs.** The upstream loop is a playbook the agent follows with
  user confirmation (filing an issue), not an automated `tbd upstream` command.
- **No three-way merge.** When upstream changes after a doc was customized, tbd reports
  it and can show diffs; merging is left to the user/agent.
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
framework. The kernel below delivers W7–W11’s user value with ~3 small modules and zero
format migration, and produces real usage data that will inform the bigger design if we
still want it.

## Design

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

- Default: `docs/tbd/`. Configurable via a new optional config key
  `docs_cache.eject_dir` (no format bump; old tbd versions ignore it).
- Layout is `<eject_dir>/<kind-dir>/<name>.md`. The bundled
  `shortcuts/system|standard|custom` subdivision is **flattened** to `shortcuts/` on
  eject — that split is an implementation detail; the manifest preserves the original
  source path for uneject and provenance.
- Files are copied **verbatim** (no frontmatter injection, no stamping).
  Provenance lives in the manifest, so ejected files stay clean, diffable, and forkable.
- A small `README.md` index is generated into the eject dir (and regenerated on every
  eject/uneject) listing each doc with its description from frontmatter and a note that
  the folder is managed by `tbd eject`. This makes the folder self-explanatory when
  browsed on GitHub.

### The eject manifest

`.tbd/ejected.yml` — committed (the existing `.tbd/.gitignore` only excludes specific
paths, so this is tracked automatically, like `config.yml`):

```yaml
# Managed by `tbd eject` / `tbd uneject`. Records provenance for ejected docs.
ejected:
  - name: python-rules
    kind: guideline
    path: docs/tbd/guidelines/python-rules.md   # repo-relative
    source: internal:guidelines/python-rules.md # or the URL for --add'ed docs
    tbd_version: 0.2.3                          # version at eject time
    ejected_hash: sha256:9f2c…                  # content hash at eject time
```

- `ejected_hash` is the SHA-256 of the LF-normalized file content at eject time.
  Normalizing line endings before hashing avoids false “customized” results from
  `core.autocrlf` on Windows.
- This manifest is the *recorded override edge* that the PR #117 design review called
  for (its point 4), in miniature.
  It lets us distinguish, exactly:
  - **customized**: current file hash ≠ `ejected_hash`
  - **stale**: current bundled/cache content hash ≠ `ejected_hash` (upstream moved since
    eject — independent of whether the user edited)
- Because the manifest is committed, collaborators who pull get identical resolution and
  status behavior.

### The cache stays complete

`tbd setup --auto` / `tbd sync --docs` continue to install **all** docs into
`.tbd/docs/`, including ones that are ejected.
The cache copy is the pristine reference: it is what `--diff` and staleness compare
against, and it is what serving falls back to after `uneject`. Setup never touches files
in the eject dir.

### Resolution precedence

Effective lookup order per kind, applied structurally (not by asking users to hand-edit
`lookup_path` — the PR #87 “lookup_path zombie” lesson):

```
<eject_dir>/<kind-dir>/        # ejected + hand-authored local docs (highest)
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

### Doc states

| State | Meaning | Detected by |
| --- | --- | --- |
| `bundled` | served from cache, not ejected | not in manifest |
| `ejected` | ejected, unmodified | file hash == `ejected_hash` |
| `customized` | ejected and edited locally | file hash ≠ `ejected_hash` |
| `stale` | upstream changed since eject (orthogonal to customized) | cache hash ≠ `ejected_hash` |
| `local` | file in eject dir with no manifest entry | file present, no entry |
| `missing` | manifest entry but file deleted | entry present, file absent |
| `orphaned` | manifest entry whose source no longer exists in the bundle | `internal:` source absent |

`customized` and `stale` can combine (`customized+stale`): the user edited *and*
upstream moved — exactly the case the upstream-contribution playbook cares about.

### CLI surface

```bash
# Eject
tbd eject python-rules                     # one doc (name resolution as in `tbd guidelines`)
tbd eject python-rules review-code         # several
tbd eject --kind=guideline typescript      # disambiguate if a name exists in two kinds
tbd eject --pack=python                    # curated pack (repeatable: --pack=python --pack=core)
tbd eject --relevant                       # packs chosen by repo detection (see below)
tbd eject --all                            # everything
tbd eject --dry-run --all                  # preview what would be written

# Inspect
tbd eject --status                         # table of all ejected docs + states (also: bare `tbd eject`)
tbd eject --status --json                  # machine-readable (drives the playbook)
tbd eject --diff python-rules              # ejected file vs pristine cache copy

# Reverse
tbd uneject python-rules                   # delete file + manifest entry; ERROR if customized
tbd uneject python-rules --force           # discard customizations deliberately
tbd uneject --all [--force]
```

Behavior details:

- **Eject refuses to overwrite.** If the target path exists and is not an unmodified
  ejected copy (e.g. a pre-existing user file), eject errors and lists the conflict;
  `--force` overwrites.
  Never silently clobber user content.
- **Re-ejecting a stale doc**: `tbd eject <name>` on an already-ejected, *unmodified*
  doc refreshes it to the current bundled content and updates `ejected_hash` (this is
  the “pull upstream updates” path).
  If customized, it errors and points at `--diff` / `--force`.
- **Uneject of a `missing` doc** cleans up the manifest entry (with a note).
- **URL-added (`--add`) docs are ejectable too** — the manifest `source` is the URL and
  staleness compares against the cache copy, which `tbd sync --docs` already refreshes.
  No special casing.
- All commands support `--json` and `--dry-run` per the existing CLI conventions.
- `tbd status` gains one summary line (e.g. `Docs: 4 ejected (1 customized, 1 stale)`)
  and `tbd doctor` gains checks: missing files, orphaned entries, eject dir covered by a
  `.gitignore` (defeats the purpose — warn), manifest/dir drift.

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
  `Docs are cached in .tbd/docs/ (gitignored). Run 'tbd eject' to copy guidelines into your repo as visible, forkable files.`

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
  Which languages do you use?") and then run `tbd eject --pack=… `/ `--all` itself.
  No new setup flags needed: `tbd eject` *is* the API.

### Upstream-contribution playbook

New bundled shortcut `shortcuts/standard/suggest-upstream-improvements.md` — pure
documentation, no code.
It instructs the agent to:

1. Run `tbd eject --status --json` and collect docs in `customized` (or
   `customized+stale`) state.
2. For each, run `tbd eject --diff <name>` and classify hunks: generally applicable
   improvements vs project-specific customizations.
3. Draft an issue body: which doc, why the change is generally useful, the relevant diff
   hunks in fenced blocks, and project context.
4. Show the draft to the user for confirmation, then file with
   `gh issue create -R jlevy/tbd` (the `gh` integration and `use_gh_cli` setting already
   exist).
5. Suggest the follow-up loop: once upstream ships the change, `tbd eject --diff` after
   upgrade shows convergence, and the user can `tbd uneject --force` to return to the
   bundled version ("unfork").

The skill routing table gets matching rows, e.g.:

| User says | Agent runs |
| --- | --- |
| “Show me / let me browse the guidelines in this repo” | `tbd eject --relevant` (after confirming) |
| “I want to customize the Python guidelines” | `tbd eject python-rules` then edit |
| “Put all of tbd’s docs in my repo” | `tbd eject --all` |
| “Stop customizing X / go back to the default” | `tbd uneject X` (`--force` only after confirming) |
| “Could we contribute these improvements back?” | `tbd shortcut suggest-upstream-improvements` |

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: DO NOT MAINTAIN (internal modules;
  the `DocCache`/`DocSync` extensions may refactor freely).
- **Library APIs**: N/A (nothing exported).
- **Server APIs**: N/A.
- **File formats**: SUPPORT BOTH, additively.
  No format bump: stays `f04`. `docs_cache.eject_dir` is a new optional key;
  `.tbd/ejected.yml` is a new standalone file.
  Older tbd versions ignore both and simply serve the bundled copies (a teammate on an
  old version won’t see the team’s customizations until they upgrade — accepted,
  documented degradation).
  Implementation must verify the config writer round-trips the new key (and unknown keys
  generally) rather than dropping it on rewrite.
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

## Open Questions

1. **Reverse-command naming**: `tbd uneject` (recommended — matches the user’s mental
   model and is greppable) vs `tbd eject --remove`. Could ship both with one as alias.
2. **Default eject dir**: `docs/tbd/` (recommended: short, clearly tbd-managed,
   GitHub-browsable) vs `docs/agent/` vs top-level `tbd-docs/`. Configurable either way.
3. **Generated README index in the eject dir**: include in v1 (recommended — it is the
   “browse on GitHub” payoff) or cut to keep eject strictly file-copying?
4. **Should `--relevant` eject ever become the fresh-setup default?** Recommended: no
   for now — current behavior stays default per the explicit product call; revisit with
   usage feedback.
5. **Pack definitions in code vs doc frontmatter tags**: code const now (recommended);
   migrate to frontmatter `tags:` if packs grow or third-party doc sources arrive.

## Implementation Plan

Phases are ordered so each lands independently shippable.
Each numbered item is intended to be one bead.

### Phase 1: Eject kernel

1. **Manifest module** (`src/file/eject-manifest.ts`): zod schema, read/write of
   `.tbd/ejected.yml`, LF-normalized SHA-256 hashing, state computation
   (`ejected`/`customized`/`stale`/`missing`/`orphaned`/`local`) given manifest + eject
   dir + cache. Pure functions; full unit coverage including the state matrix.
2. **`tbd eject` command** (`src/cli/commands/eject.ts`): name resolution via `DocCache`
   (reusing fuzzy-match + suggestions), `--kind`, multiple names, `--all`, `--dry-run`,
   `--json`, overwrite refusal + `--force`, re-eject semantics, README index generation,
   `docs_cache.eject_dir` support.
3. **`tbd uneject` command**: single/multi/`--all`, customized refusal + `--force`,
   missing-entry cleanup, README regeneration.
4. **Precedence wiring**: prepend eject-dir paths in guidelines/shortcut/template
   lookups (unifying guidelines/templates onto config-driven paths), provenance line on
   serve, `[ejected]`/`[customized]`/`[local]` markers in `--list`.
5. **E2E tests** (pattern of `doc-add-e2e.test.ts`): eject → list marker → serve shows
   ejected content → edit → uneject refuses → `--force` succeeds → bundled serving
   restored; `tbd setup --auto` refresh leaves ejected files untouched.

### Phase 2: Status, diff, doctor

6. **`tbd eject --status` (+ bare `tbd eject`)** with `--json`; one-line summary in
   `tbd status`.
7. **`tbd eject --diff <name>`** against the pristine cache copy (`git diff --no-index`
   style output, no network).
8. **`tbd doctor` checks**: missing/orphaned entries, gitignored eject dir warning,
   `--fix` for manifest cleanup.

### Phase 3: Setup and packs

9. **Packs + detection** (`src/file/doc-packs.ts`): pack map, `--pack`, `--relevant`,
   detection function with unit tests.
10. **Setup integration**: hint line in `--auto` summary; the visibility prompt in
    `--interactive` wired to the eject flows.

### Phase 4: Docs and agent surface

11. **Playbook shortcut** `suggest-upstream-improvements.md` (follows `new-guideline.md`
    conventions; references `--status --json` and `--diff`).
12. **Agent docs**: routing rows + eject section in `tbd-docs.md`, skill header
    (`install/claude-header.md`), `welcome-user` onboarding question, README section
    ("Forkable guidelines: eject them into your repo"), `tbd prime` mention if
    warranted.
13. **CHANGELOG + release notes** per `release-notes-guidelines`.

## Testing Strategy

- **Unit (vitest)**: manifest round-trip; hash normalization (CRLF/LF); the full state
  matrix as a table-driven test (manifest hash × file hash × cache hash → state); pack
  detection; eject path mapping (incl.
  shortcuts flattening); README index generation.
- **E2E (spawn against built CLI, like `doc-add-e2e.test.ts`)**: the Phase 1 scenario
  above; precedence (ejected shadows bundled; local file with no entry is served);
  `--relevant` in a fixture repo with `pyproject.toml`; collision/overwrite refusal;
  doctor findings.
- **Docs-reference test**: extend `doc-references.test.ts` so every command named in the
  new shortcut/docs resolves.

## Relationship to PR #117

This spec deliberately implements the smallest forward-compatible slice of the f05
design:

| #117 concept | Here | Future-proofing |
| --- | --- | --- |
| W8 eject / G4 local override | `tbd eject` + shadowing | eject dir becomes a `local` source in f05 |
| G10 provenance / review pt. 4 “recorded override edge” | `.tbd/ejected.yml` manifest | manifest entries become f05 override edges; fields chosen to match (source, hash, version) |
| W9 diff / G6 status | `--diff`, `--status`, doctor | states map onto f05 status vocabulary |
| W10/W11 upstream roundtrip + unfork | playbook shortcut + `uneject --force` | can later be automated as `tbd upstream` |
| G2 local project docs | `local` files in eject dir | becomes a first-class local source |
| Source framework, lockfiles, DocGraph/DocMap, doc types as data | **not built** | unchanged decision space; nothing here constrains Q15–Q19 |

Recommendation: keep PR #117 open as the long-horizon design reference (or convert its
spec to `specs/future/`), and note there that the eject kernel shipped separately.

## References

- `docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md` (PR #117 branch
  `claude/review-config-format-2wxh8`) — the full framework design and its review
  thread.
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
