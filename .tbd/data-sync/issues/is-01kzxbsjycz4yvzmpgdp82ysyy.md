---
type: is
id: is-01kzxbsjycz4yvzmpgdp82ysyy
title: Preserve the displaced winner when restoring an attic value
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
created_at: 2026-08-13T10:48:24.776Z
updated_at: 2026-08-13T11:49:49.456Z
closed_at: 2026-08-13T11:49:49.456Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Attic restore currently overwrites the current winning field without first creating the reverse attic entry promised by tbd-design.md. Implement under the data-sync lock using canonical attic persistence; verify null/text behavior and ensure either value remains recoverable.
