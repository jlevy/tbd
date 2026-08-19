---
type: is
id: is-01m0c4z87m3kd0cyw2qkd5k6z4
title: "tracker: actor axis, state model, and default board projection"
kind: epic
status: in_progress
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-board-projection.md
assignee: josh
labels: []
dependencies: []
created_at: 2026-08-19T04:37:46.867Z
updated_at: 2026-08-19T04:37:52.881Z
---
Two orthogonal axes tbd collapses into single fields, plus the board projection they make expressible. Filed as two issues because they were found separately; one design — same file format, same schema module, same adapter, same field-flow machinery.

ACTOR AXIS (#246, PR #247)
assignee: z.string() maps to Linear's assigneeId alone. Linear has two actor fields — assignee (accountable) and delegate (acting) — and its agent platform hangs off the second. Measured on a ~900-bead repo where agents do the work: assignee used on ZERO beads, because the human is constant (carries no information) and the agent is inexpressible. delegateId, agentSession, app:assignable, actor=app appear in zero files in the dist.
Adds delegate beside assignee, plus an actor 'kind' on user_map so 'never publish this actor' is a property of the actor rather than its absence from a table. Governing rule: issues in Linear are managed per human, not per agent.

STATE AXIS (#244, spec on PR #245)
status fuses position, resolution, and hold. No way to say canceled vs done (superseded specs file as Done with a completion date), or begun-then-stopped (deferred overwrites in_progress). Adds resolution, hold, hold_until, started_at, duplicate_of, and name-based Linear state resolution replacing the position tiebreak.

BOARD PROJECTION (PR #247)
Backlog / Draft / Todo / In Progress / Paused / Blocked / Done / Canceled, keyed by an optional state_map on a named slot vocabulary. Omitting state_map reproduces today's behavior exactly — no extra states, no prompt, no config format bump. Draft-vs-Todo is readiness (already computed); Paused-vs-Draft is started_at. Provisioned and verified on a real 96-issue team.

STATUS: both specs drafted. PR #247 (actor + board) stacks on PR #245 (state + spec-lifecycle triage); retarget #247 to main once #245 merges. Downstream consumer: finterm-main's Linear rollout.
