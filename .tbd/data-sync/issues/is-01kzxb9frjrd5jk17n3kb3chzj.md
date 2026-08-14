---
type: is
id: is-01kzxb9frjrd5jk17n3kb3chzj
title: Decode attic values before restoring text fields
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
created_at: 2026-08-13T10:39:37.230Z
updated_at: 2026-08-13T11:49:49.443Z
closed_at: 2026-08-13T11:49:49.443Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
External conflict attic entries and existing workspace conflict entries store lost_value as JSON text (for example '"Local title"'), but AtticRestoreHandler assigns entry.lost_value directly to title/description/notes. Restoring would therefore add literal JSON quotes/escapes. Decode JSON strings/values with a backward-compatible fallback for legacy plain text, validate the target field type, add round-trip tests, and prove the live Linear losing title can be restored exactly.
