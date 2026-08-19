---
type: is
id: is-01m0c5qw38xxxfgr8grwwnyz7x
title: "Phase 4: board setup, provisioning, and re-config"
kind: task
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c8v8fp3sagm3eh5bmm2n0k
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T04:51:13.639Z
updated_at: 2026-08-19T16:25:59.258Z
extensions:
  linear:
    id: b6189c18-9329-4e70-88a3-8cadd8d907d6
    linked_at: 2026-08-19T16:25:59.258Z
---
state_map optional: absent reproduces today's behavior with no extra states and no prompt, and the written config is the consent so no sync ever prompts.

Fresh setup proposes the default map, binds by name, and creates Draft/Paused/Blocked on confirmation with explicit positions in slot order. Re-run reconciles the map against the live team: missing states (offer create), positions contradicting slot order (offer reposition), renames (id bindings hold, doctor reports drift). Validate against real team states before mutating and fail closed naming what is missing; never rename, delete, or touch a state outside the map. Two slots may name one state, disambiguated inbound by carrier label. tbd doctor prints the resolved slot table offline.

Changes what a board looks like, so it is opt-in per repository. Depends on Phase 3.
