---
type: is
id: is-01m00h6rm09zkf3e6n88pzd4ge
title: "Zombie claim sweep: surface stale in_progress claims"
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:42.751Z
updated_at: 2026-08-14T16:20:42.751Z
---
An agent that crashes mid-work leaves a bead in_progress with an assignee forever, and tbd ready hides it from every other agent (ready means open, unblocked, AND unclaimed).

tbd stale already defaults to open + in_progress over 7 days, which is right for open work and far too long for 'an agent is actively holding this'. Surface claim age in prime and in the Linear roll-up, and consider a shorter default for claimed beads.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §7, open question 5
