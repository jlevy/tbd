---
type: is
id: is-01m14z0nr8gaygh727ysr134qc
title: "An owned field that cannot round-trip loops forever: dropped labels are reported as pushed"
kind: bug
status: open
priority: 0
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:54:42.823Z
updated_at: 2026-08-28T19:54:42.823Z
---
GH #265 defect 2. The reachable code path is confirmed; that labels (rather than assignee or description) are the stuck field in the reporter's 13 pairs is NOT yet confirmed.

Mechanism, from the code: a field owned 'local' short-circuits the three-way matrix (integrations/core/reconcile.ts:413-427). Whenever local and remote are unequal it applies the local value to the remote on EVERY run, independent of base. Ownership never advances or consults base, so a pair can be permanently dirty while base agrees with local perfectly. That is exactly the state #265 measured: base vs bead 0 differ on title/status/priority, base.slot vs refinement_slot 0 differ, remote_updated_at vs live Linear 0 differ. All of those are merge fields or bookkeeping; their field_sync sets labels: local and assignee: local, and an owned field that cannot round-trip is invisible to every check they ran.

Labels have a confirmed non-round-tripping path under DEFAULT config. resolveLabelIds drops any name it cannot resolve to an id (integrations/linear/adapter.ts:1065-1066): 'A name with no id and no creation is dropped rather than failing the whole push'. mayCreateLabel (adapter.ts:1515-1523) permits creation only for tbd-owned labels under the default labels.create: 'tbd'. So a bead carrying a repository label that does not exist on the Linear team pushes it, has it silently dropped, and keeps it locally. The next run finds the sides unequal and pushes again, forever. Each push bumps Linear updatedAt, so the following run reads the remote as changed and swings to pull: the alternation in the report, on a fixed subset, count stable.

The drop happens inside the adapter, below the reporting layer, so the pair is counted in report.pushed: reported as work done while the value never left the machine. Same class as the OS-351 defect the engine comments name, one layer down.

Fix (order matters): land the diagnostic first (see sibling bead), then make resolveLabelIds return what it dropped and have the engine record it as a skipped push rather than counting the pair in report.pushed. Whether the drop should stop being a drop (create the label, or refuse the push) is a policy question the diagnostic should answer first; recording it honestly is correct regardless and is what ends the loop's silence.

Red-green: tests/helpers/linear-mock-server.ts already models a fixed team label set (Bug, Feature; linear-mock-server.ts:106-108), which is exactly the condition that triggers the drop. Failing test: link a bead carrying a label absent from the mock team with labels: local, sync twice over unchanged data, assert the second run reports nothing to do.
