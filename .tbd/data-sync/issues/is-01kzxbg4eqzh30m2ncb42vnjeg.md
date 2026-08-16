---
type: is
id: is-01kzxbg4eqzh30m2ncb42vnjeg
title: Detect archived tracker items without local edits
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
created_at: 2026-08-13T10:43:15.030Z
updated_at: 2026-08-13T11:49:49.449Z
closed_at: 2026-08-13T11:49:49.449Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Live orphan QA archived disposable Linear TBD-153 after the two-clone soak, but integration sync reported nothing to do. Archived items are absent from fetchUpdatedSince(); sync-engine targeted-fetches a linked ID missing from the delta only when localMoved, so a quiet archived/deleted link is never observed or marked orphaned. Refresh liveness for every linked pair not returned by the delta (batched), distinguish missing/deleted from merely unchanged if the adapter contract needs it, retain efficient pagination, and prove archive handling with mock plus live tests.
