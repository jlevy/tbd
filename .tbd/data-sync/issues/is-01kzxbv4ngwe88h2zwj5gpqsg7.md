---
type: is
id: is-01kzxbv4ngwe88h2zwj5gpqsg7
title: Keep integration sync --pull strictly free of external writes
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
created_at: 2026-08-13T10:49:15.692Z
updated_at: 2026-08-13T11:49:49.469Z
closed_at: 2026-08-13T11:49:49.469Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Inbound auto-import currently calls upsertAttachments, so sync --pull mutates Linear despite the explicit no-external-writes contract. Make inbound-only import local-only, add adapter-spy and real-binary coverage, and document when the bead attachment is created.
