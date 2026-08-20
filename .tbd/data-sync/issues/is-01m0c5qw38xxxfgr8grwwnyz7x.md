---
type: is
id: is-01m0c5qw38xxxfgr8grwwnyz7x
title: "Phase 4: board setup, provisioning, and re-config"
kind: task
status: closed
priority: 3
version: 5
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c8v8fp3sagm3eh5bmm2n0k
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T04:51:13.639Z
updated_at: 2026-08-20T01:40:40.400Z
closed_at: 2026-08-20T01:40:40.386Z
close_reason: |-
  State Phase 4 substantially landed in 8fd37a11, c799d9af, 2e4f1b82 and verified live on team OS: state_map is optional (absent reproduces today's behavior with no prompt and no extra states); setup binds existing columns by name and creates only what the map asks for, on confirmation, with explicit positions in lifecycle order; re-running is a no-op; a state outside the map is never created, renamed, or touched; tbd doctor prints the resolution plan offline. Dogfooding created a Paused column at position 1003 on the real board and found the missing WorkflowStateCreateInput.color.
  RESIDUAL, deliberately not built: offering to REPOSITION states whose existing order contradicts the slot order (tbd places what it creates correctly but does not rewrite a board a human already arranged), and the two-slots-one-state disambiguation. Both are re-config refinements on top of working provisioning; neither blocks use.
resolution: null
duplicate_of: null
extensions:
  linear:
    id: b6189c18-9329-4e70-88a3-8cadd8d907d6
    linked_at: 2026-08-19T16:27:17.878Z
---
state_map optional: absent reproduces today's behavior with no extra states and no prompt, and the written config is the consent so no sync ever prompts.

Fresh setup proposes the default map, binds by name, and creates Draft/Paused/Blocked on confirmation with explicit positions in slot order. Re-run reconciles the map against the live team: missing states (offer create), positions contradicting slot order (offer reposition), renames (id bindings hold, doctor reports drift). Validate against real team states before mutating and fail closed naming what is missing; never rename, delete, or touch a state outside the map. Two slots may name one state, disambiguated inbound by carrier label. tbd doctor prints the resolved slot table offline.

Changes what a board looks like, so it is opt-in per repository. Depends on Phase 3.
