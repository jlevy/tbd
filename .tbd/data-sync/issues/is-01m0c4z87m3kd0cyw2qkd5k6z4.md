---
type: is
id: is-01m0c4z87m3kd0cyw2qkd5k6z4
title: "tracker: actor axis (assignee/delegate) and board projection"
kind: epic
status: in_progress
priority: 0
version: 7
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
docs:
  - path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
    role: design
  - path: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md
    role: research
assignee: josh
labels: []
dependencies: []
created_at: 2026-08-19T04:37:46.867Z
updated_at: 2026-09-06T17:33:31.484Z
extensions:
  linear:
    id: 4a516464-c913-4c5d-8ef4-63a7f36101be
    linked_at: 2026-08-19T04:38:20.878Z
---
The second of two axes tbd collapses into single fields. Sibling: tbd-og20 (state axis: resolution, hold, name-based Linear mapping). Same file format, same schema module, same adapter — planned as a pair, tracked separately because they were found separately.

ACTOR AXIS (#246, PR #247)
assignee: z.string() maps to Linear's assigneeId alone. Linear has two actor fields — assignee (accountable) and delegate (acting) — and its agent platform hangs off the second. Measured on a ~900-bead repo where agents do the work: assignee used on ZERO beads, because the human is constant (carries no information) and the agent is inexpressible. delegateId, agentSession, app:assignable, actor=app appear in zero files in the dist.
Adds delegate beside assignee, plus an actor 'kind' on user_map so 'never publish this actor' is a property of the actor rather than its absence from a table. Governing rule: issues in Linear are managed per human, not per agent.

BOARD PROJECTION (PR #247)
Backlog / Draft / Todo / In Progress / Paused / Blocked / Done / Canceled, keyed by an optional state_map over a named slot vocabulary. Omitting state_map reproduces today's behavior exactly — no extra states, no prompt, no config format bump. Draft-vs-Todo is readiness (already computed); Paused-vs-Draft is started_at. Backlog-vs-Draft is NOT derivable and is a human-owned refinement tbd must preserve. Provisioned and verified on a real 96-issue team.

STATUS: PR #247 stacks on PR #245; retarget to main once #245 merges. Depends on tbd-og20's name-based state resolver. Downstream consumer: finterm-main's Linear rollout (fin-8sdo / fin-6242).

## Notes

2026-09-06 reconciliation: replaced nonexistent combined actor-axis-and-board-projection spec path with the actual actor plan; state sibling is attached as a supporting design. Preserve this live umbrella until residual acceptance is audited, rather than infer completion from closed successor epics tbd-ncux/tbd-og20. Core actor and state behavior shipped; actor UX/migration/diagnostics now owned by tbd-p0fe, session alias precision by tbd-6nmq. State prompts tbd-2qlk and reordering tbd-gfr6 shipped; verify exact shared-state carrier-label round-trip acceptance and reconcile the state checklist. Original description is historical PR247 sequencing, not current implementation status.
