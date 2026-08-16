---
type: is
id: is-01m019njs4t0yscw608pqmkw77
title: "Research: agent and session identity across coding agents"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/research/current/research-2026-08-14-agent-and-session-identity.md
docs:
  - path: docs/project/research/current/research-2026-08-14-agent-and-session-identity.md
    role: research
refs:
  - kind: pr
    url: https://github.com/jlevy/tbd/pull/232
    title: ids.yml duplicate short-ID fix
    at: 2026-08-15T07:13:26.566Z
labels: []
dependencies: []
parent_id: is-01m00h5y6q413edk3j82zry3d9
created_at: 2026-08-14T23:28:14.116Z
updated_at: 2026-08-15T07:13:28.128Z
closed_at: 2026-08-14T23:28:25.500Z
close_reason: "Research doc landed: docs/project/research/current/research-2026-08-14-agent-and-session-identity.md"
---
Survey of how Claude Code, Codex CLI, Cursor, Gemini CLI, OpenCode, and GitHub Copilot handle agent and session identity, plus platform-side models (Linear app users, GitHub Apps) and standards (OTel GenAI, A2A, SPIFFE/AIMS).

Key findings feeding tbd-f39i:

- Identity is delivered to hooks on stdin, never to the model. tbd's SessionStart script already receives it and discards it unread (setup.ts:265-292).
- Session IDs are opaque and harness-scoped, so they are foreign keys, not a primary key. One session can carry several IDs at once.
- Uncoordinated minting means the bead registry trick does not apply: 6 base36 chars hits a one-in-a-million collision risk at 66 sessions; 9-10 chars is the defensible range.
- Agent ID, name, model, and harness must be four fields, not one string (matches OTel gen_ai.agent.id vs gen_ai.agent.name).
- plan-2026-01-19-transactional-mode-and-agent-registration.md designed `tbd agent register` and was never implemented; its `ag-{slug}-{ulid}` format bakes a mutable name into the ID.

Ends with an explore direction: one small per-session record checked into the sync branch mapping an agent ID to its setup.
