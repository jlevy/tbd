# TODO

Top-level state: what ships next, what is blocked on a decision, and the epics and specs
in flight. Everything actionable lives in beads; this file is the map, not the backlog.
Historical detail moves to [TODO.archive.md](./TODO.archive.md).

Beads are the source of truth.
`tbd list --status open`, `tbd show <id>`. The 0.7.0 snapshot further down dates to
2026-08-16; it is historical, not the current shipping gate.
Release and plan status was reconciled on 2026-09-16 against `main` at `a8167a2e`, the
published package, active specs, and all beads.

## Current Release: get-tbd 0.9.0

**0.9.0 is published and verified.** PR #299 merged at `f005c19d`; the tag, GitHub
release, and npm package were published on 2026-09-16. The installed CLI is 0.9.0, npm
reports 0.9.0 as `latest`, and the repository remains on f08. PR #300 then refreshed the
repository’s generated setup surfaces at `a8167a2e`.

Release bead `tbd-lz1q` records the end-to-end evidence: full local, downstream, and
live Linear validation; exact-SHA `main` CI; the release workflow; and a public
exact-version install with npm and SLSA attestations.
PR #298 closed the former release blockers `tbd-bdkj`, `tbd-s4kb`, and `tbd-od0z`: the
stability branch landed, the mixed-version gate established 0.9.0 as the minimum
integration-sync writer, and exact Linear slots now converge.

The operational compatibility rule is release-critical even though the format did not
change: **upgrade every clone that runs `tbd integration sync` to 0.9.0 before it syncs
again.** Older 0.8.1 writers can still project legacy Todo/Canceled state; 0.9.0 repairs
that state after the older writer stops, but the versions are not safe concurrent
integration-sync writers.

Development is now 0.9.1-dev.
PR #301 hardens formal stacked-PR discovery and recovery; the senior review and all four
remediation items are attached to that PR. Remaining stability-sprint, spec-lifecycle,
one-sync-engine, coordination, and test-reliability beads are post-0.9.0 work, not
retroactive release blockers.

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
[valid-2026-08-16-linear-integration-live.md](./docs/project/specs/done/valid-2026-08-16-linear-integration-live.md).

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

Selected current epics (query beads for the complete set):

- **`tbd-ct4z`** — September stability sprint: spec lifecycle, triage views, the bulk
  contract, and tracker convergence.
  The 0.9.0 release gates are closed; later phases remain active
- **`tbd-bcss`** — Sync convergence, lock recovery, and gate integrity.
  The release convergence fixes shipped; residual stability work remains
- **`tbd-ewsw`** — GitHub CLI hardening and stacked-PR support.
  Core support shipped in 0.9.0 and PR #301 hardens it; fresh-machine QA remains
- **`tbd-khi1`** — Incremental bead coordination and native comments
- **`tbd-dzme`** — External sync and traceability (prime, claim, checkpoint, Linear
  visibility). Phases 1–2 shipped; phase 3 is the current front
- **`tbd-f2kv`** — Actor axis and board projection.
  Core behavior shipped; residual identity UX remains
- **`tbd-pnhv`** — Rust guideline extraction, migration, and consistency
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

All plans under [docs/project/specs/active/](./docs/project/specs/active/) were checked
against the complete bead set on 2026-09-16. The count is open or in-progress beads
whose `spec_path` names the plan; it includes descendants and cross-cutting beads, not
only direct epic children.

| Plan | Governing bead | Current state | Open |
| --- | --- | --- | ---: |
| [Transactional mode and agent registration](./docs/project/specs/active/plan-2026-01-19-transactional-mode-and-agent-registration.md) | `tbd-df33` | Unimplemented; design refresh required | 1 |
| [tbd on skills.sh](./docs/project/specs/active/plan-2026-02-08-tbd-on-skills-sh.md) | `tbd-rmd0` | Distribution copy landed; publication proof remains | 1 |
| [kdex knowledge index](./docs/project/specs/active/plan-2026-02-16-kdex-knowledge-index-cli.md) | `tbd-hch7`, `tbd-yk3p`, `tbd-5hv2` | Draft with three planned phases | 3 |
| [Multi-agent skills and hooks](./docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md) | `tbd-g9x7` | In progress | 4 |
| [Agent CLI ergonomics](./docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md) | `tbd-6h1r` | Phase 1 shipped; later work remains | 7 |
| [External tracker integrations](./docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md) | `tbd-gvju` | Phases 1–2 shipped; follow-ons remain | 18 |
| [External sync and traceability](./docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md) | `tbd-dzme` | Phase 2 complete; Phase 1 substantially complete | 29 |
| [GitHub CLI session readiness](./docs/project/specs/active/plan-2026-08-14-github-cli-session-readiness.md) | `tbd-mslv` | Planned and unimplemented | 1 |
| [Actor axis and identity](./docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md) | `tbd-f2kv`, `tbd-p0fe` | Core delivered; residual UX remains | 2 |
| [Tracker state model](./docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md) | `tbd-vp4p` | Core delivered; duplicate projection remains | 1 |
| [Agent session refs and runtimes](./docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md) | `tbd-owa5` | Draft; compatibility gate and implementation remain | 12 |
| [Rust quality floor and guideline mapping](./docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md) | `tbd-pnhv` | In progress | 10 |
| [Sync convergence and release stability](./docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md) | `tbd-bcss` | Release convergence shipped; residual stability work remains | 21 |
| [Incremental bead coordination and native comments](./docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md) | `tbd-khi1` | Active; Phase 1 in progress | 32 |
| [September stability sprint](./docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md) | `tbd-ct4z` | Active; Release 1 shipped, later phases remain | 40 |

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
