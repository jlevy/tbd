---
title: Coordinate Collaborators
description: Opt-in claim protocol for several agents or people working in one clone or in separate clones
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Use this shortcut when several independently running collaborators may choose or work on
beads at the same time.
A single agent, sequential handoff, read-only task, or small change does not need this
protocol. The project can use beads without adopting it.

The protocol prevents the common duplicate-work case when collaborators can exchange
bead state before editing.
It is advisory: it does not create a distributed lease or decide that an old claim is
abandoned.

## Who Sees a Claim

- **Linked worktrees of one clone** (the entries `git worktree list` prints) share bead
  data and its lock. A claim made in one is visible in the others at once, and
  `tbd start` holds the lock while it claims, so of two concurrent claims on one bead
  only one succeeds.
- **Separate clones** see each other’s claims only after both sync: the claiming clone
  runs `tbd sync`, then the other runs `tbd sync` or `tbd sync --pull`.
- **A clone with no remote** (`git remote` prints nothing) has no other clone to
  exchange with. `tbd sync` there still commits the bead data locally, then reports
  `Push failed` and exits 1.

The sync steps in this shortcut are the skill’s ordinary `tbd sync`. Run them by
default.

## Assign Ownership

Give every independently running collaborator a distinct resolved acting name.
For a flag-based identity, run `tbd whoami --as <name> --json`; for an environment-based
identity, run `TBD_AGENT=<name> tbd whoami --json`. Compare the returned `name` values:
`Agent Two` and `agent-two` both resolve to `agent-two`, so those raw names do not
distinguish collaborators.
Without `--as` or `TBD_AGENT`, every session of one harness on one host resolves to the
same `<harness>@<host>` name.
That includes the session identity `tbd whoami --ensure-id` persists: it adds an `id`
and reports `source: session`, but `tbd start` records only the `name`, so neither field
makes two such sessions distinct.
Use the exact resolved `name` in `update --delegate` and the handoff record.

When a coordinator delegates work, let the coordinator own bead updates and `tbd sync`
unless the brief explicitly assigns them elsewhere.
Give writers disjoint files or separate worktrees.
All worktrees attached to one clone see the same bead data.

## Claim Before Editing

```bash
tbd sync --pull                      # Receive the other clones' claims
tbd show <id> --json
tbd start <id> --as <distinct-name> --json
tbd sync                             # Publish this claim to the other clones
```

Check the output of each step:

1. **Before claiming,** read `status` and `delegate` from `tbd show <id> --json`. Stop
   if the bead is closed or `delegate` names another collaborator, whatever the status.
   `tbd start` reports a foreign claim only on an `in_progress` bead; on an open bead it
   replaces a `delegate` set by `tbd update --delegate` or `tbd create --delegate`.
2. **Read the claim result.** `claimed` and `skipped[].id` hold the bead’s display ID
   (`displayId` in `tbd show --json`) whatever ID form you passed.
   - Proceed when `claimed` contains it and the result’s `delegate` equals your resolved
     name. Another `delegate` means the claim ran under another identity, for example
     without the intended `--as`.
   - The reason `already yours` means the bead already records your name.
     Proceed only when you are the same collaborator continuing its work, or the
     incoming collaborator of a reassignment (Take Over Deliberately).
     A reused name can hide a duplicate agent.
   - Every other skip stops work.
     `already claimed by <name>` means another collaborator holds the bead in progress;
     ask the coordinator to reassign scope or decide a takeover.
     `closed — reopen it first` means the bead is closed.
3. **After `tbd sync`,** confirm that `tbd show <id> --json` still reports `delegate`
   equal to your resolved name (the `name` that `tbd whoami --json` prints with your
   `--as` or `TBD_AGENT`).

A command error, including failure to acquire or write the shared lock, is different
from a structured `skipped` result.
Do not proceed from it.
Inspect the bead before retrying, especially after a bulk claim where earlier IDs may
have changed.

For compatibility with scripts that treated `start` as an idempotent command, a
structured skip exits 0, so the exit code does not show a conflict.
Callers that need conflict detection must inspect `claimed` and `skipped`.

## Publish Checkpoints

The collaborator who owns bead updates publishes progress after each commit and before a
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
tbd sync                              # Publish the reassignment
```

A takeover is an override, so `tbd update --delegate` does not apply the `start` claim
guard and stores the delegate verbatim, without actor-name normalization.
Use the exact resolved `name` after resolving the visible conflict.
The incoming collaborator then runs the claim steps above; on a bead still in progress,
`already yours` is the expected result.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
