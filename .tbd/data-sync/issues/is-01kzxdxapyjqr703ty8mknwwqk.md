---
type: is
id: is-01kzxdxapyjqr703ty8mknwwqk
title: Roll folded integration failures into tbd sync exit status
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - pr-review
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:25:24.573Z
updated_at: 2026-08-13T11:49:49.547Z
closed_at: 2026-08-13T11:49:49.547Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
PR #206 thread PRRT_kwDOQ109P86YTR1a: fullSync warns when the in-position tracker fold throws but never records the integration surface failure, allowing plain tbd sync to exit zero. Preserve issue git sync containment, report the integration surface in the outer rollup, propagate per-item report failures too, and test that working surfaces complete while the command exits operational-error.
