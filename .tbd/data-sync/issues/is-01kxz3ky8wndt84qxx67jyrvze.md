---
type: is
id: is-01kxz3ky8wndt84qxx67jyrvze
title: Add last_actor field (TBD_ACTOR) set by mutating commands
kind: task
status: deferred
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mgdhc9j6ys7brk59z96e
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:36.380Z
updated_at: 2026-08-10T01:37:18.382Z
---
Optional last_actor frontmatter field (LWW), set from TBD_ACTOR env (default OS user; bridge sets linear-bridge). Minimum-viable actor attribution for watch anti-recursion per pilot spec Design §6 and the monitors research brief. Full per-transition journaling stays in the coordination-kernel follow-up.

## Notes

Deferred legacy scope from the provider plan on PR #197. Do not implement the description as written: core config/schema/tbd-sync coupling is superseded by the active Integration Layer rules. tbd-vm5s will replace, split, close, or re-spec this bead after a provider-isolated Linear plan exists. This is not a PR #205 or watch-release blocker.
