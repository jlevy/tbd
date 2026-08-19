---
type: is
id: is-01m00h6mdt1t263xgyn6ht00d5
title: Add a Cursor setup surface (.cursor/hooks.json)
kind: feature
status: open
priority: 3
version: 6
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:38.457Z
updated_at: 2026-08-16T00:13:42.986Z
extensions:
  linear:
    id: d36968b7-cdaf-406f-bbf9-26fbdeb78ea6
    linked_at: 2026-08-16T00:13:42.986Z
---
Cursor hooks are production, not beta: .cursor/hooks.json (project) or ~/.cursor/hooks.json (user). sessionStart returns additional_context; stop returns followup_message, which auto-continues the agent and is Cursor's analogue of continue:false; beforeShellExecution returns {permission: allow|deny|ask}. Event names are camelCase and the payload contract differs from Claude/Codex, so this needs its own adapter script rather than a copy.

tbd installs nothing for Cursor today even though Cursor reads AGENTS.md and .agents/skills/. Adds a 'cursor' entry to the setup surface registry.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §2.4, §6
