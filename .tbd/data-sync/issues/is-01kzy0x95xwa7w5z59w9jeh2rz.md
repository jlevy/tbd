---
type: is
id: is-01kzy0x95xwa7w5z59w9jeh2rz
title: Scope automatic Linear inbound discovery to the configured project
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - inbound
dependencies: []
parent_id: is-01kzxz1e815hsxmyhykdabhcxr
created_at: 2026-08-13T16:57:25.948Z
updated_at: 2026-08-13T17:55:57.669Z
closed_at: 2026-08-13T17:55:57.667Z
close_reason: Configured Linear project now scopes automatic inbound discovery as well as outbound creation; explicit --external imports remain identity-directed. Focused adapter coverage and a live in-project/outside-project sentinel scenario pass.
---
The config and design state that integrations.linear.project scopes both creates and inbound discovery, but fetchUpdatedSince filters only by team. A report/auto scan can therefore surface or import unrelated team issues. Resolve the project UUID, include it in automatic inbound filtering, keep explicit --external independent, and cover initial/full and watermark scans.
