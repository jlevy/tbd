---
type: is
id: is-01m0ermv7j0a2dyngp1zfzjwg9
title: Prompt on ambiguous state resolution and persist the answer
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
created_at: 2026-08-20T05:00:06.257Z
updated_at: 2026-08-20T05:00:06.257Z
---
State Phase 1 residual. resolveStateId reports ambiguity but never asks; the spec's resolver order ends with 'ask, then write the answer into state_map so it is asked once'. Non-interactive already refuses correctly.
