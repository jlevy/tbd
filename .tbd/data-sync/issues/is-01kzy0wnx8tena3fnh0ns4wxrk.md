---
type: is
id: is-01kzy0wnx8tena3fnh0ns4wxrk
title: Report unknown Linear workflow state types during sync
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - mapping
dependencies: []
parent_id: is-01kzxz1e815hsxmyhykdabhcxr
created_at: 2026-08-13T16:57:06.215Z
updated_at: 2026-08-13T17:55:58.025Z
closed_at: 2026-08-13T17:55:58.024Z
close_reason: Unknown open-ended Linear workflow-state types still map conservatively to open and now emit a deduplicated, safe provider-neutral warning in human and JSON sync reports. Adapter and engine regressions pass.
---
The design promises that unknown open-ended Linear WorkflowState.type values map safely to open with a warning, but statusFromLinear currently drops the raw type and the sync report has no warning channel. Add a provider-neutral mapping-warning path, preserve fail-soft behavior, and pin CLI/JSON reporting without persisting raw provider payloads.
