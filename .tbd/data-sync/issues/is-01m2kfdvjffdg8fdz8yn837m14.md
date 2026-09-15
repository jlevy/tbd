---
type: is
id: is-01m2kfdvjffdg8fdz8yn837m14
title: tbd sync neither archives nor reports bridge-file (link record, intent) conflicts
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:35.854Z
updated_at: 2026-09-15T21:26:35.854Z
---
Unmet remainder of tbd-ajq2 (closed for bead conflicts, which #288 archives). Verified by reading main @ 1238038e.

`resolveBridgeConflicts` (file/git.ts ~:2791-2820) resolves conflicts in bridge files (link records, journaled intents) by dropping the losing side. The only trace is a debug-level count (cli/commands/sync.ts ~:1051-1056); nothing reaches the attic or the sync summary. tbd-ajq2's f08 note (stability sprint plan, per-change classification table) says non-bead conflicts need a representation that `tbd attic list/show/restore` can display.

Pre-existing (0.8.1 also drops them silently), so not a release regression. Decide a representation for link-record and intent losers under f08 rule 6 (flat `attic/`, via `writeAtticEntryFile`), count them in the summary, and cover with a two-clone tryscript plus T4.
