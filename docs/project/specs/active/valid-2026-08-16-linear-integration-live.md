---
title: Linear Integration Live QA
description: Repeatable live validation of the Linear integration against a real workspace—provisioning, two-way field sync, conflicts, comments, the archive lifecycle, and failure recovery
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: Linear Integration Live

Manual QA for the Linear integration against a **real workspace**. Everything here was
either missed by the automated suite or can only be proven against the live API.

**Purpose**: prove that a repository can be onboarded, synchronized both ways, and left
in a settled state that costs nothing to re-run—and that the failure paths degrade the
way they are documented to.

**Estimated Time**: ~30 minutes (~10 provisioning, ~15 round trips, ~5 cleanup).

> This is a manual test.
> The mock server covers the same shapes, but the recurring lesson of this integration
> is that **a mock is only as good as the constraints it models** — every defect found
> live came from the mock being kinder than Linear.
> Run this before any release that touches sync behavior.

* * *

## Current Status (Last Update 2026-08-16)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1: Preconditions | ✅ Passed | 3 repos, team `OS`, project per repo |
| Phase 2: Provisioning | ✅ Passed | Idempotent; project + labels |
| Phase 3: Two-way field sync | ✅ Passed | push, pull, settle |
| Phase 4: Conflicts | ✅ Passed | local kept, loser archived, comment posted |
| Phase 5: Comments | ✅ Passed | both directions, no duplication |
| Phase 6: Cost and settling | ✅ Passed | `nothing to do` on consecutive runs |
| Phase 7: Failure recovery | ✅ Passed | free-tier cap parked then converged |
| Phase 8: Cleanup | ✅ Passed | probes removed |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

## Phase 0: What you need

- A Linear workspace and a personal API key in a **gitignored** `.env`
  (`LINEAR_API_KEY=lin_api_...`). Never commit it, never paste it into an agent.
- A repository with `integrations.linear` configured and `on_tbd_sync: 'off'` so every
  sync in this playbook is explicit.
- A locally built CLI: `pnpm build`, then drive it as
  `node packages/tbd/dist/bin-bootstrap.cjs`. Do **not** use a globally installed `tbd`
  unless its version can read the repository format.

**Rate limits.** A quiet sync costs `2 + N` requests for `N` mirrored pairs.
A personal API key is capped at **2,500/hour**, measured identically on the Free and
Basic plans — Linear’s docs say 5,000 for an API key, so treat the header as the
authority and the doc as wrong.
Upgrading the plan does not buy headroom.
Check it before a large run:

```bash
curl -s -o /dev/null -D - -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id } }"}' | grep -i ratelimit-requests-remaining
```

## Phase 1: Preconditions

```bash
tbd integration status
```

**Expect**: `.env` present and gitignored; credential ✓; the configured team reachable.

A team that was **renamed** reports `Linear team not found`. That is correct behavior,
not a bug: `target.team_key` is matched exactly.
Update the config.

## Phase 2: Provisioning

```bash
tbd integration setup --dry-run    # writes nothing
tbd integration setup              # creates what is missing
tbd integration setup              # must print "Already provisioned"
```

**Expect** on a fresh repo: the configured **project** and both labels reported, then
created, then present.
The third run is the idempotence check.

Then confirm in the Linear UI, because this is the part a mock cannot prove:

- `tbd` exists as a **flat** label, not inside a group
- `repo:<name>` exists, also flat
- no label has a `/` in its name

**Known failure, and it should be reported not thrown**: if a label tbd wants already
exists under a different owner, setup reports it `blocked` with the remedy and creates
everything else. It must never half-apply silently.

## Phase 3: Two-way field sync

Pick one linked bead.
Substitute your own ids.

```bash
# a) local -> Linear
tbd update <bead> --title "<original> [local edit probe]"
tbd integration sync                      # expect: push 1
```

Confirm the new title in Linear, then edit it there (UI or API) and pull it back:

```bash
tbd integration sync                      # expect: pull 1
tbd show <bead>                           # title now matches the Linear edit
tbd integration sync                      # expect: nothing to do
```

