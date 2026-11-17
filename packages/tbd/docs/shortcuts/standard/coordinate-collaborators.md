---
title: Coordinate Collaborators
description: Opt-in claim protocol for several agents or people working from one clone or several replicas
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Use this shortcut when several independently running collaborators may choose or work on
beads at the same time.
A single agent, sequential handoff, read-only task, or small change does not need this
protocol. The project can use beads without adopting it.

The protocol prevents the common duplicate-work case when collaborators can exchange
bead state before editing.
It is advisory. Linked worktrees in one clone share bead data and its lock; separate
clones can still race until they sync.
It does not create a distributed lease or decide that an old claim is abandoned.

## Assign Ownership

Give every independently running collaborator a distinct acting name with `--as` or
`TBD_AGENT`. Check it with `tbd whoami`. A friendly fallback name can identify the
harness and host rather than one particular session, so do not rely on the fallback to
distinguish two agents on the same host.

When a coordinator delegates work, let the coordinator own bead updates and `tbd sync`
unless the brief explicitly assigns them elsewhere.
Give writers disjoint files or separate worktrees.
All worktrees attached to one clone see the same bead data.

## Claim Before Editing

Use the remote steps only when collaborators use separate clones and the project wants
their bead state exchanged.
Local collaborators in one clone see accepted claims without a network sync.

```bash
tbd sync --pull
tbd show <id>
tbd start <id> --as <distinct-name> --json
tbd sync
```

Read the JSON result instead of relying on the process exit code:

- Continue only when `claimed` contains the requested ID.
- `skipped` with “already claimed by NAME” means another visible collaborator owns the
  bead. Do not start duplicate work; ask the coordinator to reassign scope or make an
  explicit takeover decision.
- `skipped` with “already yours” is an idempotent repeat only when the acting name is
  unique to the current collaborator or this is a known continuation.
  A reused fallback name can hide a duplicate agent.
  Re-read the bead before continuing.
- A command error, including failure to acquire or write the shared lock, is different
  from a structured `skipped` result.
  Do not proceed from it.
  Inspect the bead before retrying, especially after a bulk claim where earlier IDs may
  have changed.

For compatibility with scripts that treated `start` as an idempotent command, a
structured skip exits successfully.
Callers that need conflict detection must inspect `claimed` and `skipped`.

## Publish Checkpoints When Replicas Share State

When separate clones exchange bead state, the collaborator who owns tracker updates
publishes progress after each commit and before a handoff or session end.
Record the commit or PR, pending CI or review, and the next owner before syncing.
Do not close the bead while acceptance, CI, review, or handoff acknowledgment is still
pending.

At handoff, the recipient refreshes shared state, verifies the bead and referenced Git
state, claims or accepts the explicit reassignment, and acknowledges the handoff before
editing. The outgoing collaborator keeps the pending state visible until that
acknowledgment.

## Take Over Deliberately

Do not infer abandonment from elapsed time.
The coordinator or accountable person confirms that the prior collaborator stopped,
re-reads the bead, records the reason in the bead or handoff, and changes `delegate`
explicitly:

```bash
tbd update <id> --delegate <new-name>
tbd sync
```

A takeover is an override, so `tbd update --delegate` does not apply the `start` claim
guard. Use it only after resolving the visible conflict.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
