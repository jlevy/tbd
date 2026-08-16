---
type: is
id: is-01m00h57nkvtvkbqn992w5fm2e
title: "Add tbd start: the claim primitive"
kind: feature
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m00h5y6q413edk3j82zry3d9
  - type: blocks
    target: is-01m00h5zhsp0wh3nkcydjf0rtk
  - type: blocks
    target: is-01m010epmrrmp2s67x1pe8xqa3
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:52.626Z
updated_at: 2026-08-16T00:10:47.121Z
extensions:
  linear:
    id: 4fd428a0-cc81-4317-b53f-78118f9b0b9b
    linked_at: 2026-08-16T00:10:47.121Z
---
One verb, symmetric with tbd close: 'tbd start <ids...>' sets status=in_progress and assignee=<resolved agent identity>; '--sync' publishes immediately. Collapses three concepts an agent must currently remember to combine, and gives hooks something unambiguous to check. ready/start/close is a complete teachable vocabulary; 'update --status' is a generic escape hatch that happens to also do this.

Open question: should it sync by default (--no-sync opt-out) or opt in (--sync)?

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md E1, §3.2
