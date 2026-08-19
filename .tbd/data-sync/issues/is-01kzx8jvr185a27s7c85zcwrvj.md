---
type: is
id: is-01kzx8jvr185a27s7c85zcwrvj
title: Run live Linear conflict, lifecycle, and two-clone RC soak
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - release-candidate
dependencies:
  - type: blocks
    target: is-01kzx8jw39zc4dpgx6w82rg3dm
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T09:52:18.688Z
updated_at: 2026-08-13T11:49:49.560Z
closed_at: 2026-08-13T11:49:49.560Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Follow tests/qa/linear-integration.qa.md with the built CLI and designated pilot items only. Prove status online/offline; link, take-local/take-remote, unlink, and relink; outbound and inbound field changes; append-only comment push/pull and conflict-comment resolution; a deliberate both-sides conflict with attic preservation; and two independent clones syncing concurrently to deterministic no-op convergence with no echo or ping-pong. Audit the resulting Linear project and local bridge records after each phase, record exact evidence in the spec, and restore pilot data to a coherent final state.
