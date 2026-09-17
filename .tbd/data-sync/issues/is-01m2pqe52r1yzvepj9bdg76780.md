---
type: is
id: is-01m2pqe52r1yzvepj9bdg76780
title: "Spec: add a Policy Grants section"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2pqe3j3fncsbcjjwt986cqr
hold: null
hold_until: null
created_at: 2026-09-17T03:44:17.495Z
updated_at: 2026-09-17T03:52:13.225Z
started_at: 2026-09-17T03:45:07.762Z
closed_at: 2026-09-17T03:52:13.224Z
close_reason: Applied to the plan spec on 2026-09-16; verified by grep checklist
resolution: null
duplicate_of: null
---
Mechanism for explicit user grants recorded in a special block within the tbd-managed AGENTS.md block, at setup or later, persisted when tbd upgrades and re-patches agent files. Policies: github-workflows (APIs or MCP tools, recommended), github-editing (gh create/review/edit PRs, recommended), github-merge (recommended only with per-case authorization; unconditional merging without review not recommended unless explicitly granted), subagents (recommended). Cover block format, recording commands, persistence against older tbd, visibility through tbd prime, precedence, and security of repo-controlled grants.
