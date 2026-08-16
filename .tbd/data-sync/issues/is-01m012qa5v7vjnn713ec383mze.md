---
type: is
id: is-01m012qa5v7vjnn713ec383mze
title: Support Linear delegate as the agent gesture (not assignee)
kind: feature
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies:
  - type: blocks
    target: is-01m010epmrrmp2s67x1pe8xqa3
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T21:26:50.810Z
updated_at: 2026-08-16T00:14:19.706Z
extensions:
  linear:
    id: c8f8e501-c470-41bb-b12c-cd0116a11b3c
    linked_at: 2026-08-16T00:14:19.706Z
---
ECOSYSTEM SURVEY (2026-08-14): Linear's agents directory lists 27 agents — Codex, Cursor, GitHub Copilot, Devin, Factory, Sentry Seer, Charlie, and Cyrus ('your Claude Code powered Linear agent that runs anywhere'), plus Tembo ('delegate work to any coding agent'), which occupies the same architectural slot a tbd bridge would.

All of them are triggered by DELEGATION or @MENTION. None by labels.

The key platform fact: 'delegate' is a SEPARATE FIELD from 'assignee' by design — 'the assignee remains responsible for the work, while the agent contributes on their behalf.' An issue can carry a human assignee AND an agent delegate at once. It is filterable in custom views, search, and Insights. Agents are NOT billable seats.

CORRECTION to earlier design: §4.4 option (a) proposed mapping an agent alias to a bot user in ASSIGNEE. That is the wrong shape — it fights the platform's ownership model and costs a seat, where delegate agrees with it and does not.

Work:
- policy.inbound.when gains 'delegate' alongside 'labels' and 'assignee'.
- The adapter must read Issue.delegate (it currently reads only assignee).
- Consider projecting agent presence outward as delegate rather than assignee once an agent identity exists (tbd-f39i).

ALSO: Linear's custom Triage rules can route on label AND delegate to an agent in one flow. So for teams already using Triage, 'label tbd-take -> agent picks it up' is configuration, not software. Document that before building the label scanner; the scanner still earns its place for teams not on Triage and for mode: report.

Being a real Linear agent (actor=app + AgentSession) remains a separate, larger product: OAuth app, public endpoint, 10-second acknowledgement budget. The mirror needs none of it and the two can coexist — tbd projects durable bead state, an agent session carries live conversation. Note AgentSession has moved (AgentSessionUpdate exists, AgentSessionEvent webhooks revised, AgentSession.type deprecated); re-probe before building.

Research: research-2026-08-09-linear-task-surfaces.md §6.4a; research-2026-08-14-agent-sync-protocol-and-hooks.md §4.4, §4.8
Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 3
