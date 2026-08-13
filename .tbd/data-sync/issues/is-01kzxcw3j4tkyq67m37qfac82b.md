---
type: is
id: is-01kzxcw3j4tkyq67m37qfac82b
title: Journal inbound import claims before external attachment writes
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - durability
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:07:15.902Z
updated_at: 2026-08-13T11:49:49.498Z
closed_at: 2026-08-13T11:49:49.498Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
packages/tbd/src/integrations/core/sync-engine.ts importExternal currently writes the external tbd://bead claim directly after local import state. If the adapter attachment call fails, the local link survives without a durable claim replay path, weakening the one-source guard. Add a write-ahead upsert_attachments intent before the external call, commit local state through afterJournal, delete only after success, leave it deferred during strict pull, and prove retry is exact-once without duplicating the bead.
