---
type: is
id: is-01m2egx9ye6n87mfbmq7txd3y9
title: "GH #180 remaining asks: Codex hook key deletes user .codex/ hooks; prune, collision warning, shared spec, opt-out"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-5
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:18.509Z
updated_at: 2026-09-13T23:16:18.509Z
---
GH #180 asks the stability plan's Phase 5b does not cover, split out so the narrowing is explicit:
- Bug: the Codex hook upsert treats any hook whose command contains '.codex/' as tbd-owned (setup.ts:1219-1222 isTbdOwned, :1251 removeCodexHooks), so `tbd setup --auto` deletes a user's own Codex hooks under .codex/. Use an exact tbd marker.
- Prune stale tbd hooks on the Claude side on refresh.
- Warn when a non-tbd hook collides with a tbd event.
- One hook spec shared by the Claude and Codex surfaces (today built separately).
- An opt-out flag, and a --dry-run diff of hook changes.
