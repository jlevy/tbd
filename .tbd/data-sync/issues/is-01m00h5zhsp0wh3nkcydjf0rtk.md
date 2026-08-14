---
type: is
id: is-01m00h5zhsp0wh3nkcydjf0rtk
title: "tbd closing --check: machine-checkable completion gate"
kind: feature
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies:
  - type: blocks
    target: is-01m00h60xmsj85fqn07wkrtjqd
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:17.081Z
updated_at: 2026-08-14T17:25:13.284Z
---
tbd closing prints prose; a Stop hook needs a decision. Add a mode that inspects local state and exits with meaning: 0 = nothing outstanding; 2 + one-paragraph stderr = beads claimed by this identity are in_progress and the sync branch has unpushed bead changes; 0 + systemMessage = a sync was attempted and failed (environmental, never block on it). Add --json.

This is the single primitive that turns a context-injection reminder into a real gate.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md E6
