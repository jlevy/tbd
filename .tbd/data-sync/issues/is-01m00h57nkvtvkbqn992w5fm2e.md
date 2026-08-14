---
type: is
id: is-01m00h57nkvtvkbqn992w5fm2e
title: "Add tbd start: the claim primitive"
kind: feature
status: open
priority: 1
version: 3
labels: []
dependencies:
  - type: blocks
    target: is-01m00h5y6q413edk3j82zry3d9
  - type: blocks
    target: is-01m00h5zhsp0wh3nkcydjf0rtk
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:52.626Z
updated_at: 2026-08-14T16:20:17.081Z
---
One verb, symmetric with tbd close: 'tbd start <ids...>' sets status=in_progress and assignee=<resolved agent identity>; '--sync' publishes immediately. Collapses three concepts an agent must currently remember to combine, and gives hooks something unambiguous to check. ready/start/close is a complete teachable vocabulary; 'update --status' is a generic escape hatch that happens to also do this.

Open question: should it sync by default (--no-sync opt-out) or opt in (--sync)?

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md E1, §3.2
