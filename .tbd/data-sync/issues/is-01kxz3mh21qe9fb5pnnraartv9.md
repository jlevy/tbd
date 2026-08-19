---
type: is
id: is-01kxz3mh21qe9fb5pnnraartv9
title: "Phase 4 (deferred): webhook daemon, Linear Agents sessions, comments, deps, GitHub adapter"
kind: task
status: closed
priority: 3
version: 6
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies: []
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:55.616Z
updated_at: 2026-08-15T05:33:51.907Z
closed_at: 2026-08-15T05:33:51.907Z
close_reason: "The legacy PR #197 integration design was superseded by the active external-tracker plan and the production implementation merged in PR #206."
---
Holding bead for explicitly-deferred pilot follow-ups per spec Phase 4: GitHub TrackerAdapter — expected first and most mechanical follow-up since all provider-facing seams (bridge commands, config, per-provider state layout, canonical mapping types) ship generic in the pilot; Symphony-style webhook/daemon transport (needs public HTTPS endpoint); Linear Agents AgentSession integration (OAuth actor=app; delegate → bead → activities); comments ↔ notes sync; dependency/sub-issue mapping; claim/lease primitives (coordination-kernel follow-up spec). Split into real beads when the pilot ships.

## Notes

Deferred legacy scope from the provider plan on PR #197. Do not implement the description as written: core config/schema/tbd-sync coupling is superseded by the active Integration Layer rules. tbd-vm5s will replace, split, close, or re-spec this bead after a provider-isolated Linear plan exists. This is not a PR #205 or watch-release blocker.
