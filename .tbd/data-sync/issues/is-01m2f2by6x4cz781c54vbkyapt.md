---
type: is
id: is-01m2f2by6x4cz781c54vbkyapt
title: tbd sync --dry-run silently skips the tracker surface entirely and exits 0
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies: []
created_at: 2026-09-14T04:21:23.804Z
updated_at: 2026-09-14T14:11:10.320Z
closed_at: 2026-09-14T14:11:10.320Z
close_reason: |-
  Fixed the dishonesty, not the omission. tbd sync --dry-run still does not evaluate the tracker surface — it cannot, because it never opens the locked data-sync context that surface needs, and opening one in a dry run would repair the worktree and commit pending state, which is exactly what a dry run must not do. What it no longer does is stay silent about it: cli/commands/sync.ts now emits a notice whenever the tracker surface is selected and skipped for a dry run, pointing at 'tbd integration sync --dry-run', which does reach the tracker.

  Uses notice(), not info(): info is verbose-only (documented at sync.ts:161 for the adjacent surface-narrowing notice), so an info() call would have left the default run as silent as before — the defect itself. Verified on the built CLI: both 'tbd --dry-run sync' and 'tbd --dry-run sync --integrations' now print it; before, the latter printed nothing at all and exited 0.

  Actually running the tracker surface under --dry-run stays open as part of Phase 1b's reporting work; this change makes the current behavior honest in the meantime.
resolution: null
duplicate_of: null
---
Reproduced on main at 52d5c2f7 in this repository (linear enabled, LINEAR_API_KEY deliberately absent):

  $ tbd --dry-run integration sync
  Error: LINEAR_API_KEY is not set. Run `tbd integration status` for details.
  exit 1

  $ tbd --dry-run sync --integrations
  (no output at all)
  exit 0

  $ tbd --dry-run sync
  ✓ Docs up to date
  [DRY-RUN] Would sync repository
  exit 0

Cause: `cli/commands/sync.ts:274` gates surface 3 on `!this.ctx.dryRun`, so the umbrella command never enters the tracker path under --dry-run. It does not run it, does not report that it skipped it, and does not fail. The credential error that the dedicated command raises is invisible.

Why it matters beyond cosmetics: --dry-run is the safe way to preview what a sync will do to a live tracker, and the umbrella `tbd sync` is the command agents are told to run at session end. Previewing with `tbd sync --dry-run` therefore reports a clean repository while the tracker half is entirely unexamined — including a broken credential, a half-written link, or pending pushes. An agent reading exit 0 concludes the tracker is settled.

Same family as #276 (full sync hides pending updates) and the sprint's 1b reporting rule, but distinct: this is total omission under --dry-run, not an under-reported count. Phase 1b should either run the tracker surface in dry-run (the dedicated command already does, and `syncFoldPosture` already carries `dryRun`) or print an explicit 'tracker surface not evaluated in --dry-run' line. Red first: --dry-run sync --integrations with an unset credential must either surface the credential error or say the surface was skipped, and must not exit 0 silently.
