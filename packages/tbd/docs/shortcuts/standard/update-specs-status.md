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

2. **Build a workstream map.**
   - Group beads under top-level features or epics.
   - For every active feature, identify exactly one governing active spec unless the
     work is intentionally future-only or done.
   - For every active spec, identify the parent bead or epic tracking it.
   - For every `TODO.md` line, identify the bead and governing spec it points to.

3. **Reconcile beads to reality.**
   - Check code, docs, commits, PRs, CI, deploy state, or review docs as needed before
     changing status.
   - Close completed beads with a concrete reason that names what shipped and how it was
     validated.
   - Update partial beads with current notes, blockers, dependencies, and governing spec
     paths.
   - Create beads for untracked remaining work under the correct parent epic or spec; do
     not leave orphan beads.
   - Do not close or retarget another agent’s in-progress bead unless the user asked for
     that workstream.

4. **Reconcile plan specs.**
   - Update each active spec’s status, checklist, milestone table, and validation notes
     to match the beads and verified state.
   - Move completed specs from `docs/project/specs/active/` to
     `docs/project/specs/done/`.
   - Move deferred or future-only plans to `docs/project/specs/future/`.
   - Fix every link or bead `spec_path` affected by a move.
   - Never silently shrink scope.
     If reality changed the goal, state the scope change in the spec and track any
     remaining work as beads.

5. **Reconcile `TODO.md`.**
   - Keep it short: one line per active workstream, grouped by area.
   - Link to the governing spec and relevant bead or epic instead of duplicating detail.
   - Remove closed or future-only work from active groups unless it remains a launch
     blocker.
   - Update sync metadata, counts, and checkboxes.

6. **Validate consistency.**
   - Every active top-level workstream appears in `TODO.md` once.
   - Every `TODO.md` line maps to a real open or in-progress bead and an active spec, or
     clearly says why no active spec applies.
   - Every active spec has a matching open or in-progress parent bead.
   - No done spec remains in `active/`; no future-only work remains in active launch
     groups.
   - Search for stale names, old paths, obsolete dependencies, and closed beads still
     described as active.
   - Run a Markdown link check for moved or edited docs.

7. **Finish cleanly.**
   - Format changed Markdown with `flowmark --auto`.
   - Run `tbd sync`.
   - Review `git diff` and stage only the files and tbd metadata you changed.
   - Commit and push when the branch workflow expects it.

## Useful Checks

```bash
tbd list --json
tbd list --json | jq -r '.[] | [.id, .status, .title, (.spec_path // "")] | @tsv'
tbd shortcut --list
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
