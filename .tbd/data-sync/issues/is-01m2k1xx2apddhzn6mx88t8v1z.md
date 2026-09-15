---
type: is
id: is-01m2k1xx2apddhzn6mx88t8v1z
title: Make Linear live QA repeatable and maintain its slot-convergence gate
kind: task
status: closed
priority: 1
version: 5
labels:
  - linear
  - qa
dependencies: []
parent_id: is-01m2k0q2av2j3dgkaj735byyr6
created_at: 2026-09-15T17:30:41.608Z
updated_at: 2026-09-15T19:13:23.826Z
closed_at: 2026-09-15T19:13:23.825Z
close_reason: "Completed 2026-09-15: PRs #289, #288, and #290 received senior Astra review, all findings were addressed and dispositioned, the branches were reconciled and merged in that order, final CI passed, live Linear OS/tbd QA passed 12/12 with cleanup, and the repeatable QA playbook/gate landed on main."
resolution: null
duplicate_of: null
---
Extend the maintained API-driven Linear QA playbook and runner so tracker/state-slot changes are covered by a stable release scenario, document when the automated live gate and manual two-clone soak must run, record evidence and cleanup expectations, and run the gate against the reconciled PR stack using the gitignored local credential without exposing it.

## Notes

Evidence 2026-09-15 UTC: final candidate 664bf89a; Linear team OS, project tbd; 12/12 maintained live scenarios passed after the cleanup fix, including blocked-slot-create-settle and independent token-scoped fixture discovery; all disposable Linear fixtures archived and disposable repository removed. Full CI passed 175 files / 2625 tests with 1 intentional skip; focused combined Linear suite passed 147 tests. Astra follow-up R1 was fixed and closure-reviewed at PR review 5214625827. Merged via PR #290 as 1238038e.
