---
title: Update Specs Status
description: Reconcile active specs, the top-level work index (e.g. TODO.md), and tbd beads into one current status map
category: planning
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Reconcile the project tracking surfaces so future agents can see the same current status
from the top-level work index, the plan specs, and tbd beads.

## Sources of Truth

- **tbd beads:** Current status and dependencies.
- **Active plan specs:** Governing plan and implementation checklist for each active
  workstream.
- **Top-level work index, if the project keeps one (e.g. `TODO.md`):** Brief index
  linking each active workstream to its governing spec and beads.
  The steps below say `TODO.md`; substitute the project’s own index (and skip its steps
  if there is none).

## Process

1. **Load the current project state.**
   - Run `tbd prime`.
   - Load `tbd guidelines common-doc-guidelines`.
   - Read `TODO.md`, `docs/project/specs/active/*.md`, and the relevant open or
     in-progress beads from `tbd list --json`.
   - Include `docs/project/specs/future/*.md`, `docs/project/specs/done/*.md`, or
     `docs/project/reviews/*.md` only when the current work moved, completed, deferred,
     or originated from those documents.

2. **Triage mechanically before reading anything.**

   In a large repository the epic list is too long to eyeball, and reading them in ID
   order wastes the pass on epics that need no decision.
   Compute three signals for every open epic first, then read only what they flag:

   - **Where its spec lives**: `active/`, `done/`, `archive/`, `draft/`, missing from
     disk, or no `spec_path` at all.
   - **How many open children it has.** `tbd list --json` omits closed beads, so an epic
     with `child_order_hints` and no children in that dump has had every child closed.
   - **How many unchecked boxes its spec carries** (`grep -c '^\s*-\s*\[ \]'`).
   - **Whether it has any children at all**, closed ones included.

   That last signal is the one that is easy to skip and expensive to miss.
   **“No open children” and “finished” are different facts.** An epic with no open
   children because every child closed is finished; an epic with no children because
   nobody ever decomposed it has not started.
   Both look identical in `tbd list --json`, which returns only non-closed beads, so
   distinguishing them means counting closed children too.
   Measured once on a real repository, 23 of 33 candidate specs turned out to be
   undecomposed drafts rather than completed work; filing them as done would have
   asserted delivery of work nobody had begun.

   The combinations sort themselves:

| Spec location | Children (total) | Open | Unchecked | Disposition |
| --- | --- | --- | --- | --- |
| `done/` or `archive/` | any | 0 | 0 | Closable. Confirm against the spec status line, then bulk-close. |
| any | **>0** | 0 | 0 | Closable: everything it decomposed into is finished. |
| any | **0** | 0 | 0 | **Never decomposed.** Not finished — not started. Belongs in `draft/`, not `done/`. |
| any | 0 | 0 | **many** | **Do not close.** Work exists only as spec checkboxes and is invisible to `tbd ready`. Break it into beads or record what was dropped. |
| any | **>0** | 0 | **many** | **Stalled**: work began and stopped. Neither done nor draft; see the lifecycle section below. |
| `done/` or `archive/` | any | **>0** | any | The beads are usually right and the spec filing is wrong. See step 6. |
| missing from disk | any | any | any | Check `git log --diff-filter=D` for the path before assuming it is stale; the spec may simply live on an unmerged branch, which needs no action. |

**Read the spec’s own status line, and read all of it.** It is the highest-signal field
and the cheapest to check, but it does not survive keyword matching: a line reading
`Active (4 of 10 items landed; 6 P0/P1 items open)` contains “landed” while saying the
opposite. Match on the whole claim, not a substring.

Sizing this first also tells you whether the pass is an afternoon or a week.

3. **Reconnect epics to their specs before mapping anything.**

   An epic with no `spec_path` is invisible to `tbd list --spec` and to any spec-based
   selector, so it silently drops out of every view this process depends on — including
   the triage above. Find them first: they are the epics whose spec column is empty.

   Two recovery signals, in order of reliability:

   - The spec names the bead (`Epic \`abc1-xyz9\`; … tracks this spec`). Search the spec
     tree for the bead id; a governing statement is authoritative.
     Be careful to distinguish it from a passing cross-reference — “consumers today:
     epic X” does not make that spec X’s home.
   - The bead’s own description names a spec path.
     Verify the file exists before setting it; a named path often refers to a spec that
     has since been deleted or renamed.

   Do **not** guess from title similarity.
   Token overlap ranks a “depth tier” epic highest against a “breadth tier” spec, and a
   wrong link is worse than none.
   An epic with no discoverable spec is a legitimate state; record it and move on.

4. **Build a workstream map.**
   - Group beads under top-level features or epics.
   - For every active feature, identify exactly one governing active spec unless the
     work is intentionally future-only or done.
   - For every active spec, identify the parent bead or epic tracking it.
   - For every `TODO.md` line, identify the bead and governing spec it points to.

