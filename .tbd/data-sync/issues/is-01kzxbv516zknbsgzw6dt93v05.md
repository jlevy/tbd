---
type: is
id: is-01kzxbv516zknbsgzw6dt93v05
title: Enforce the promised cross-repository one-source guard
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
created_at: 2026-08-13T10:49:16.069Z
updated_at: 2026-08-13T11:49:49.476Z
closed_at: 2026-08-13T11:49:49.476Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Link/import only check this repository's bridge and bead links. The spec promises a remote tbd://bead attachment probe plus explicit --force override, but neither is implemented. Add the provider seam and Linear query/mock support, reject pre-linked external items before local writes, implement intentional --force semantics, and test link plus explicit inbound selection.
