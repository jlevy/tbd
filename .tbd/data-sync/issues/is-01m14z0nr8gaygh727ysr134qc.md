---
type: is
id: is-01m14z0nr8gaygh727ysr134qc
title: "Linear mirror alternates push/pull on 13 agreeing pairs: mechanism not yet reproduced"
kind: bug
status: open
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:54:42.823Z
updated_at: 2026-08-28T20:29:49.168Z
---
GH #265 defect 2. The reachable code path is confirmed; that labels (rather than assignee or description) are the stuck field in the reporter's 13 pairs is NOT yet confirmed.

Mechanism, from the code: a field owned 'local' short-circuits the three-way matrix (integrations/core/reconcile.ts:413-427). Whenever local and remote are unequal it applies the local value to the remote on EVERY run, independent of base. Ownership never advances or consults base, so a pair can be permanently dirty while base agrees with local perfectly. That is exactly the state #265 measured: base vs bead 0 differ on title/status/priority, base.slot vs refinement_slot 0 differ, remote_updated_at vs live Linear 0 differ. All of those are merge fields or bookkeeping; their field_sync sets labels: local and assignee: local, and an owned field that cannot round-trip is invisible to every check they ran.

Labels have a confirmed non-round-tripping path under DEFAULT config. resolveLabelIds drops any name it cannot resolve to an id (integrations/linear/adapter.ts:1065-1066): 'A name with no id and no creation is dropped rather than failing the whole push'. mayCreateLabel (adapter.ts:1515-1523) permits creation only for tbd-owned labels under the default labels.create: 'tbd'. So a bead carrying a repository label that does not exist on the Linear team pushes it, has it silently dropped, and keeps it locally. The next run finds the sides unequal and pushes again, forever. Each push bumps Linear updatedAt, so the following run reads the remote as changed and swings to pull: the alternation in the report, on a fixed subset, count stable.

The drop happens inside the adapter, below the reporting layer, so the pair is counted in report.pushed: reported as work done while the value never left the machine. Same class as the OS-351 defect the engine comments name, one layer down.

Fix (order matters): land the diagnostic first (see sibling bead), then make resolveLabelIds return what it dropped and have the engine record it as a skipped push rather than counting the pair in report.pushed. Whether the drop should stop being a drop (create the label, or refuse the push) is a policy question the diagnostic should answer first; recording it honestly is correct regardless and is what ends the loop's silence.

Red-green: tests/helpers/linear-mock-server.ts already models a fixed team label set (Bug, Feature; linear-mock-server.ts:106-108), which is exactly the condition that triggers the drop. Failing test: link a bead carrying a label absent from the mock team with labels: local, sync twice over unchanged data, assert the second run reports nothing to do.

## Notes

INVESTIGATED 2026-08-28. The label-drop hypothesis in the description is DISPROVED for the reporter's configuration, and the separately-confirmed never-converges defect turned out to be a different bug (tbd-p40p, fixed).

Why the label hypothesis does not apply: the reporter runs labels.mirror: none, and sync-engine.ts deletes externalPatch.labels outright under mirrorLabels === 'none' (the 'Labels are inert unless explicitly mirrored' branch). Bead labels are therefore never pushed at all, so resolveLabelIds' silent drop cannot be reached through externalPatch.labels for them. The drop is still real for repos running mirror: prefixed|verbatim, and is worth fixing on its own, but it is not this loop.

What WAS reproduced and fixed: a standing mapping warning (unmapped Linear assignee, empty user_map) kept nothingToDo permanently false. That accounts for #265's 'nothing to do is never reached' and its constant 'warnings 5'. See tbd-p40p.

What is still NOT reproduced: the 13-item push/pull alternation itself. Probed against the mock server across remote state changes (Backlog, Todo, In Review, Canceled, Duplicate, a custom started column, an unknown state type), remote title/priority edits, an extra human label, local status blocked/deferred/in_progress, local labels under mirror: none, and description prose. Every one settles within one or two runs. The pull-then-push round trip exists (a pull adopts a remote value, the next run pushes slot/status/hold/resolution back) but converges in the mock because the mock's state machine is self-consistent.

Next step is diagnosis on the reporter's data, not more guessing: tbd-aypl (per-pair divergence diagnostic) plus the now-shipped dry-run skippedPushes (tbd-8gcz) should name the field. Worth checking specifically whether a pulled value fails to map back to the same Linear state on a team with custom workflow states, since that is the one path the mock cannot model faithfully. Live Linear was NOT available in the session that did this work (no LINEAR_API_KEY).
