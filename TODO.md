# TODO

Top-level state: what ships next, what is blocked on a decision, and the epics and specs
in flight. Everything actionable lives in beads; this file is the map, not the backlog.
Historical detail moves to [TODO.archive.md](./TODO.archive.md).

Beads are the source of truth.
`tbd list --status open`, `tbd show <id>`. The release snapshot below dates to
2026-08-16; it is historical, not the current shipping gate.
Coordination documentation was reconciled on 2026-09-10; unrelated release/backlog items
were not re-audited.

## Agent coordination rollout

The
[September research](./docs/project/research/current/research-2026-09-06-bead-agent-coordination.md)
maps the existing plans to their owners and adds current watch, claim, comment,
recovery, and Linear-delivery findings.
The
[phased coordination plan](./docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md),
tracked by `tbd-khi1`, sequences five independently useful releases: stabilize existing
contracts, add native comments with manual Git exchange, automate Git transport, project
to Linear, and integrate portable workers.
Git transport and Linear projection can proceed independently after native comments; the
mixed human pilot has its own gate.
Each phase has acceptance and recovery criteria.
Implementation is underway: provider-comment recovery has landed in the stack, and the
native record/storage plus inventory/transition foundations are implemented in PRs #282
and #283. Those native modules remain internal and dormant in f08; Git-operation guards,
recovery integration, format activation, commands, and comment-aware watch reporting are
still open.
Existing transaction, tracker, traceability, actor, state, and runtime scopes
retain their owners.
Three superseded research briefs and January’s abandoned outbox proposal are archived
with successor links.
Actor-core delivery is distinct from residual UX (`tbd-p0fe`); runtime refs require the
explicit compatibility decision in `tbd-i0de`.

## Historical release snapshot: get-tbd 0.7.0 (the f08 release)

Plan:
[plan-2026-08-15-f08-release-rollout.md](./docs/project/specs/done/plan-2026-08-15-f08-release-rollout.md).
That document owns the mechanics; this is the status.

**Ready.** Everything is merged and CI is green on `main`. Two independent checks pass:
the packed upgrade proof across all four scenarios
(`packages/tbd/scripts/validate-upgrade-package.mjs`), and the live integration QA end
to end — see
[valid-2026-08-16-linear-integration-live.md](./docs/project/specs/active/valid-2026-08-16-linear-integration-live.md).

The Linear integration **did ship in 0.6.5**
(`tbd integration status|sync|link|unlink| comment`), so 0.7.0 changes a live surface
rather than introducing one.
What is new: `integration setup`, origin labels, honest import dates, and
`policy.archive`. Origin labels are additive — a 0.6.5 user’s linked beads simply gain
`tbd` and `repo:<name>` on the next sync — so there is no migration, but the release
notes must describe real fixes to a shipped integration, not just new features.

Blocking the tag:

- [ ] `tbd-62a5` — flip the two goldens this release *un*-breaks.
  They will “fail” on success: the doctor’s `Launcher fallback` warning disappears once
  the tagged version can read f08, and `validate-upgrade-package.mjs` regains a genuine
  same-format baseline that no published version can supply today
- [ ] Release notes lead with the two operational facts: pre-0.7.0 clients refuse
  upgraded repositories, and `tbd setup --auto` is a **required** upgrade step
- [ ] Note that repositories pinning `get-tbd` in CI or hygiene tests must bump those
  pins — metabrowser’s own suite pins `0.4.2` and currently blocks its branch

Order matters: **publish 0.7.0 first, upgrade repositories second.** The reverse strands
anyone whose launcher needs the registry fallback.

## Waiting on a human decision

These cannot be closed by writing code.

- **Re-date the 99 issues mirrored before honest dates shipped, or leave them.** They
  carry sync-time `createdAt`, so Linear’s auto-archive will not retire them on their
  real schedule. Cleanest fix is unlink and re-mirror; new work is already correct.
