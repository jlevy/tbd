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

Give every independently running collaborator a distinct resolved acting name.
For a flag-based identity, run `tbd whoami --as <name> --json`; for an environment-based
identity, run `TBD_AGENT=<name> tbd whoami --json`. Compare the returned `name` values:
`Agent Two` and `agent-two` both resolve to `agent-two`, so those raw names do not
distinguish collaborators.
A friendly fallback can identify the harness and host rather than one session; do not
rely on it to distinguish two agents on the same host.
Use the exact resolved `name` in `update --delegate` and the handoff record.

When a coordinator delegates work, let the coordinator own bead updates and `tbd sync`
unless the brief explicitly assigns them elsewhere.
Give writers disjoint files or separate worktrees.
All worktrees attached to one clone see the same bead data.

## Claim Before Editing

Use the remote steps when separate clones exchange bead state or project policy requires
remote publication. Explicit project requirements remain authoritative.
Local collaborators in one clone see accepted claims immediately through the shared data
store and need no network sync for that visibility.
Local-only or offline work can omit remote exchange unless project policy requires it.

```bash
tbd sync --pull
tbd show <id>
tbd start <id> --as <distinct-name> --json
tbd sync
```

Read the JSON result instead of relying on the process exit code:

- Proceed when `claimed` contains the requested canonical bead ID, or when `skipped`
  contains that ID with “already yours” and a fresh `tbd show <id>` verifies that
  `delegate` equals this collaborator’s unique resolved acting name.
  For “already yours”, also verify that this is the same collaborator continuing its
  work or an explicit reassignment acknowledged by the incoming collaborator.
  A reused fallback name can hide duplicate agents.
- Every other skip stops work.
  “Already claimed by NAME” means another visible collaborator owns the bead; ask the
  coordinator to reassign scope or make an explicit takeover decision.
- A command error, including failure to acquire or write the shared lock, is different
  from a structured `skipped` result.
  Do not proceed from it.
  Inspect the bead before retrying, especially after a bulk claim where earlier IDs may
  have changed.

For compatibility with scripts that treated `start` as an idempotent command, a
structured skip exits successfully.
Callers that need conflict detection must inspect `claimed` and `skipped`.

## Publish Checkpoints When Replicas Share State

When separate clones exchange bead state or project policy requires publication, the
collaborator who owns tracker updates publishes progress after each commit and before a
handoff or session end.
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
tbd whoami --as <incoming-name> --json  # Resolve and verify a unique recipient name
tbd update <id> --delegate <resolved-name>
tbd sync                              # When replicas exchange state or policy requires it
```

A takeover is an override, so `tbd update --delegate` does not apply the `start` claim
guard and stores the delegate verbatim, without actor-name normalization.
Use the exact resolved `name` after resolving the visible conflict.
The incoming collaborator then re-reads the bead and verifies the “already yours”
acceptance rule above.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
