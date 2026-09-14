---
type: is
id: is-01m2esef50qbe11ancst0cmnj1
title: tbd sync prints 'conflict(s) preserved in attic' but never writes sync merge conflicts to the attic
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:29.503Z
updated_at: 2026-09-14T01:45:34.269Z
---
`tbd sync` collects field-level merge conflicts from the structured bead merge (sync.ts:941-956, mergeRemoteIntoSyncBranch; doPushWithRetry allConflicts in file/git.ts:1318-1323) and only counts them (summary.conflicts), yet prints "N conflict(s) preserved in attic" (sync.ts:800) and git.ts:828/:1321 say the caller preserves them in the attic. No code on the sync path writes an attic entry: writeAtticEntryFile is called only by `tbd attic`, the integration runner, and workspace save/import; rescue writes attic/conflicts/ separately. Pre-existing on main.

Why it matters now: PR #279 (tbd-8rnq) makes a losing provider namespace, including undelivered pending comments after a relink, a recorded conflict. Under `tbd sync` that loser is recoverable only from git history, while tbd-docs.md (~2129-2133 at #283) and tbd-design.md (~2746, ~6735) say it is archived.

Decide: write sync conflict entries to attic/ (preferred; red-green with a two-clone conflicting edit that asserts the entry exists and v0.8.1 reads it), or change the message and docs to say the losing value is recoverable from git history and the attic applies to workspace and rescue paths only. Either way the message at sync.ts:800 must match what happened.
