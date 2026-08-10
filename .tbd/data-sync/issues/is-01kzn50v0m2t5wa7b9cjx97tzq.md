---
type: is
id: is-01kzn50v0m2t5wa7b9cjx97tzq
title: "integrations/linear/mapping.ts: pure status and priority tables"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50vbgseh54rtpjz6jf2g1
parent_id: is-01kzn2w8x0c038fhk1c859248r
created_at: 2026-08-10T06:16:06.931Z
updated_at: 2026-08-10T06:16:07.279Z
---
statusToLinear(s): { stateType, labels }; statusFromLinear(stateType, labels); priorityToLinear(p); priorityFromLinear(n). WorkflowState.type is a String scalar, NOT an enum, and a default team exposes 'duplicate': treat the value set as OPEN, mapping unknown types to open with a warning. blocked/deferred round-trip via tbd:blocked / tbd:deferred labels. Priority is deliberately NOT a bijection: Linear 0 means unset, so 0 pulls to the tbd default P2, and P4 pushes to 4 (accepted round-trip loss, documented). Exhaustive tests over both enums. Spec Component 7.
