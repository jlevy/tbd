---
type: is
id: is-01kxz3ky8wndt84qxx67jyrvze
title: Add last_actor field (TBD_ACTOR) set by mutating commands
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mgdhc9j6ys7brk59z96e
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:36.380Z
updated_at: 2026-07-20T06:33:10.708Z
---
Optional last_actor frontmatter field (LWW), set from TBD_ACTOR env (default OS user; bridge sets linear-bridge). Minimum-viable actor attribution for watch anti-recursion per pilot spec Design §6 and the monitors research brief. Full per-transition journaling stays in the coordination-kernel follow-up.