5. **Reconcile beads to reality.**
   - Check code, docs, commits, PRs, CI, deploy state, or review docs as needed before
     changing status.
   - **Never close an epic on bead state alone.** Every child being closed proves only
     that what was decomposed is finished.
     Read the governing spec for unchecked items first; an epic whose beads are all
     closed but whose spec still lists real work is the one case where closing destroys
     information rather than recording it.
   - Close completed beads with a concrete reason that names what shipped and how it was
     validated — group beads that share a reason into one bulk call
     (`tbd close <id1> <id2> … --reason "..."`, one call per group), not a per-ID loop.
   - Update partial beads with current notes, blockers, dependencies, and governing spec
     paths.
   - Create beads for untracked remaining work under the correct parent epic or spec; do
     not leave orphan beads.
   - Do not close or retarget another agent’s in-progress bead unless the user asked for
     that workstream.

6. **Reconcile plan specs.**
   - Update each active spec’s status, checklist, milestone table, and validation notes
     to match the beads and verified state.

   - Move completed specs from `docs/project/specs/active/` to
     `docs/project/specs/done/`.

   - **Give a spec the folder that matches its lifecycle state, and keep the set
     small.** A spec directory is a state vocabulary, so the same distinction that
     applies to beads applies here: where the work sits, and whether it is moving.

| Folder | Means | Test |
| --- | --- | --- |
| `draft/` | authored, never begun | no beads, or checkboxes but no beads |
| `active/` | being worked now | has open beads |
| `paused/` | begun, then stopped | closed beads **and** unchecked items, no open beads |
| `future/` | deliberately later, not begun | authored, and a decision exists to defer it |
| `done/` | finished | beads closed, nothing unchecked, status says so |
| `archive/` | abandoned or superseded | status names what replaced it |

```
 `paused/` is the one most repositories lack, and its absence is why stalled work
 accumulates in `active/`: `draft/` is wrong because the work began, `done/` is a
 lie, and `archive/` overstates abandonment.
 Without it, “active” stops meaning anything — measured once at 116 specs in
 `active/`, only 85 of which had any open bead.
```

- **Fix the inverse too: specs filed as done while their beads are still open.** This is
  the more common drift, because filing a spec to `done/` is a deliberate act and nobody
  revisits it when follow-on work appears.
  Each one is either a spec that belongs back in `active/`, or residual work that should
  be re-parented or closed.
  Decide which; do not leave the pair contradicting itself.

- Move deferred or future-only plans to `docs/project/specs/future/`.

- Fix every link or bead `spec_path` affected by a move.
  Inbound references are usually more numerous than expected — a dozen per spec is
  ordinary, spread across other specs, `TODO.md`, research docs, and logbooks — and they
  appear in several shapes (bare filename, repo-relative, and `../` relative).
  Rewriting on the `specs/<folder>/<file>` fragment catches every path-bearing form at
  once while leaving bare filenames alone, which a move does not break.
  Use a multi-file rewrite tool with a dry run rather than editing by hand, and
  afterwards grep for the old path to prove none survived.

- Never silently shrink scope.
  If reality changed the goal, state the scope change in the spec and track any
  remaining work as beads.

7. **Reconcile `TODO.md`.**
   - Keep it short: one line per active workstream, grouped by area.
   - Link to the governing spec and relevant bead or epic instead of duplicating detail.
   - Remove closed or future-only work from active groups unless it remains a launch
     blocker.
   - Update sync metadata, counts, and checkboxes.

8. **Validate consistency.**
   - Every active top-level workstream appears in `TODO.md` once.
   - Every `TODO.md` line maps to a real open or in-progress bead and an active spec, or
     clearly says why no active spec applies.
   - Every active spec has a matching open or in-progress parent bead.
   - No spec sits in `active/` with no beads at all; those are drafts, not active work.
   - No epic is left without a `spec_path` unless it genuinely has no governing spec.
   - After any spec move, no reference to the old `specs/<folder>/<file>` path survives.
   - No done spec remains in `active/`; no future-only work remains in active launch
     groups.
   - Search for stale names, old paths, obsolete dependencies, and closed beads still
     described as active.
   - Run a Markdown link check for moved or edited docs.

9. **Finish cleanly.**
   - Format changed Markdown with `flowmark --auto`.
   - Run `tbd sync`.
   - Review `git diff` and stage only the files and tbd metadata you changed.
   - Commit and push when the branch workflow expects it.

## Useful Checks

```bash
tbd list --specs
tbd list --json
tbd shortcut --list
tbd list --status open --type epic --json   # the triage input in step 2
```

Two things to know before scripting the triage:

- `tbd list --json` returns only non-closed beads, which is what makes “no children in
  this dump” mean “every child is closed”.
  It does **not** include `extensions`, so it cannot tell you about external-tracker
  links.
- Because closed beads are absent from that dump, it cannot distinguish
  every-child-closed from no-children-ever-existed, which is the distinction step 2
  turns on. To count closed beads per spec, read the committed bead files directly and
  tally `spec_path` against `status`; they live under the data-sync worktree
  `tbd doctor` reports.
- `parentId` holds the **display** id (`abc1-xyz9`), not `internalId`, while
  `child_order_hints` holds internal ids.
  Matching the wrong pair silently yields zero children for every epic, which reads as
  “everything is closable”.
  If every epic looks closable, that is the bug, not a clean repository.

Resolve `spec_path` from the repository root, not from wherever a scratch script runs;
relative paths checked from the wrong directory report every spec as missing.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
