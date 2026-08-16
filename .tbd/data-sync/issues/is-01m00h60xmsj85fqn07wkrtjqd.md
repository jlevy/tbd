---
type: is
id: is-01m00h60xmsj85fqn07wkrtjqd
title: Stop-event completion gate for Claude Code and Codex
kind: feature
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:18.484Z
updated_at: 2026-08-16T00:13:40.105Z
extensions:
  linear:
    id: 5864358b-05bd-42b9-b41e-0cf936aea22e
    linked_at: 2026-08-16T00:13:40.105Z
---
Wire tbd closing --check to Claude Code's Stop event (exit 2 blocks the turn and returns stopReason to the model) and Codex's Stop (continue:false). Cursor's equivalent is stop -> followup_message. Gemini CLI has no blocking stop event and degrades to a reminder.

Two constraints keep it from trapping the agent: (1) block on inaction, not on failure — exit 2 only when no sync has been attempted since the last bead mutation, because an agent cannot fix an expired credential by trying harder; (2) fire at most once per session, keyed on session id plus sync-branch tip.

Build this last: enforcing a protocol agents have not been taught produces blocked turns.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §6, §6.1
