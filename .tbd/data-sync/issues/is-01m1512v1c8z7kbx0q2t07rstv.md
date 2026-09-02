---
type: is
id: is-01m1512v1c8z7kbx0q2t07rstv
title: resolveLabelIds silently drops an uncreatable label and the pair is still reported as pushed
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T20:30:50.923Z
updated_at: 2026-08-28T20:30:50.923Z
---
Confirmed by code reading while investigating GH #265; NOT the cause of that issue (the reporter runs labels.mirror: none, under which sync-engine deletes externalPatch.labels entirely, so bead labels are never pushed for them). Real for any repository running labels.mirror: prefixed or verbatim.

resolveLabelIds (integrations/linear/adapter.ts:1057-1074) drops any name it cannot resolve to an id: 'A name with no id and no creation is dropped rather than failing the whole push: losing one label is better than losing the status change with it.' mayCreateLabel (adapter.ts:1515-1523) permits a create only for tbd-owned labels under the default labels.create: 'tbd'. So a bead label that does not already exist on the Linear team is pushed, silently dropped, and kept locally.

The drop happens inside the adapter, below the reporting layer, so the pair is still counted in report.pushed: reported as work done while the value never left the machine. That is the OS-351 class one layer down. With field_sync labels: local the local value is re-applied on every run independent of base (reconcile.ts:413-427), so such a pair would also never converge.

Fix: resolveLabelIds should return the names it dropped, and the engine should record them as skipped pushes rather than counting the pair as pushed. Whether the drop should stop being a drop (create the label, or refuse the push) is a policy question worth deciding alongside tbd-b7cy. Recording it honestly is correct regardless.

Test path: tests/helpers/linear-mock-server.ts models a fixed team label set (Bug, Feature), which is exactly the condition that triggers the drop.
