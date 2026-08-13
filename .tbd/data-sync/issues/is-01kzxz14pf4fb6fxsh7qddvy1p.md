---
type: is
id: is-01kzxz14pf4fb6fxsh7qddvy1p
title: Preserve Linear sub-issue hierarchy on inbound import
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - hierarchy
dependencies: []
parent_id: is-01kzxxj27abvbje3nesecgsk3z
created_at: 2026-08-13T16:24:35.278Z
updated_at: 2026-08-13T16:24:35.278Z
---
Live dogfood discovered Linear sub-issue TBD-166, but ExternalIssue and inbound import callbacks currently discard parent identity and would flatten the child into a root bead. Preserve parent linkage on import, order parent-before-child batches, handle unresolved parents explicitly, cover later reparenting behavior, and document the contract.
