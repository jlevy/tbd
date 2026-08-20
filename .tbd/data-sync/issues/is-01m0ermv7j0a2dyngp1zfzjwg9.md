---
type: is
id: is-01m0ermv7j0a2dyngp1zfzjwg9
title: Prompt on ambiguous state resolution and persist the answer
kind: task
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:00:06.257Z
updated_at: 2026-08-20T05:39:37.986Z
started_at: 2026-08-20T05:37:42.351Z
closed_at: 2026-08-20T05:39:37.985Z
close_reason: Implemented. tbd integration setup now detects ambiguous state types via ProviderMeta.ambiguousStateTypes, lists the candidates, asks which one tbd should use, and writes the answer into integrations.<provider>.identity.state_map so it is asked once rather than per run. Silent when there is no ambiguity or no TTY, leaving the existing non-interactive refusal intact.
resolution: null
duplicate_of: null
---
State Phase 1 residual. resolveStateId reports ambiguity but never asks; the spec's resolver order ends with 'ask, then write the answer into state_map so it is asked once'. Non-interactive already refuses correctly.