- **`tbd-b7cy`** — whether to create the shared “filter out agent traffic” Linear view,
  and whether labels should be workspace-scoped rather than team-scoped.
  Both are decisions about someone’s workspace, not gaps in the code.

The former `tbd-klgh` user-map blocker is closed: actor-directory resolution supports
assignment without a populated legacy map.
Remaining actor UX is tracked in `tbd-p0fe`.

## Known loose ends

Real, tracked, and not blocking the release.

| Bead |  |
| --- | --- |
| `tbd-3m0j` | **Half-shipped.** Origin labels landed; the origin-scoped inbound scan did not. `isForeignRepoLabel` exists, is documented as the inbound guard, and is called from nowhere. Latent only because project scoping currently hides it |
| `tbd-7q6v` | The suite is load-sensitive well past the timing assertions. Worse: `test:coverage` is `vitest run --coverage && tryscript run …`, so any vitest flake **silently skips all 1,101 goldens**. Fix the `&&` independently of the budgets |
| `tbd-sjil` | Verify orphaned pairs really cost zero requests per sync. Both archive policies assume quiescent pairs are free; if they still cost a fetch, the lifecycle saves nothing |
| `tbd-iqgm` | Comment fetching is not delta-gated, so cost is `2+N` per sync rather than `2+changed` |
| `tbd-fbr6` | `repoUrl` and `prUrls` are rendering code with no data behind them |
| `tbd-1emr` | Sync’s duplicate-link failure names a UUID where doctor names the issue key |
| `tbd-j3q1` | Flaky tryscript: `cli-edge-cases` “Non-existent short ID” collides with did-you-mean suggestions |

## Open epics

Selected epics from the original snapshot (query beads for current status):

- **`tbd-dzme`** — External sync and traceability (prime, claim, checkpoint, Linear
  visibility). Phases 1–2 shipped; phase 3 is the current front
- **`tbd-owa5`** — Agent session refs: link live agent runs from beads, Linear, and
  `tbd web`. New, unstarted; phase 1 is offline and needs no runtime decision
- **`tbd-gvju`** — External tracker integrations (Linear first, GitHub next)
- **`tbd-g9x7`** — Modernize multi-agent skills and hooks setup
- **`tbd-6h1r`** — Agent CLI ergonomics (bulk ops, output contract, sync clarity)
- **`tbd-up8l`** / **`tbd-70dj`** / **`tbd-lizx`** / **`tbd-29vf`** / **`tbd-j89q`** —
  the docs-config redesign arc, phases 1–3 plus the categories decision
- **`tbd-df33`** — Transactional mode and agent registration
- **`tbd-d7za`**, **`tbd-mgnn`**, **`tbd-de2w`** — CLI output consistency, sub-agents
  research review, post-merge ID mapping polish

`tbd list --type epic --status open` for the full set.

## Active plan specs

Plans under [docs/project/specs/active/](./docs/project/specs/active/) include:

- [Incremental bead coordination and native comments](./docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md)
  — stabilization through Git-only and human/agent coordination
- `plan-2026-08-14-external-sync-and-traceability.md` — the four-phase Linear plan
- `plan-2026-08-19-agent-session-refs-and-runtimes.md` — session refs and the runtime
  adapters, from the 2026-08-19 runtime survey
- `plan-2026-08-10-external-tracker-integrations.md` — the integration design it feeds
- `plan-2026-06-13-agent-cli-ergonomics.md` — bulk ops and the output contract

Moving a spec out of `active/` can change an unlinked bead’s eligibility under a
`specs: active` selector.
Already-linked beads remain included for reconciliation; archival alone neither unlinks
them nor signals completion.
Completed work and superseded designs have distinct document statuses.

## Reference

- **[Linear integration design](./packages/tbd/docs/references/linear-integration-design.md)**
  — read before changing sync behavior.
  Every rule is paired with the Linear behavior that forces it
- `tbd docs show setup-linear` — connecting a repository
- [docs/publishing.md](./docs/publishing.md) — release mechanics

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