**Expect**: each direction moves exactly one field, and the third run settles.
A run that keeps pushing a settled pair is the write-loop class this integration has hit
three times — stop and investigate before shipping.

Restore the original title and sync once more.

## Phase 4: Conflicts

Change the *same field* on both sides without syncing in between:

```bash
# in Linear: set the title to "CONFLICT: title set in Linear"
tbd update <bead> --title "CONFLICT: title set locally"
tbd integration sync
```

**Expect**: `push 1, conflicts 1` and a line naming the field and the winner
(`title diverged; local kept` under `tie_break: newest`, local being newer).

Three things must all be true:

1. Linear now shows the winning value.
2. A **conflict comment** was posted to the issue, naming both values and the archive
   path.
3. The **losing value is on disk**, under
   `.tbd/data-sync/attic/<id>_<timestamp>_<field>.yml`, with `winner_source`,
   `loser_source`, and both timestamps.

Nothing may be silently discarded.
Restore the title and sync.

## Phase 5: Comments

Both directions, and the round trip must not duplicate.

```bash
# inbound: comment in Linear as a human, then
tbd integration sync                      # expect: comments in 1
tbd show <bead>                           # the comment appears under extensions.linear.comments
```

**Expect** the comment visible to any agent reading the bead, with `id`, `at`, `author`
(a display name, never an email), and `body`. This is what makes a human’s Linear
comment reach an agent.

```bash
# outbound
tbd integration comment <bead> "Agent reply from tbd."
tbd integration sync                      # expect: comments out 1
tbd integration sync                      # expect: nothing to do
```

**Expect**: the comment on the Linear issue, and the settle run silent.
A second copy on either side means the exactly-once path regressed.

## Phase 6: Cost and settling

```bash
tbd integration sync && tbd integration sync
```

**Expect** both runs `nothing to do`, and **no files written** — check with
`git -C "$(git rev-parse --git-common-dir)/tbd/data-sync-worktree" status --porcelain`.

A settled mirror that rewrites bridge records turns a no-op sync into a commit and a
push. To measure real cost, read `ratelimit-requests-remaining` before and after.

## Phase 7: Failure recovery

Only if you can reach a failure safely — a workspace issue cap is the natural one.

**Expect** when a batch fails partway:

- the first workspace-limit rejection **halts** remaining creates rather than attempting
  each one
- a child whose parent failed is skipped **without** an API call
- every subsequent sync costs roughly one probe, not one request per parked item
- the journal survives, and the whole backlog converges on the first sync after the
  blocker clears, with the journal directory then empty

Verify the journal at `.tbd/data-sync-worktree/.tbd/data-sync/bridge/linear/intents/`.

## Phase 8: Cleanup

Remove probe artifacts so the next run starts clean:

- restore any titles changed in Phases 3–4
- delete the probe comments in Linear, and strip them from the bead’s
  `extensions.linear.comments` (comments union-merge, so deleting only in Linear leaves
  the bead copy)
- resolve the conflict comment in Linear
- archive or delete any probe issues created

## Results log

**2026-08-16** — full pass against workspace `Finterm`, team `OS`, three repositories
(`tbd`, `metaproc`, `metabrowser`) in three projects, 296 issues.

- Provisioning idempotent across all three repos → ✅
- Two-way title round trip on `mp-s901` / `OS-256` → ✅ push, pull, settle
- Conflict on the same field → ✅ local kept, loser archived with provenance, comment
  posted
- Comments both directions → ✅ `comments in 1`, `comments out 1`, no duplication
- Settling → ✅ `nothing to do` on consecutive runs, no files written
- Recovery → ✅ metabrowser’s 32 issues parked on the free-tier cap converged on their
  own once headroom returned; journal emptied
- Packed upgrade proof (`scripts/validate-upgrade-package.mjs`) → ✅ all four scenarios

Defects this playbook has caught, all now fixed: project not provisioned; `max_nesting`
ignored by the full sync; spec permalinks naming the working branch; sync-time dates on
mirrored issues; batch-failure amplification; the managed-block write loop.
