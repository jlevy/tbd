---
type: is
id: is-01m2esef50qbe11ancst0cmnj1
title: tbd sync must save every merge conflict to the attic; document the attic as a recovery store
kind: bug
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:29.503Z
updated_at: 2026-09-14T02:58:51.309Z
---
`tbd sync` collects field-level merge conflicts from the structured bead merge (sync.ts:941-956, mergeRemoteIntoSyncBranch; doPushWithRetry allConflicts in file/git.ts:1318-1323) and only counts them (summary.conflicts), yet prints "N conflict(s) preserved in attic" (sync.ts:800) and git.ts:828/:1321 say the caller preserves them in the attic. No code on the sync path writes an attic entry: writeAtticEntryFile is called only by `tbd attic`, the integration runner, and workspace save/import; rescue writes attic/conflicts/ separately. Pre-existing on main.

Why it matters now: PR #279 (tbd-8rnq) makes a losing provider namespace, including undelivered pending comments after a relink, a recorded conflict. Under `tbd sync` that loser is recoverable only from git history, while tbd-docs.md (~2129-2133 at #283) and tbd-design.md (~2746, ~6735) say it is archived.

Decide: write sync conflict entries to attic/ (preferred; red-green with a two-clone conflicting edit that asserts the entry exists and v0.8.1 reads it), or change the message and docs to say the losing value is recoverable from git history and the attic applies to workspace and rescue paths only. Either way the message at sync.ts:800 must match what happened.

Decision 2026-09-14 (owner): `tbd sync` always saves to the attic. The attic is only an extra place to store things: it is append-only, never read back into live bead state, and exists so a bad merge can be recovered. Implement:
- Write one attic entry per ConflictEntry that the sync path collects (mergeRemoteIntoSyncBranch and doPushWithRetry), with the same entry format workspace import already writes, so `tbd attic list/show/restore` (cli/commands/attic.ts:330-358) work on them and v0.8.1 reads them.
- Keep the message at sync.ts:800 and the comments at git.ts:828/:1321 true by construction; report the entry paths under --verbose.
- Red first: a two-clone conflicting edit through the built CLI asserts the entry exists, `tbd attic restore` recovers the losing value, and a relinked provider namespace's pending comment is recoverable.
Document: the attic's role and recovery steps in tbd-docs.md (`### attic` ~:904 and `### Conflict handling` ~:61), tbd-design.md §3.5 Merge Rules, the sync-failure-recovery shortcut, and the tbd-sync-troubleshooting guideline. After PR #283 merges, its provider-comment passages (tbd-docs.md ~2129-2133, tbd-design.md ~2746, ~6735) become accurate once this lands.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): write sync conflict entries through writeAtticEntryFile into the flat attic/ directory (file/attic-entry.ts:13-30) with is-<ulid> ids and now() timestamps. Not attic/conflicts/ (git.ts:2599): `tbd attic list` reads only the top-level directory (attic.ts:92). Conflicts on non-bead files (link records, intents) have no valid entity id and would fail AtticEntrySchema; record them in a way list and restore can show, or report them. AtticEntrySchema and attic commands are unchanged since 0.7.0, so old clients list/show/restore these entries; tbd-9fpp (T4) proves it.
