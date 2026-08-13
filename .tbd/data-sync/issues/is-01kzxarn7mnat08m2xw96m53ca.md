---
type: is
id: is-01kzxarn7mnat08m2xw96m53ca
title: Archive losing values from tracker conflicts
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T10:30:25.778Z
updated_at: 2026-08-13T11:49:49.413Z
closed_at: 2026-08-13T11:49:49.413Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Live Linear forced-conflict gate on disposable TBD-153 reported remote-wins title conflict and posted a comment claiming the discarded value was archived under .tbd/data-sync/attic/conflicts, but no artifact was written. Add a durable conflict-archive callback to the sync engine, persist a normal AtticEntry before advertising its exact path, make the comment path truthful, and cover remote-wins/local-wins plus failure containment with tests. Re-run the live conflict gate and confirm the discarded value is recoverable through tbd attic.
