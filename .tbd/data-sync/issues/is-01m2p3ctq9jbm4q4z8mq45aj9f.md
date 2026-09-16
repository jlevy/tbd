---
type: is
id: is-01m2p3ctq9jbm4q4z8mq45aj9f
title: Make doctor --fix repair orphaned dependency references
kind: bug
status: in_progress
priority: 2
version: 3
delegate: codex@spud10
labels:
  - doctor
  - dependencies
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T21:54:02.599Z
updated_at: 2026-09-16T22:00:53.449Z
started_at: 2026-09-16T21:54:53.855Z
---
The Dependencies diagnostic marks orphaned dependency references fixable and tells users to run tbd doctor --fix, but the dependency check does not receive the fix option and no code removes orphaned edges. Reproduce by writing a blocks edge to a missing issue, running tbd doctor to see [fixable], then running tbd doctor --fix and observing the same edge and finding remain. Either implement the advertised repair with regression coverage and user documentation or stop labeling the condition fixable and give an accurate manual remedy.

## Notes

Reproduction:

1. Create two beads and add a `blocks` edge from one bead file to the other.
2. Delete the target issue file while leaving the stored edge in the blocker file.
3. Run `tbd doctor`; the Dependencies finding reports one orphaned reference as fixable.
4. Run `tbd doctor --fix`; on v0.9.0 the same finding and stored edge remain.

Expected: `doctor --fix` revalidates the graph under the shared writer lock, removes only
edges whose target issue is still absent, preserves valid edges, and updates the repaired
issue's version and timestamp. Plain doctor and `--dry-run doctor --fix` remain read-only.

Root cause: `DoctorHandler.run()` called `checkOrphanedDependencies(this.issues)` without
passing `options.fix`; the check itself had only diagnostic output and no repair path.

Implementation: pass the fix option through, re-read issues after acquiring
`withSharedDataSyncLock`, atomically rewrite only affected issue files with `writeIssue`,
and refresh the handler snapshot. Add an end-to-end regression test covering diagnosis,
dry-run, selective repair, version/timestamp changes, and a clean follow-up diagnosis.
Document the user-visible behavior in the CLI manual.

Focused validation:

- `pnpm --filter get-tbd build`
- `pnpm --filter get-tbd exec vitest run tests/common-dir-layout-doctor.test.ts`
- full repository `pnpm ci` before handoff
