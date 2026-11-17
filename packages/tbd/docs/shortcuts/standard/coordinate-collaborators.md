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
  exchange with. There `tbd sync --pull` reports `Failed to pull` and changes nothing,
  and `tbd sync` commits the bead data locally, then reports `Push failed`; both exit 1.
  Expect those failures in such a clone.

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

The **coordinator** is the session that delegated the work, or, when no session did, the
person accountable for the bead: its `assignee`, otherwise the user.
A coordinator decides in each brief who updates beads and who runs `tbd sync` (the
Boundaries item in step 4 of `tbd shortcut delegate-to-subagents`). A sub-agent syncs
its own bead updates unless its brief reserves sync for the coordinator; reserve both
for the coordinator when one writer on the bead data is wanted.
Give writers disjoint files or separate worktrees.

## Claim Before Editing

```bash
tbd sync --pull                      # Receive the other clones' claims
tbd show <id> --json
tbd start <id> --as <distinct-name> --json
tbd sync                             # Publish this claim to the other clones
```

`tbd sync --pull` only fast-forwards.
In a clone that has the sync remote, it fails with `Failed to pull` when unsynced local
bead writes overlap incoming ones, for example after a `tbd create` in each clone; run
`tbd sync` instead, which commits, merges, and pushes.

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

## When Separate Clones Both Claim

`tbd start` sees only the clone it runs in, so two clones that have not exchanged a
claim can both get `claimed` for one bead.
When their syncs meet, the merge keeps one `delegate` and archives the other in the
attic. It compares the two copies’ bead-level `updated_at`, which any later write to the
bead moves and a conflict merge restamps, so which claim is kept depends on the order of
the syncs and on later writes, not only on when each claim was made.
Do not predict the result; read `delegate`. Only a clone whose sync merges the
conflicting copies is told, by a summary such as
`(1 conflict resolved, archived in the attic)`, and its claim may be the one kept.
A clone that synced earlier brings in the result on its next sync without reporting a
conflict, even when that replaces its `delegate`.

When collaborating across clones:

- Run `tbd sync --pull` immediately before the claim and `tbd sync` immediately after
  it, as the claim block does, so the window for a second claim stays short.
- After every later `tbd sync` or `tbd sync --pull` while you work on the bead, re-read
  `delegate` with `tbd show <id> --json`. If it no longer names you, stop editing and
  ask the coordinator.
  Do not claim the bead back.
- If a sync reports a resolved conflict while you hold a claim, run
  `tbd attic list <id>`. A `delegate` entry means another collaborator also claimed the
  bead and may not know which claim was kept; `tbd attic show <id> <timestamp>` prints
  the claim that lost under `Lost value`, with the timestamp from
  `tbd attic list <id> --json`. Tell the coordinator, or that collaborator, before you
  continue, even when `delegate` still names you.

## Publish Checkpoints

After each commit, and before a handoff or session end, the collaborator who owns bead
updates records the commit or PR, what is pending (CI or review), and the next owner in
the bead’s notes, then runs `tbd sync`. `tbd update <id> --notes <text>` and
`--notes-file <path>` replace the notes rather than appending, so read them with
`tbd show <id>` first and write back the whole text.
Close beads at the step the session closing checklist (`tbd closing`) gives, as in any
session; the notes keep pending CI or review visible after the bead closes.

At a handoff between overlapping collaborators, the outgoing collaborator records its
checkpoint, reassigns the bead with `tbd update <id> --delegate <resolved-name>` for the
incoming collaborator, and syncs.
The incoming collaborator runs `tbd sync --pull`, re-reads the bead, its notes, and the
branch or PR they reference, and runs the claim steps above, expecting `already yours`.
It acknowledges the handoff by adding a line to the notes saying it took the bead over,
then syncs before editing.

## Take Over Deliberately

Do not infer abandonment from elapsed time.
The coordinator confirms that the prior collaborator stopped, re-reads the bead, records
the reason in its notes (read first, as above), and changes `delegate` explicitly:

```bash
tbd whoami --as <incoming-name> --json  # Resolve and verify a unique recipient name
tbd update <id> --delegate <resolved-name>
tbd sync                              # Publish the reassignment
```

`tbd update --delegate` is an override: it skips the `start` claim guard and stores the
name verbatim, without the normalization `start` applies.
Pass the resolved `name`. After `tbd update <id> --delegate 'Agent Two'`,
`tbd start <id> --as 'Agent Two'` resolves to `agent-two` and reports
`already claimed by Agent Two`. The incoming collaborator then runs the claim steps
above; on a bead still in progress, `already yours` is the expected result.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
