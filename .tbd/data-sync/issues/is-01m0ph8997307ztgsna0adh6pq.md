---
type: is
id: is-01m0ph8997307ztgsna0adh6pq
title: Expand general-testing-rules with extracted testing practices
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:24:50.087Z
updated_at: 2026-08-23T05:24:50.087Z
---
Add the neutral half of docs/general/agent-guidelines/typescript-testing-guidelines.md (test real system interactions rather than mock existence, integration points, error scenarios, contract compliance), plus the platform-conditional timeout rule from vitest.config.ts: raise a timeout only on the platform where it is genuinely tight and record the measurement that forced it (bridge-merge at 5472ms against a 5000ms budget), since a global raise masks hangs. Add a pointer to the hostile-environment rule in ci-and-gates-rules.
