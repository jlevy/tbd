---
type: is
id: is-01m1yzxc32gtef4s6t5n72zbbs
title: Outbound duplicate relation from duplicate_of is marked done but unimplemented
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
created_at: 2026-09-07T22:30:38.427Z
updated_at: 2026-09-07T22:30:38.427Z
---
plan-2026-08-18-tracker-state-model-and-linear-mapping.md:478-479 marks '[x] duplicate also creates the provider-side duplicate relation from the scalar', and :480-481 marks inbound duplicate mapped 'instead of collapsing'. Neither holds: CanonicalPatch carries no duplicate_of (integrations/core/types.ts:102-103), src/integrations/linear/adapter.ts has no duplicateIssueId or relation code, and sync-engine.ts:806-810 downgrades inbound duplicate to canceled. Correct both checkboxes (done by the sprint's #267 bead), then implement the outbound relation here. Live QA item at :586-588 is still unchecked. Sibling: the #267 fix in the 2026-09-07 stability sprint plan.
