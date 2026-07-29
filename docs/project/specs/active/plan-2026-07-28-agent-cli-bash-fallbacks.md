---
title: "Agent CLI Ergonomics Round 2: Remaining Bash Fallbacks"
description: Audit of every place agents still fall back to bash (loops, head/grep/jq pipes) instead of a native tbd call, and a plan to close the gaps — bulk show, variadic doc readers, variadic deps, and recoverable errors
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Agent CLI Ergonomics Round 2 (Remaining Bash Fallbacks)

**Date:** 2026-07-28

**Author:** Agent (with user direction)

**Status:** Implemented (both phases; see PR)

## Overview

[plan-2026-06-13-agent-cli-ergonomics.md](plan-2026-06-13-agent-cli-ergonomics.md)
(Phase 1, PR #176) made `close`/`reopen`/`update` variadic and fixed the output
contract, and the anti-loop guidance for those verbs is now in the skill, manual, and
`tbd prime`. Field transcripts show it worked for mutations — and show exactly where
agents still drop into bash: **reads and doc loads**. This spec is a systematic audit of
the remaining places where the obvious agent intent has no single tbd call (or has one
that our docs never mention), plus a plan to close them.
The theme: every time an agent writes a `for` loop, a `| head`, a `| grep`, or a `| jq`
around tbd, either a CLI affordance is missing or a doc failed to advertise one that
exists.

### Motivating example (observed 2026-07-27, verbatim agent behavior)

```bash
# Agent wants status of 5 tracking beads; tries the obvious thing:
tbd show fin-nt0k fin-6pu9 fin-cohp fin-lb4r fin-jpkq 2>&1 | head -150
# error: too many arguments for 'show'. Expected 1 argument but got 5.

# Falls back to answering "where do things stand?" with git instead of tbd:
git log --oneline -15 --all --since="2026-07-27" -- docs/project/specs/active/plan-....md

# Then hand-rolls the bulk read tbd refused to do:
for b in fin-nt0k fin-6pu9 fin-cohp fin-lb4r fin-jpkq fin-1bz5; do
  echo "=== $b ==="; tbd show $b 2>&1 | head -40; echo; done
```

Every line maps to a gap cataloged below: bulk `show` (deferred out of PR #176 as
tbd-r2zr and still open), per-issue output caps and delimiters (`--max-lines` exists but
is advertised nowhere agents look), and “where do things stand on this spec?”
(`tbd list --spec <path>` answers it directly; no agent-facing doc mentions it).

## Goals

- **Eliminate the read-side shell loop.** `tbd show A B C …` works, with a per-issue
  delimiter, `--json` array, and the same missing-ID contract as the bulk mutators.
- **Eliminate the doc-load loop.** Loading the General-engineering guideline group is
  one call, not nine; `guidelines`/`shortcut`/`template`/`docs show` all accept multiple
  names.
- **Make dependency wiring proportional to intent.** One call to declare “this bead is
  blocked by these N”, and dependencies expressible at `create` time so a spec breakdown
  stops costing ~2N+1 invocations.
- **Make errors recover the agent instead of stranding it.** Unknown-ID errors suggest
  near-miss IDs and `tbd search`; `search` matches issue IDs; argument-overflow errors
  on single-target commands point at the right form.
- **Advertise what already exists at the point of need.** The skill tables and manual
  teach `--max-lines`, `list --spec/--limit/--count/--sort`, bulk labeling via
  `update --add-label`, and extend the NEVER-loop rule to reads and doc loads.
- **Purge bash recipes from our own docs** (`| grep` for ID lookup, `| jq` for spec
  tables) once native equivalents exist.

## Non-Goals

- Query-driven mutation (`--where`), the `tbd apply` transaction file, and delivery
  provenance (`--by-pr`) — Phase 2 of the prior spec, still tracked as tbd-ja4e,
  tbd-t9em, tbd-71oi. Nothing here blocks on them; `apply` remains the real answer for
  batch *creation* of distinct issues.
- Changing the mutator contracts shipped in PR #176, the output/quiet/JSON contract, or
  the sync model.
- Auto-resolving ID *prefixes* as targets of writes (`tbd close fin-nt`): guessing a
  mutation target is a footgun; see Open Questions for the read-only variant.
- Wrapping git/gh. The `git log --since -- spec.md` fallback above is fixed by
  advertising `tbd list --spec`, not by tbd growing git features.

## Background: The Audit

Four findings, each with evidence.
Command-signature inventory is from `packages/tbd/src/cli/commands/*.ts`; behavior
verified against the CLI at HEAD (v0.4.0 source).

### A. Single-target commands where agent intent is plural

| Command | Signature today | Plural intent it defeats |
| --- | --- | --- |
| `show <id>` ([show.ts:194](../../../../packages/tbd/src/cli/commands/show.ts)) | one ID | “status of these 5 tracking beads” — the observed loop; deferred out of PR #176 as bead tbd-r2zr, still open at P3 |
| `guidelines [query]` ([guidelines.ts:131](../../../../packages/tbd/src/cli/commands/guidelines.ts)), `shortcut [query]` ([shortcut.ts:378](../../../../packages/tbd/src/cli/commands/shortcut.ts)), `template [query]` ([template.ts:57](../../../../packages/tbd/src/cli/commands/template.ts)), `docs show <name>` ([docs.ts:440](../../../../packages/tbd/src/cli/commands/docs.ts)) | one name per call | the skill itself instructs loading the **General engineering group — nine guidelines — before any engineering work** ([skill-baseline.md:100-104](../../../../packages/tbd/docs/shortcuts/system/skill-baseline.md)); `implement-beads` says “review relevant ones” plural. Nine sequential invocations is the *instructed* behavior |
| `dep add <issue> <depends-on>` ([dep.ts:247-263](../../../../packages/tbd/src/cli/commands/dep.ts)) | one edge per call | “this bead is blocked by these three”; `plan-implementation-with-beads` step 3 generates one call per edge, so an N-step spec breakdown costs ~2N+1 tbd invocations (1 epic + N `create` + ~N `dep add`) |
| `label add/remove <id> <labels...>` ([label.ts:200-210](../../../../packages/tbd/src/cli/commands/label.ts)) | variadic on labels, single on issues | “label these five beads” — the bulk path **already exists** as `update A B C --add-label x` ([update.ts:243-261](../../../../packages/tbd/src/cli/commands/update.ts)) but no agent-facing doc says so |
| `create [title]` ([create.ts:206](../../../../packages/tbd/src/cli/commands/create.ts)) | one bead per call | inherent (each bead has its own title/body) — but the follow-up `dep add` calls are not: `create` has `--parent` yet no `--depends-on`, so sequenced beads always need a second wave of calls |

Variadic arguments are already idiomatic in this codebase
(`close`/`reopen`/`update <ids...>`, `label <labels...>`,
`docs fork/unfork/update [names...]`) — the remaining single-target commands are
inconsistent, not deliberately blocked.

### B. Read-side affordances that exist but are advertised nowhere agents look

The agent in the motivating example piped to `head -40` and `head -150`.
`tbd show --max-lines <n>` has existed since
[plan-2026-02-13-show-parent-context-and-max-lines.md](../done/plan-2026-02-13-show-parent-context-and-max-lines.md);
`list`/`search`/`ready`/`blocked`/`stale` all take `--limit`, and `list` also has
`--count`, `--sort updated`, `--spec <path>` (path/suffix/filename match), `--specs`
grouping, and `--pretty`
([list.ts:285-306](../../../../packages/tbd/src/cli/commands/list.ts)).

None of these appear in the skill command tables
([skill-baseline.md:134-190](../../../../packages/tbd/docs/shortcuts/system/skill-baseline.md))
— the one doc every agent has in context.
The “Show me issue X” row teaches `tbd show <id>` singular; there is no “where do things
stand on spec X” row at all, which is why the observed agent reached for
`git log --since -- <spec>.md` instead of `tbd list --spec`.

### C. Errors strand the agent instead of redirecting it

Verified behaviors at HEAD:

- `tbd show A B` →
  `error: too many arguments for 'show'. Expected 1 argument but got 2.` The only global
  courtesy is `showHelpAfterError`
  ([cli.ts:60](../../../../packages/tbd/src/cli/cli.ts)). Nothing points at a better
  next call, so the agent’s cheapest next move is a bash loop — which is exactly what
  the transcript shows.
- `tbd show tbd-zzzz` → `Error: Issue not found: tbd-zzzz`. No near-miss suggestion, no
  pointer to `tbd search`/`tbd list`.
- `tbd search <id>` does **not** match issue IDs — searching an ID returns only issues
  whose *text* mentions it (`--field` covers title/description/notes/labels;
  [search.ts:200-205](../../../../packages/tbd/src/cli/commands/search.ts)). There is no
  CLI-native partial-ID lookup at all, which is why the manual’s own recovery recipe for
  “Unknown issue ID” is a grep pipeline (finding D).

### D. Our own docs teach the bash workaround

- [tbd-docs.md:1273-1280](../../../../packages/tbd/docs/tbd-docs.md): the “ID Not Found”
  troubleshooting recipe is `tbd list --all | grep <partial-id>`.
- [update-specs-status.md:89-91](../../../../packages/tbd/docs/shortcuts/standard/update-specs-status.md):
  instructs
  `tbd list --json | jq -r '.[] | [.id, .status, .title, (.spec_path // "")] | @tsv'` —
  `list --specs` (grouped-by-spec view) and plain `--json` cover this without jq.
- The NEVER-loop rule
  ([skill-baseline.md:153-157](../../../../packages/tbd/docs/shortcuts/system/skill-baseline.md),
  [tbd-prime.md:67](../../../../packages/tbd/docs/tbd-prime.md),
  [tbd-docs.md:953](../../../../packages/tbd/docs/tbd-docs.md)) — correctly added for
  the mutators in round 1 — is scoped to `close`/`reopen`/`update` only, so it does not
  cover the loops agents actually still write (reads and doc loads), and cannot until
  those verbs go variadic.

### E. `--spec` write/read asymmetry (hit while dogfooding this very spec)

`tbd list --spec <path>` matches “full path, partial path suffix, or filename”
([list.ts:296-298](../../../../packages/tbd/src/cli/commands/list.ts)), and the
`new-plan-spec` shortcut explicitly advertises the filename-only form for `create` and
`update` ("Or use just the filename for brevity:
`tbd create … --spec plan-YYYY-MM-DD-feature-name.md`"). But the write side
(`create --spec`, `update --spec`) validates the argument as a literal repo-relative
path ([project-paths.ts:181-198](../../../../packages/tbd/src/lib/project-paths.ts)) —
the filename form fails with `Error: File not found: plan-….md` even though the file
exists in `docs/project/specs/active/`. Wiring this spec’s own beads hit it on the first
try. The agent-shaped failure mode is a `find`/`ls` detour (or a silent retype) on every
bead-to-spec link. Fix: write-side `--spec` resolves unique basename/suffix matches
against the spec directories exactly like `list --spec` does, erroring on ambiguity with
the candidate list.

## Design

### Approach

Two phases, both additive (no breaking changes this round).
Phase 1 ships the two field-observed loop-killers (bulk `show`, variadic doc readers)
plus one point-of-need documentation pass covering both the new forms and the
existing-but-invisible affordances from finding B. Phase 2 ships the write-side
conveniences (variadic deps, `create --depends-on`) and the error-recovery work, then
purges the bash recipes from finding D.

Contracts mirror the bulk mutators wherever they apply, so agents learn one rule:
**every tbd verb takes multiple targets, validates all targets first, fails closed on
unknown IDs, and downgrades to skips with `--ignore-missing`.**

### Phase 1 components

**Bulk `show <ids...>`** (implements tbd-r2zr; `show.ts`, reusing the extracted
`renderIssueLines`/`printWithTruncation`):

- Read-only: no write lock, no summary line, no sync hint.
- Validate-all-then-render: resolve every ID first; any unknown aborts with the full
  list of bad IDs (fail-closed, matching mutators); `--ignore-missing` renders the found
  subset, reports the skips on stderr, and exits 0 — the same contract the flag has on
  the bulk mutators, so agents learn one rule.
- Render in argument order, duplicates deduped (first occurrence wins).
- Delimiter: each issue preceded by a one-line dim header (exact format fixed by the
  golden; something like `── tbd-r2zr ──`) so `echo "=== $b ==="` dies.
- `--max-lines <n>` applies **per issue**, not to the whole stream.
- Parent context (auto-display of `parent_id`): single-ID behavior unchanged; suppressed
  by default in multi-ID mode (siblings would repeat the same parent N times).
  `--show-order` keeps working per issue.
- `--json`: single ID keeps today’s object shape (backward compatible); 2+ IDs emit an
  array. Documented explicitly.

**Variadic doc readers** (`guidelines [queries...]`, `shortcut [queries...]`,
`template [queries...]`, `docs show <names...>`; shared change in `DocCommandHandler`):

- Each query resolves exact-then-fuzzy as today; resolution of **all** names happens
  before any content prints (fail-closed, so a typo can’t half-load a guideline group).
- Output: the agent-instructions preamble once, then each doc under its existing header,
  in argument order.
- The skill’s group-loading instruction becomes one call:
  `tbd guidelines general-coding-rules general-comment-rules … error-handling-rules`.

**Documentation pass (point of need):** see Rollout for the file list.
Headline edits: skill “Show me issue X” row becomes `tbd show <id1> [<id2> …]`; new rows
for “Where do things stand on spec X?” → `tbd list --spec <path>` and “label several
beads” → `tbd update A B C --add-label x`; Finding-Work table gains
`--limit`/`--count`/`--sort updated`/`--max-lines`; the NEVER-loop rule is generalized
to “if you are about to loop or pipe around tbd, the bulk/filter form exists — check
`--help` first” with `show` and `guidelines` named explicitly.

### Phase 2 components

**Variadic dependencies:** `dep add <issue> <depends-on...>` and
`dep remove <issue> <depends-on...>` — one issue gains/loses N blockers in one locked
write (dependencies live on the issue file, so this is one read-modify-write).
Chain-shaped breakdowns still cost one call per edge; acceptable once
`create --depends-on` exists (below), and `apply` (tbd-t9em) remains the batch answer.

**`create --depends-on <id>` (repeatable):** declare blockers at creation.
`plan-implementation-with-beads` step 3 mostly disappears: each bead is created fully
wired in one call.

**Recoverable errors:**

- Unknown issue ID (`NotFoundError` in resolve paths): append near-miss display IDs
  (cheap edit-distance/prefix scan over the ID mapping table, top 3) and a
  `tbd search "<text>"` pointer.
- `tbd search` matches issue IDs: display ID becomes a searchable field, making
  partial-ID lookup native (`tbd search r2zr` finds tbd-r2zr, not just mentions).
- Argument-overflow hints: for the single-target commands that remain by design
  (`create`, `config set`, `attic restore`, …), a small static map appends one line to
  Commander’s “too many arguments” error naming the right form (e.g. `create` takes one
  title; to create several beads run one create per bead or see tbd apply).
  With `show`, the doc readers, and `dep` variadic, this class of error mostly
  disappears; the map is polish for what’s left.

**Doc purge:** replace the `| grep` ID-lookup recipe with the did-you-mean/search flow.
(The `| jq` spec-table recipe moves to the Phase 1 doc pass instead — `list --specs` and
`--json` already exist, so that replacement needs no new code.)

## Implementation Plan

### Phase 1: Kill the observed loops (bulk show, variadic doc readers, docs)

- [x] `show <ids...>`: validation contract, dedupe, delimiter, per-issue `--max-lines`,
  bulk parent suppression, `--json` array for 2+ IDs.
  (tbd-r2zr, elevated to P1.)
- [x] `DocCommandHandler` variadic queries for `guidelines`/`shortcut`/`template` +
  `docs show <names...>`; fail-closed resolution; preamble-once output.
- [x] Point-of-need doc pass: skill-baseline/brief/minimal tables, `tbd-prime.md`,
  `tbd-docs.md` command reference, `tbd-design.md` §4.4 Show; generalized NEVER-loop
  rule; advertise `--max-lines`, `list --spec/--limit/--count/--sort`, bulk label via
  `update`; replace the `update-specs-status.md` jq pipeline with
  `list --specs`/`--json` (no code dependency).

### Phase 2: Write-side convenience and recoverable errors

- [x] `dep add`/`dep remove` variadic `<depends-on...>`.
- [x] `create --depends-on <id>` (repeatable); update `plan-implementation-with-beads`
  to use it.
- [x] `create`/`update` `--spec` accepts unique basename/suffix (same matcher as
  `list --spec`; ambiguity errors with candidates), making the form the `new-plan-spec`
  shortcut already documents actually work (finding E).
- [x] Did-you-mean on unknown IDs; ID-matching in `search`; overflow-hint map for
  remaining single-target commands.
- [x] Purge the `tbd-docs.md` grep ID-lookup recipe (depends on the did-you-mean and
  search work above).

## Testing Strategy

- **tryscript goldens** (`.tryscript.md` harness), mirroring the bulk-mutator goldens:
  multi-ID `show` (order, duplicate IDs, unknown-ID abort listing all bad IDs,
  `--ignore-missing` reporting skips on stderr with exit 0, `--json` array vs single-ID
  object, per-issue `--max-lines`, parent suppression in bulk vs auto-display single);
  variadic `guidelines`/`template` (two names, order, one bad name fails closed);
  `dep add` with 3 blockers then `dep list`; `create --depends-on` twice then `blocked`;
  unknown-ID did-you-mean output; `search` by partial display ID; overflow hint for
  `create`.
- **vitest** for the near-miss suggester (ranking, threshold — no suggestion is better
  than a wrong one) and the doc-reader multi-resolution (fail-closed set semantics).
- **Backward compatibility:** every existing single-ID/single-name golden stays green
  untouched; single-ID `--json` object shape is pinned by a golden.

## Rollout Plan

- Both phases are additive; each ships in a normal minor release with CHANGELOG entries.
- Docs updated in the same PR as the behavior they describe: skill variants
  (`skill-baseline.md`, `skill-brief.md`, `skill-minimal.md` — regenerated via
  `tbd setup --auto`), `tbd-prime.md`, `tbd-docs.md`, `tbd-design.md`, and the two
  shortcuts (`plan-implementation-with-beads.md`, `update-specs-status.md`).
- Existing beads updated rather than duplicated: tbd-r2zr (bulk show) is re-linked to
  this spec and raised to P1; tbd-ja4e/tbd-t9em/tbd-71oi stay on the prior spec.

## Open Questions

**Deferred (decided 2026-07-28):** everything below is noted for future consideration
only — none of it is in scope for Phase 1 or Phase 2, and no beads are filed for these
items. The one exception is the delimiter format, which is an implementation detail
settled by the bulk-show golden, not new scope.

- **Bulk `--parent`/`--spec` on `update`?** Re-linking N beads to a spec or reparenting
  N beads is a real bulk intent (this spec’s own bead wiring hits it), but PR #176
  deliberately limited bulk update to fields without structural side effects (parent
  changes touch `child_order_hints`). Revisit once the hint-maintenance path is factored
  to be callable per-item inside the bulk driver (tbd-1asx).
- **Read-only ID-prefix resolution?** `tbd show fin-nt` resolving an unambiguous prefix
  would be convenient and safe-ish for reads, but two resolution semantics (reads guess,
  writes don’t) may cost more confusion than it saves.
  Default answer: no — did-you-mean plus `search` covers the need.
- **`guidelines --category <cat>` printing content** (group loader) instead of being
  list-only: variadic names already collapse the loop; is the category form worth a
  second way to do it?
- **Delimiter format for bulk show:** ~~plain dim rule vs `--- id: … ---` YAML-ish
  header.~~ **Settled at golden time: a dim `── <id> ──` rule** (matches the tree-view
  box-drawing style; stable and grep-able).

## References

- Prior round:
  [plan-2026-06-13-agent-cli-ergonomics.md](plan-2026-06-13-agent-cli-ergonomics.md)
  (Phase 1 shipped in PR #176; bulk `show` deferred there, delivered here).
- Show rendering groundwork:
  [plan-2026-02-13-show-parent-context-and-max-lines.md](../done/plan-2026-02-13-show-parent-context-and-max-lines.md).
- Related guideline-side plan:
  [plan-2026-06-03-tbd-agent-cli-guideline-improvements.md](../done/plan-2026-06-03-tbd-agent-cli-guideline-improvements.md).
- Beads: tbd-6h1r (prior epic), tbd-r2zr (bulk show), tbd-1asx (shared bulk driver),
  tbd-ja4e / tbd-t9em / tbd-71oi (prior Phase 2, out of scope here).
- Evidence: agent transcript of 2026-07-27 (user-supplied, quoted in Overview); code and
  doc citations inline.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
