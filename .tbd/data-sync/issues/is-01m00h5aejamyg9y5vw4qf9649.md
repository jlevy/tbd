---
type: is
id: is-01m00h5aejamyg9y5vw4qf9649
title: tbd prime reports claimed work and sync freshness
kind: feature
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:55.474Z
updated_at: 2026-08-14T17:25:13.295Z
---
prime prints installation status, three counts, and a large static document, but not the two things that would change an agent's next action: (1) which beads this agent identity already claims — the resume case, and what a compaction destroys; (2) how long since the last successful sync, and whether Linear is enabled and current.

prime is the one output every session-start hook pipes into context on every platform, so it is the highest-leverage place for anything an agent must know.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md E5
