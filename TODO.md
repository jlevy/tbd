# TODO

Top-level state: what ships next, what is blocked on a decision, and the epics and specs
in flight. Everything actionable lives in beads; this file is the map, not the backlog.
Historical detail moves to [TODO.archive.md](./TODO.archive.md).

Beads are the source of truth.
`tbd list --status open`, `tbd show <id>`. Last reviewed: 2026-08-16.

## Shipping next: get-tbd 0.7.0 (the f08 release)

Plan:
[plan-2026-08-15-f08-release-rollout.md](./docs/project/specs/active/plan-2026-08-15-f08-release-rollout.md).
That document owns the mechanics; this is the status.

**Ready.** Everything is merged and CI is green on `main`. Two independent checks pass:
the packed upgrade proof across all four scenarios
(`packages/tbd/scripts/validate-upgrade-package.mjs`), and the live integration QA end
to end — see
[valid-2026-08-16-linear-integration-live.md](./docs/project/specs/active/valid-2026-08-16-linear-integration-live.md).

The Linear integration is **new in 0.7.0**, not a change to a shipped one: `v0.6.5`
contains the adapter but never wires it into the CLI and never asserts origin labels.
So there is no existing integration to migrate and no label-scheme upgrade to warn
about.

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
- **`tbd-klgh`** — `identity.user_map` is empty, so assignee sync is skipped and every
  sync ends with two warnings.
  Either map the Linear users or decide assignee stays local-only and downgrade the
  message.

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
| `tbd-t9hi` | Research and active-plan docs describe the pre-f08 label scheme. The shipped shape is a bare `tbd` marker plus `repo:<name>`; in-code and reference docs are current |
| `tbd-j3q1` | Flaky tryscript: `cli-edge-cases` “Non-existent short ID” collides with did-you-mean suggestions |

## Open epics

Thirteen open. The ones with active work:

- **`tbd-dzme`** — External sync and traceability (prime, claim, checkpoint, Linear
  visibility). Phases 1–2 shipped; phase 3 is the current front
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

Eighteen under [docs/project/specs/active/](./docs/project/specs/active/). The ones
governing current work:

- `plan-2026-08-15-f08-release-rollout.md` — the release above
- `plan-2026-08-14-external-sync-and-traceability.md` — the four-phase Linear plan
- `plan-2026-08-10-external-tracker-integrations.md` — the integration design it feeds
- `plan-2026-06-13-agent-cli-ergonomics.md` — bulk ops and the output contract

Specs archived out of `active/` stop being mirrored to Linear, which is the intended
signal that they are done.

## Reference

- **[Linear integration design](./packages/tbd/docs/references/linear-integration-design.md)**
  — read before changing sync behavior.
  Every rule is paired with the Linear behavior that forces it
- `tbd docs show setup-linear` — connecting a repository
- [docs/publishing.md](./docs/publishing.md) — release mechanics
