---
type: is
id: is-01m00h43nvt17wxyhxqm88wh3c
title: "[epic] Agent sync protocol: prime, claim, checkpoint, and Linear visibility"
kind: epic
status: open
priority: 1
version: 18
labels: []
dependencies: []
child_order_hints:
  - is-01m00h4kq7ywbxdn9nz2tedv7b
  - is-01m00h4n4v9ej5abttafz79t72
  - is-01m00h4phk5sx8cf4meq0gpk9b
  - is-01m00h4r097kwbjg224wn8xxbk
  - is-01m00h57nkvtvkbqn992w5fm2e
  - is-01m00h5aejamyg9y5vw4qf9649
  - is-01m00h5bwwh3cnhd087t7yc7dx
  - is-01m00h5y6q413edk3j82zry3d9
  - is-01m00h5zhsp0wh3nkcydjf0rtk
  - is-01m00h60xmsj85fqn07wkrtjqd
  - is-01m00h62dhwa0tgqbrxz4sb0sc
  - is-01m00h6mdt1t263xgyn6ht00d5
  - is-01m00h6nssev3wydw37zz68nhn
  - is-01m00h6q764kkt4jekkeqjz5kb
  - is-01m00h6rm09zkf3e6n88pzd4ge
  - is-01m00h74jxrdkgs06btjdx4v22
  - is-01m00h762qx9k4enj3pdk3q75a
created_at: 2026-08-14T16:19:15.771Z
updated_at: 2026-08-14T16:20:56.535Z
---
Make Linear show what every agent is doing right now, from a small set of mirrored issues.

Research: docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md

Audit findings (measured 2026-08-14 against this repo's 1,681 beads):
- F1: the default policy selects 114 of 254 active beads (45%), not the ~10% claimed in setup-linear and policy.ts.
- F2: 44 of those 114 sit at nesting depth 3 and are skipped under max_nesting: 2, so 114 selected produces 70 Linear issues.
- F3: 8 of the 14 in_progress beads are not selected, so in-flight work is invisible in Linear.
- F4: 0 of 1,681 beads have ever carried an assignee; there is no claim or presence signal at all.
- The SessionStart hook script exits 1 in this environment (PATH prepend shadows Node 22 with Node 20) and fails silently.

The sync mechanism is complete and safe to call from any agent; what is missing is when it runs and what it says.
