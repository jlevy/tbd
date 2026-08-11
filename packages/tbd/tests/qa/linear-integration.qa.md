---
title: 'QA Playbook: Linear Integration'
description: Manual validation of the Linear integration against a real workspace, covering what automated tests cannot reach
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: Linear Integration

Manual QA for the external tracker integration (Linear) — the surfaces only a real
workspace exercises.
Everything else is automated; see the split in PR
[#206](https://github.com/jlevy/tbd/pull/206)’s validation plan.
Reference docs: `tbd docs` → *External Tracker Integrations* (setup, policy, agent
recipe), and the rollout gates in
`docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md`.

**Purpose**: prove the loop converges against real Linear (real markdown normalization,
real labels, real comment lifecycle), and that the two rollout gates — a forced
both-sides conflict and a two-machine soak — hold.

**Estimated Time**: ~30 minutes (Phases 1–4), +20 for the two-machine soak.

**Prerequisites**: a Linear workspace and team you can write to; a personal API key
(`linear.app/settings/api`) in a **gitignored** `.env` as `LINEAR_API_KEY=…`; the
`integrations:` block in `.tbd/config.yml` per the manual.
Use a scratch team or the pilot project — the bulk guard and `--dry-run` are your safety
rails.

* * *

## Current Status (Last Update 2026-08-11)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1: Setup & convergence | ✅ Passed | Run live on the `tbd` pilot, 2026-08-11 |
| Phase 2: Comment round-trip | ✅ Passed | Engine + e2e automated; live outbound verified 2026-08-11 |
| Phase 3: Forced conflict (rollout gate) | ⏳ Pending | Required before enabling sync in shared repos |
| Phase 4: Orphan handling | ⏳ Pending |  |
| Phase 5: Two-machine soak (rollout gate) | ⏳ Pending | Required before enabling sync in shared repos |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

* * *

## Phase 1: Setup and convergence

```bash
tbd integration status              # every probe ✓, team resolves
tbd --dry-run integration sync      # review the plan; nothing is written
tbd integration sync --yes          # apply
tbd integration sync                # MUST print: linear: nothing to do
tbd integration sync                # and again — steady state is quiet
```

- [ ] `status` shows configured / credentialed / reachable, and the team name
- [ ] The dry-run plan matches what you expect from the policy (default: open epics +
  active-spec beads, ~10% of open work)
- [ ] Two consecutive syncs report `nothing to do`
- [ ] Spot-check one issue in Linear: managed block present, `tbd://bead/<id>`
  attachment present, human prose outside the block untouched

**Trouble**: credential problems → `status` names the remedy.
A first sync against pre-existing links pushes description convergence once; a second
sync must be quiet — if it is not, capture both runs’ output and file a bug (this exact
loop caught five defect classes during development).

## Phase 2: Comment round-trip

```bash
tbd integration comment <bead> "QA round-trip $(date +%s)"
tbd integration sync                # posts it
```

Then reply to that comment **in Linear**, and:

```bash
tbd integration sync                # pulls the reply
tbd show <bead>                     # extensions.linear.comments has both entries
tbd integration sync                # quiet again
```

- [ ] Outbound comment appears once in Linear (re-syncing does not duplicate it)
- [ ] Inbound reply lands as one entry: id, timestamp, author display name, body
- [ ] No emails or extraneous tracker data anywhere in the bead

## Phase 3: Forced both-sides conflict — rollout gate

Pick a low-stakes linked bead.
Without syncing in between: retitle it in Linear, then give the bead a *different* new
title locally (`tbd update <bead> --title …`), then:

```bash
tbd integration sync                # reports: title diverged; <winner> kept
```

- [ ] Exactly one conflict reported, winner per `tie_break` (default: newest)
- [ ] A **tbd sync conflict** comment appears on the Linear issue, naming both values
- [ ] The losing local revision is in `attic/conflicts/` (when local lost)
- [ ] Resolve the comment in Linear; next sync is quiet; the comment is NOT pulled into
  the bead (conflict reports are bridge artifacts, not content)

## Phase 4: Orphan handling

Archive one linked issue in Linear, then `tbd integration sync`:

- [ ] The link is reported orphaned; the bead is **not** deleted or closed
- [ ] `tbd integration unlink <bead>` clears it; sync stays quiet afterward

## Phase 5: Two-machine soak — rollout gate

Two clones of the repo (or two machines), both configured with the key:

1. Clone A: `tbd update <bead1> --title "from A"` → `tbd sync`
2. Clone B (without pulling first): `tbd integration comment <bead2> "from B"` →
   `tbd sync`
3. Both clones: `tbd sync` twice more, alternating.

- [ ] No echo: neither clone re-pushes or re-pulls the other’s already-applied change
- [ ] No ping-pong: three alternating syncs end with both clones quiet
- [ ] Bridge records merged cleanly (no conflict markers under `.tbd/data-sync/bridge/`
  on the sync branch)
- [ ] Comments from both clones appear exactly once on both sides

## Cleanup

Delete any QA comments/issues created in Linear; `tbd integration unlink` any scratch
links. Nothing else persists — beads touched during QA carry only their normal history.

## Related

- Automated coverage this playbook deliberately does not repeat: the engine matrix,
  crash replay, merge-layer, and real-binary e2e suites under `packages/tbd/tests/` (see
  `integrations-*.test.ts`, `integration-cli-e2e.test.ts`).
- `scripts/repro-migration-commit.sh` — historical repro harness for the (now closed)
  sync-migration flake.
