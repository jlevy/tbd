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

   The combinations sort themselves:

| Spec location | Open children | Unchecked | Disposition |
| --- | --- | --- | --- |
| `done/` or `archive/` | 0 | 0 | Closable. Confirm against the spec status line, then bulk-close. |
| any | 0 | 0 | Closable: everything it decomposed into is finished. |
| any | 0 | **many** | **Do not close.** Work exists only as spec checkboxes and is invisible to `tbd ready`. Break it into beads or record what was dropped. |
| `done/` or `archive/` | **>0** | any | The beads are usually right and the spec filing is wrong. See step 4. |
| missing from disk | any | any | Check `git log --diff-filter=D` for the path before assuming it is stale; the spec may simply live on an unmerged branch, which needs no action. |

Sizing this first also tells you whether the pass is an afternoon or a week.

3. **Build a workstream map.**
   - Group beads under top-level features or epics.
   - For every active feature, identify exactly one governing active spec unless the
     work is intentionally future-only or done.
   - For every active spec, identify the parent bead or epic tracking it.
   - For every `TODO.md` line, identify the bead and governing spec it points to.

4. **Reconcile beads to reality.**
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

5. **Reconcile plan specs.**
   - Update each active spec’s status, checklist, milestone table, and validation notes
     to match the beads and verified state.
   - Move completed specs from `docs/project/specs/active/` to
     `docs/project/specs/done/`.
   - **Fix the inverse too: specs filed as done while their beads are still open.** This
     is the more common drift, because filing a spec to `done/` is a deliberate act and
     nobody revisits it when follow-on work appears.
     Each one is either a spec that belongs back in `active/`, or residual work that
     should be re-parented or closed.
     Decide which; do not leave the pair contradicting itself.
   - Move deferred or future-only plans to `docs/project/specs/future/`.
   - Fix every link or bead `spec_path` affected by a move.
   - Never silently shrink scope.
     If reality changed the goal, state the scope change in the spec and track any
     remaining work as beads.

6. **Reconcile `TODO.md`.**
   - Keep it short: one line per active workstream, grouped by area.
   - Link to the governing spec and relevant bead or epic instead of duplicating detail.
   - Remove closed or future-only work from active groups unless it remains a launch
     blocker.
   - Update sync metadata, counts, and checkboxes.

7. **Validate consistency.**
   - Every active top-level workstream appears in `TODO.md` once.
   - Every `TODO.md` line maps to a real open or in-progress bead and an active spec, or
     clearly says why no active spec applies.
   - Every active spec has a matching open or in-progress parent bead.
   - No done spec remains in `active/`; no future-only work remains in active launch
     groups.
   - Search for stale names, old paths, obsolete dependencies, and closed beads still
     described as active.
   - Run a Markdown link check for moved or edited docs.

8. **Finish cleanly.**
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
