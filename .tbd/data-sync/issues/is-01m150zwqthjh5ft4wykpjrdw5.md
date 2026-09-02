---
type: is
id: is-01m150zwqthjh5ft4wykpjrdw5
title: A standing mapping warning makes nothingToDo permanently false
kind: bug
status: closed
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T20:29:14.362Z
updated_at: 2026-08-28T20:29:26.543Z
closed_at: 2026-08-28T20:29:26.543Z
close_reason: "Fixed: warnings removed from both nothingToDo computations; warnings still printed when a run is otherwise quiet. Red-green test in integrations-sync-engine.test.ts. Full suite green: 2452 vitest + 1101 tryscript goldens."
resolution: null
duplicate_of: null
---
FOUND AND FIXED while reproducing GH #265. This is the confirmed never-converges defect, reproduced against the mock server.

report.warnings.length was a term in BOTH nothingToDo computations (sync-engine.ts dry-run and execute paths). A mapping warning describes a standing condition tbd cannot resolve from this side: a Linear assignee absent from identity.user_map produces 'Linear assignee is not present in user_map; assignee synchronization skipped.' on EVERY read of that issue, forever (adapter.ts toCanonical, assigneeSyncable). So a fully settled mirror could never report itself settled, and 'nothing to do' was unreachable for the life of the repository.

This is exactly #265 symptom 2's headline ('nothing to do is never reached') together with its constant 'warnings 5'. Reproduced: a linked pair whose remote carries an unmapped assignee returns push=0, pull=0, no provider writes, and nothingToDo=false on every run indefinitely.

Fix: warnings are a diagnostic, not work, so they are no longer a term in nothingToDo (failures stay counted: a failure is work attempted that did not land). Removing the count alone would have traded a mirror that never settles for a mirror that settles SILENTLY over a real diagnostic, so printSyncReport now prints 'nothing to do, warnings N' plus the warning detail lines, and the tbd sync tracker line reports standing warnings too.

Regression test: 'settles even while a standing mapping warning keeps being reported' in tests/integrations-sync-engine.test.ts. One pre-existing assertion changed deliberately: 'reports provider mapping warnings once even when an item appears in multiple fetches' asserted nothingToDo === false, which encoded the defect; its actual subject (warning dedup) is unchanged.
