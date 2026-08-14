---
title: External Sync and Traceability
description: Make tbd sync cheap enough to run constantly, give beads room for external metadata, and make a Linear issue the entry point that links to every doc, issue, and PR behind the work
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: External Sync and Traceability

**Date:** 2026-08-14 (last updated 2026-08-14)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft. Phase 1 is fully specified and independently shippable.
Phase 2 specifies a bead-format bump (`f08`) and is the only phase with a migration.
Phases 3 and 4 are designed here at the level needed to sequence them, and each is
shippable on its own.

**Research:**
[research-2026-08-14-agent-sync-protocol-and-hooks.md](../../research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md)
— every finding cited below (`F1`–`F14`) and every primitive (`E1`–`E17`) is measured or
designed there. This spec sequences that work; it does not re-argue it.

**Tracked as:** epic `tbd-dzme`.

## Overview

Someone should be able to open Linear at any moment, see what every agent on the project
is doing, and click through — to the governing spec, to the research that informed it,
to the GitHub issue that requested it, to the PR that implements it, or into the bead
browser for the full dependency graph.
All of it kept current automatically, with no agent remembering to do anything special.

The audit behind this spec found the sync *mechanism* essentially complete and three
other things missing:

1. **A quiet sync is not quiet.** It rewrites every bridge record, so it commits,
   pushes, and (in this repository) runs the full test suite — while reporting
   `nothingToDo`. Frequent syncing is therefore unaffordable, which blocks everything
   else.
2. **A bead has nowhere to put external metadata.** One `spec_path`, and one
   provider-keyed link namespace that is deliberately single-valued.
   No room for several docs, several GitHub issues, or any PR.
3. **The links a reader would follow do not exist.** Of the click-throughs the goal
   names, one works; two are rendering code with no data behind them; the fourth
   destination has no address.

The phases follow that order because each unblocks the next.

## Goals

- **Make `tbd sync` cheap enough to run on every state transition**: a sync with nothing
  to do should be about two provider requests, zero writes, zero commits, and no push.
- **Make the tracker surface honest**: every `tbd sync` invocation either includes the
  tracker or says that it did not.
- **Give beads durable room for external metadata**, in a way that a future addition
  never needs another format bump.
- **Support one governing doc plus any number of supporting docs** on a bead, and any
  number of external references (GitHub issues, PRs, dashboards).
- **Make a Linear issue a complete entry point**: status, who is working, the docs, the
  issues, the PRs, and a way into the beads.
- Keep everything **provider-neutral**. Linear is the first consumer, not the design
  centre.
- Keep every phase **independently shippable**.

## Non-Goals

- **A GitHub tracker adapter is not in scope here.** Referencing a GitHub issue or PR is
  in scope; bidirectional convergence between beads and GitHub issues is a separate
  decision (see [§Where GitHub fits](#where-github-fits)).
- **No background sync daemon.** Once a quiet sync is nearly free, calling it inline on
  transitions is simpler than owning a process lifecycle, and it preserves the
  git-serialized single-writer property that makes concurrent agents safe.
- **No new presence namespace on beads.** `status` and `assignee` already carry claim
  and actor, and they work precisely because they are single-writer.
- **No webhook receiver.** Polling remains the reconciliation path.
- **No hosted service** and no Linear `actor=app` agent identity.

## Background

The full argument is in the research brief.
The load-bearing measurements, restated so this spec stands alone:

| Measurement | Value |
| --- | --- |
| Beads in this repository / active | 1,681 / 254 |
| Beads the default policy selects for Linear | 114 (45% of active, not the ~10% documented) |
| Of those, skipped at depth 3 under `max_nesting: 2` | 44 |
| In-flight beads not selected | 8 of 14 |
| Beads that have ever carried an `assignee` | **0** |
| Requests for a no-op tracker sync | **`2 + N`** (N = linked beads) |
| Bridge records rewritten by a no-op sync | **all of them** (only `synced_at` differs) |
| Wall time of a git-only no-op sync | 2.9 s, zero commits, no push |

Two mechanisms explain more than they look like they should:

- **`spec_path` propagates to descendants** (`update.ts:129-130`), and `create --parent`
  inherits it. So the `specs: active` selection clause really means *“mirror every
  descendant of every epic with a live spec”* — 79 of the 89 non-epic selected beads
  inherited their spec.
  That is the mechanism behind the 45%.

  Demonstrated while writing this spec, in one command: pointing epic `tbd-dzme` at this
  document with `tbd update --spec` propagated to all 30 children and moved the mirror
  set from **115 to 145 beads**. Nobody decided to mirror thirty more issues; a single
  edit to a parent did it.
  That is the behavior [Phase 3](#phase-3-projection--linear-as-the-entry-point) has to
  fix, and it is why Open Question 3 is not academic.

- **`IssueSchema` parses in Zod strip mode.** An older client silently deletes any bead
  field it does not know, and `tbd sync` rewrites beads during merges routinely.
  This is the constraint that shapes Phase 2.

Two facts about Linear’s containment model shape the multi-repo design (verified against
Linear’s docs and the earlier live probes): **the issue identifier prefix and the
workflow states live on the team**, and **a project can be shared across many teams**
while each issue belongs to exactly one team.
And one more probe, run for this spec: two repositories pointed at one team+project see
each other’s mirrored items in their inbound scans — as importable suggestions under the
default policy, and as a hard failure on every sync under `inbound: auto` (research
§4.5, F15).

## Design

### Approach

Four phases, each shippable, in dependency order:

| Phase | Theme | Ships |
| --- | --- | --- |
| **1** | Operational: cheap, correct, habitual sync | A release where syncing constantly is free and agents claim their work |
| **2** | Schema: room for external metadata (`f08`) | The bead fields everything later renders |
| **3** | Projection: Linear as the entry point | The click-throughs that make review possible |
| **4** | Enforcement and reach | Gates, more agent surfaces, the GitHub decision |

Phase 1 has no dependency on any other phase and delivers the largest immediate change
in agent experience.
Phase 3 depends on Phase 2 for its data.
Phase 4 depends on Phase 1 for its affordability — a completion gate that nags an agent
into syncing, on today’s code, converts every agent turn into a test-suite run.

### Phase 1 design: make a quiet sync quiet

Four defects, each local.

**A quiet sync must write nothing (`F9`).** The apply loop runs over every
synchronizable pair rather than only changed ones (`sync-engine.ts:1097`) and ends by
writing the link record unconditionally with `synced_at: options.now()`. Two candidate
fixes:

1. Write the record only when a field other than `synced_at` differs from the record on
   disk.
2. **Preferred:** drop `synced_at` from `LinkRecordSchema`. It is diagnostic only —
   reconciliation rides on `base` and `remote_updated_at` — and the git commit timestamp
   of the record already answers “when did this last move”.

Option 2 removes the failure mode rather than guarding it, at the cost of a
bridge-record shape change.
Bridge records are machine-written and locally regenerable, so this is far cheaper than
a bead-format change.

**The sync branch must push without parent-repo hooks (`F5`).** tbd already passes
`--no-verify` on its *commits* to the sync branch, and `git.ts:1722` states that intent.
`pushWithRetry` does not do the same, so every push fires `.git/hooks/pre-push` — here,
lefthook’s quality gate, build, and full vitest suite — and again on each
non-fast-forward retry.
The sync branch carries no source code, so no parent-repo pre-push gate has anything to
say about it.

`F5` and `F9` multiply: `F9` guarantees there is always something to push, `F5` makes
every push expensive.
Both must land together for either to matter.

**Comment polling must be delta-gated (`F10`).** A pair whose provider `updatedAt` has
not advanced past the recorded `remote_updated_at` cannot have a new comment, because
Linear bumps `updatedAt` on comment creation.
The delta is already in hand (`sync-engine.ts:513-560`), so restrict the comment fetch
to pairs in it, plus pairs with locally authored comments pending push.

This assumption must be proven in the live-QA runner before the optimization ships.
If it does not hold, the fallback is a periodic full comment reconcile (hourly), not
per-sync polling: the correctness argument for catching a missed comment within the hour
is much weaker than the cost argument against `N` requests every sync.

**Provider metadata must be cached across invocations.** `ensureMeta` caches on the
adapter instance only, so every CLI run re-fetches the team’s workflow states and label
pages — the most expensive query in the set.
An on-disk cache with a TTL, under the gitignored state area, halves what remains once
the above lands.

Target after Phase 1: **a quiet sync is ~2 requests, 0 writes, 0 commits, 0 pushes, and
no parent-repo hooks.**

### Phase 1 design: honest surfaces and habitual claiming

**Every `tbd sync` form must be honest about the tracker.** Today `--issues` silently
excludes it, `--push` silently performs the outbound-only projection that `setup-linear`
warns joiners never to run, `--dry-run` never previews tracker work even though
`tbd --dry-run integration sync` does, and `--status` never reports tracker state.
A natural-looking flag must not be the dangerous one.

**Claiming must become one verb.** `tbd start <ids...>` sets `in_progress` and the
resolved agent identity in one call, symmetric with `tbd close`. The measured evidence
that this is a naming problem rather than a discipline problem: claiming appears in
exactly one table row of one doc tier, the closing protocol appears in all four surfaces
and is obeyed, and zero of 1,681 beads have ever carried an assignee.

Agent identity resolves in order — `--as <name>`, `$TBD_AGENT`, then a derived
`<agent-kind>@<host>` — and stays non-person-identifying by default, consistent with the
existing `user_map` stance.

### Phase 2 design: bead schema and format `f08`

This is the phase that needs the most care, because it is the only one that changes data
other clients read.

#### The constraint

`IssueSchema` is a plain Zod object, so it parses in **strip mode**. Verified by
round-trip probe: a bead carrying `refs:` and `docs:` written by a newer client comes
back from an older client’s parse-and-write with both fields **silently deleted**, while
`extensions:` survives because it is a declared field with opaque contents.

The blast radius is larger than the `f07` config case.
A config strip loses one file’s block on an explicit command; a bead strip loses
metadata across **every bead an old client touches**, and `tbd sync` rewrites beads
during ordinary merges.
This is a data-loss vector, not an inconvenience.

Three layers must change, not one:

| Layer | Today | Needed |
| --- | --- | --- |
| Parse (`IssueSchema`) | Zod strip drops unknown keys | Preserve unknown keys |
| Serialize (`sortKeys`) | Iterates `Object.keys(obj)` — **already correct** | No change |
| Merge (`mergeIssues`) | Starts from `{...base}` then iterates the fixed `FIELD_STRATEGIES` table, so a key added on only one side is never copied | A default strategy for keys outside the table |

#### `f08`: do it once

`f08` should do for beads what `f07` did for config: **make the schema preserve unknown
keys, and bump the format so that pre-`f08` clients fail closed instead of silently
deleting metadata they do not understand.** After `f08`, an additive bead field never
needs another bump.

The migration is **metadata-only** — a stamp, like `f05` and `f07`. No issue file is
rewritten, so the upgrade is abortable by restoring `.tbd/config.yml` and deleting
`$GIT_COMMON_DIR/tbd/layout.yml`.

#### Three linkage concerns, deliberately not merged

The mistake to avoid is one undifferentiated link bag.
There are three distinct things with different resolution rules:

| Concern | Field | Cardinality | Value | Why separate |
| --- | --- | --- | --- | --- |
| **The governing doc** | `spec_path` *(unchanged)* | one | repo-relative path | Load-bearing for selection, propagation, and `list --spec`. Re-homing it is a format break for no gain |
| **Supporting docs** | `docs` *(new)* | many | repo-relative paths | Same repo, so a path is stable where a URL is branch-dependent; `specPermalink` already resolves any path to a branch-correct GitHub blob URL |
| **External references** | `refs` *(new)* | many | absolute URLs | Point outside the repo tree — GitHub issues, PRs, dashboards. Opaque, unresolvable, may 404 independently |

`spec_path` is *the doc this work is defined by*: singular, inherited by descendants.
`docs` is *what else you should read*: plural, local, not inherited.
`refs` is *what else this work touches in other systems*.

```yaml
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
docs:
  - path: docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md
    role: research
  - path: docs/project/architecture/current/arch-testing.md
    role: architecture
refs:
  - kind: pr
    url: https://github.com/jlevy/tbd/pull/222
    title: 'research: Agent sync protocol, hooks, traceability, and Linear visibility'
    at: 2026-08-14T17:12:00Z
  - kind: issue
    url: https://github.com/jlevy/tbd/issues/190
    at: 2026-08-12T09:00:00Z
```

Design decisions, each with its reason:

- **`role` and `kind` are open strings** with known values (`research`, `architecture`,
  `qa`, `design`; `pr`, `issue`, `design`, `other`), not closed enums.
  Same call `WorkflowState.type` gets in the Linear research, for the same reason: an
  unrecognized value should render generically, never fail a sync.
- **Identity is `path` for docs and `url` for refs**, so repeated adds are idempotent
  and the merge is a union keyed on that field.
  `docs: 'union'` and `refs: 'union'` slot straight into the existing `FIELD_STRATEGIES`
  table beside `labels` and `dependencies` — **no new merge machinery** — and two agents
  attaching different PRs concurrently both survive.
- **Provider-neutral by construction.** A ref is a URL with a kind; nothing about it
  knows Linear exists.
  The same field carries a GitLab MR or a Notion page.
- **GitHub issues are `refs`, not `extensions.github`.** `extensions.<provider>` is
  reserved for *tracker identity* — the one external item a bead **is** — and stays
  single-valued by design.
  A bead may reference several GitHub issues that are not its identity; those are
  `refs`. The two coexist without ambiguity, which also means Phase 2 does not block on
  a GitHub adapter.

#### CLI

```bash
tbd ref add <bead> <url> [--kind pr|issue|design|other] [--title "..."]
tbd ref rm <bead> <url>
tbd doc add <bead> <path> [--role research|architecture|qa|design]
tbd doc rm <bead> <path>
tbd show <bead>            # renders both, grouped
```

`tbd ref` and `tbd doc` take bulk arguments like every other mutating command.

### Phase 3 design: make Linear the entry point

Phase 2 supplies data; Phase 3 renders it.
Every item here is a resolver or a renderer — none touches the sync engine.

**Wire the two dead renderers (`F11`, `F12`).** `repoUrl` drives the managed block’s
`Bead:` link and the bead-source attachment; both `planMirror` call sites pass only
`specUrl` and the engine hardcodes `repoUrl: undefined`. `prUrls` renders
`PRs: [#222](…)` complete with a `/pull/(\d+)` label helper, and nothing in `src/` ever
assigns it. Pass a `repoUrl` resolver built exactly as `specUrl` already is
(`integration-runner.ts:110-134` is the pattern), and populate `prUrls` from `refs`.

**Render the whole context block.** The target, every line of which is either already
rendered or one resolver away:

```
⟦tbd⟧
`tbd-dzme` · epic · in_progress · P1
Spec: [plan-2026-08-14-external-sync-and-traceability.md](https://github.com/…)
Docs: [research-2026-08-14-agent-sync-protocol-and-hooks.md](https://github.com/…)
PRs: [#222](https://github.com/jlevy/tbd/pull/222)
Issues: [#190](https://github.com/jlevy/tbd/issues/190)
Children: 30 · 2 in progress · 5 ready · 23 open

In progress now:
  • tbd-774m — A quiet tbd sync must write nothing — claude@host (2h)
  • tbd-7okw — Push the sync branch with --no-verify — codex@ci (11m)

Bead: [tbd-dzme](https://github.com/…) · `tbd show tbd-dzme` · `tbd web --open`
synced 2026-08-14T17:20Z
⟦/tbd⟧
```

The in-flight roll-up replaces `Children: 30 (5 ready)`, which is a count that cannot
answer the question a person opens Linear to ask.
It is self-limiting: only in-flight children are listed.
The `synced` line matters more than it looks — without it, a stale mirror and a quiet
project are indistinguishable.

**Capture the PR ref automatically.** `create-or-update-pr-simple` already holds the PR
URL at its step 6 and only reports it.
Record it as a ref. `tbd sync` may additionally resolve the current branch’s PR
opportunistically via `gh`, recording it when found and staying silent when not — a bead
must never be blocked on GitHub being reachable.

**Give `tbd web` an addressable bead (`F13`).** Read `location.hash` at load, select
that bead, write the hash on selection, so `http://127.0.0.1:PORT/#tbd-dzme` works.
A loopback URL is not shareable between machines, which is fine: it targets the person
who has the repository checked out and wants the dependency graph Linear structurally
cannot render. The managed block renders `tbd web --open` beside the id rather than
pretending a localhost link travels.

**Fix the selection so the mirror is small and current.** Add an attention rule so any
`in_progress` bead joins the mirror regardless of kind, then narrow the standing set to
epics. Today `mirrorSet` applies `statuses` as a global gate over both the kind and spec
rules, so “epics in any active status **or** anything in flight” is inexpressible; one
additive clause fixes that.
Separately, decide whether an *inherited* `spec_path` should select a bead at all — that
single question accounts for 79 of the 89 non-epic selections.

**Support many repositories reporting into one Linear surface.** Three topologies, per
the containment model (research §4.5):

|  | Mapping | Works today? |
| --- | --- | --- |
| Mode 1 | Team per repo, one shared project | **Yes** — scans are team-filtered, so isolation is structural, and the per-team prefix names the repo in every view |
| Mode 2 | One team, one shared project, repo labels | No — needs the two changes below |
| Mode 3 | One team, project per repo, shared initiative | Yes |

Mode 2 is the topology this phase makes first-class, because it is also the answer to
the human-clutter concern:

- **Origin labels.** Every mirrored issue gets a plain `tbd` label and a per-repository
  label in a **Linear label group** named `repo` — the platform’s native namespace
  convention (created as `repo/<name>`; only one label from a group per issue, which
  matches one-repo-per-bead structurally).
  Verified: Linear views support “is not” label negation, so `label is not tbd` hides
  all agent traffic and the `repo` group filter selects one repository.
  The label names the **GitHub repository**: default is the repo name from the origin
  remote via the existing `parseRepoSlug`, the sanitized `owner-name` form on collision,
  `display.id_prefix` when there is no remote, and `integrations.linear.repo_label` to
  override. Applied through the status-carrier machinery that already creates and
  attaches labels regardless of `mirror_labels`.
- **Origin-scoped inbound.** A candidate carrying another repo’s `repo` group label is
  skipped silently — before the per-candidate claim check, so a shared scope neither
  reports nor pays for a sibling’s traffic.
  Untagged (human-authored) items still flow under the inbound policy.

**Changing the mapping must be visible, and one case must stop breaking.** Config is
committed and editable; today a remap splits silently (research §4.6): policy changes
are safe, but a changed `project` leaves old items reconciling in the old project
forever, and a changed `team_key` additionally makes every status push send the new
team’s workflow-state UUID against old-team issues — a repeated per-item failure,
because state ids are per-team.
No migration tooling; instead:

1. The sync report and `tbd doctor` flag linked issues whose team no longer matches the
   configured `team_key`, once, with a count.
2. The engine never pushes a workflow-state id to an issue in a different team than the
   one it was resolved from; it skips the status field for that pair and says why.
3. `setup-linear` documents the semantics: policy changes are safe; `project` and
   `team_key` changes affect new creates only; moving existing items is a deliberate
   operation, not something sync infers.

### Phase 4 design: enforcement and reach

**Enforcement.** `tbd closing --check` gives hooks a machine-checkable answer instead of
prose: exit 0 when nothing is outstanding, exit 2 with a reason when beads claimed by
this identity are `in_progress` and the sync branch has unpushed changes, and exit 0
with a `systemMessage` when a sync was attempted and failed.
That last case is the important one — an agent cannot fix an expired credential by
trying harder.

Wired to Claude Code’s and Codex’s blocking `Stop` event, and Cursor’s `stop` →
`followup_message`. Gemini CLI has no blocking stop event, so it degrades to a reminder.
Two constraints keep the gate from trapping an agent: **block on inaction, never on
failure**, and **fire at most once per session**, keyed on session id plus sync-branch
tip.

**Reach.** A `cursor` setup surface (`.cursor/hooks.json`) and a Gemini CLI surface
(`.gemini/settings.json`), added to the existing `--surfaces` registry.
OpenCode’s hook router is still an upstream feature request; watch it.

**Order matters.** The gate is the last thing to build, not the first.
Enforcing a protocol agents have not been taught produces confused agents and blocked
turns. Fix orientation, teach the protocol, measure whether it is followed, then gate.

### Where GitHub fits

`refs` is **not** a substitute for a GitHub tracker adapter, and it mostly removes the
urgency:

- A *reference* — “this bead’s work landed in #222” — is what the traceability goal
  actually needs, and `refs` covers it with no adapter, no credential, and no
  reconciliation.
- A GitHub *integration* — beads and issues converging bidirectionally, three-way merged
  — is a much larger commitment, and the Linear research’s survey found bidirectional
  sync rare in practice for good reasons.

So: ship `refs` in Phase 2, and treat the GitHub adapter as an independent Phase 4
decision about whether GitHub issues should be an *authoring* surface — not as a
prerequisite for linking.
PR *visibility* in both Linear and beads is delivered by Phases 2 and 3 without it.

### API Changes

**New commands:** `tbd start`, `tbd whoami`, `tbd ref add|rm`, `tbd doc add|rm`,
`tbd closing --check`.

**Changed behavior:** `tbd sync --push` no longer performs an unguarded outbound-only
projection; `tbd sync --issues` states that the tracker was excluded;
`tbd --dry-run sync` previews tracker work; `tbd sync --status` reports tracker state.

**Schema:** `IssueSchema` gains `docs` and `refs` and preserves unknown keys;
`FIELD_STRATEGIES` gains `docs: 'union'`, `refs: 'union'`, and a default for unknown
keys; `LinkRecordSchema` drops `synced_at`; `IntegrationSelect` gains an attention
clause.

**Format:** `f07` → `f08`, metadata-only stamp.

## Implementation Plan

Beads are tracked under epic `tbd-dzme`. Existing bead ids are named; new ones are filed
when the phase starts.

### Phase 1: Operational — cheap, correct, habitual sync

- [ ] `tbd-774m` — a quiet sync writes nothing (`F9`); prefer dropping `synced_at`
- [ ] `tbd-7okw` — push the sync branch with `--no-verify` (`F5`)
- [ ] `tbd-iqgm` — delta-gate comment fetching (`F10`), after proving the `updatedAt`
  assumption in live QA
- [ ] `tbd-9ulk` — on-disk `ensureMeta` cache with a TTL
- [ ] `tbd-71am` — `tbd sync --push` must not silently do the outbound-only projection
- [ ] `tbd-42u4` — `--dry-run` and `--status` cover the tracker
- [ ] `tbd-8ot8` — `--issues` says when it excluded the tracker
- [ ] `tbd-1uep` — fix the comment claiming the fold is off by default
- [ ] `tbd-fnwc` — hook PATH order, local-first resolution, fail loudly
- [ ] `tbd-qd1n` — `tbd doctor` executes the installed hook scripts
- [ ] `tbd-mnci` — `tbd start`, the claim primitive
- [ ] `tbd-f39i` — agent identity resolution and `tbd whoami`
- [ ] `tbd-c4zl` — teach the claim step in all four instruction surfaces
- [ ] `tbd-czhw` — correct the “~10%” claim; document the `max_nesting` skip
- [ ] `tbd-9cf9` — decide on lifting this repository’s `sync_on_tbd_sync: false`
  override

**Exit criteria:** a settled mirror re-synced with no changes performs ~2 provider
requests, writes zero bytes under `bridge/<provider>/links/`, creates no commit, and
performs no push. `tbd start` exists and the claim step appears in all four surfaces.

### Phase 2: Schema — bead metadata and format `f08`

- [ ] `tbd-8ksq` — `IssueSchema` preserves unknown keys; `mergeIssues` carries keys
  outside `FIELD_STRATEGIES`; `f08` migration entry, `CURRENT_FORMAT` bump,
  `describeMigration`, and migration tests
- [ ] `tbd-cak1` — the `docs` field, `tbd doc add|rm`, and `docs: 'union'`
- [ ] `tbd-vo8b` — the `refs` field, `tbd ref add|rm`, and `refs: 'union'`
- [ ] `tbd show` renders governing spec, docs, and refs, grouped
- [ ] `tbd-u25v` — decide whether an inherited `spec_path` should select a bead

`tbd-8ksq` gates the other two: adding a field before the schema preserves it would ship
a field that older clients delete.

**Exit criteria:** a bead written by this tbd carrying `docs`, `refs`, and a
hypothetical future field survives a parse-write-merge round trip with all three intact;
a pre-`f08` client refuses the repository with the upgrade message rather than stripping
anything.

### Phase 3: Projection — Linear as the entry point

- [ ] `tbd-fbr6` — wire `repoUrl` and `prUrls` (`F11`, `F12`)
- [ ] `tbd-o6o6` — managed-block roll-up: in-flight children, actor, docs, refs,
  synced-at
- [ ] `tbd-wmjb` — capture the PR ref automatically from the PR shortcut
- [ ] `tbd-kt7z` — addressable beads in `tbd web` (`F13`)
- [ ] `tbd-9j5a` — attention-based selection; narrow the standing set to epics
- [ ] `tbd-i63z` — research and spec shortcuts create the tracking bead first
- [ ] Origin and repo labels on every mirrored issue; origin-scoped inbound scan (F15,
  F16)
- [ ] Remap safety: team-mismatch detection in report and `doctor`, no cross-team state
  pushes, documented remap semantics (F17)
- [ ] Multi-repo topologies documented in `setup-linear` (Mode 1 today, Mode 2 once
  labels land, Mode 3 as the hierarchy-native alternative)

**Exit criteria:** a Linear issue for an epic shows its governing spec, its supporting
docs, its PRs, its GitHub issues, its in-flight children with actor and age, and a
working link to the bead source — all refreshed by an ordinary `tbd sync`.

### Phase 4: Enforcement and reach

- [ ] `tbd-motn` — `tbd closing --check` with exit-code semantics and `--json`
- [ ] `tbd-gmn8` — `Stop`-event gate for Claude Code and Codex, with the anti-loop rules
- [ ] `tbd-zhel` — `tbd prime` reports claimed work and sync freshness
- [ ] `tbd-llwb` — Cursor setup surface
- [ ] `tbd-jg23` — Gemini CLI setup surface
- [ ] `tbd-qxdb` — stale-claim sweep
- [ ] `tbd-8asz` — document pulled tracker comments as untrusted input
- [ ] Decide independently whether to build the GitHub tracker adapter

**Exit criteria:** an agent that claims a bead and tries to end its turn without syncing
is told once, and an agent whose sync failed for environmental reasons is not blocked.

## Testing Strategy

**Phase 1** is where the regressions must be pinned, because the defects it fixes were
all invisible to the existing suite:

- **Quiet-sync assertion** (new, and the most important test in this spec): settle a
  mirror against the mock server, run once more, assert **zero bytes change** under
  `bridge/<provider>/links/` and that the provider request count is independent of the
  number of linked beads.
  Nothing currently pins either property.
- **Push-hook isolation**: assert the sync-branch push carries `--no-verify`, in a
  fixture repository with a `pre-push` hook that fails.
- **Surface honesty**: golden output for each `tbd sync` form showing whether the
  tracker ran.
- Live-QA addition: prove Linear bumps `Issue.updatedAt` on comment creation, as a named
  scenario in `packages/tbd/tests/qa/linear-integration.qa.md`, before the delta-gated
  comment fetch ships.

**Phase 2** needs old-client contract tests, following the pattern established for
`f04`:

- Round-trip: a bead with `docs`, `refs`, and an unknown future key survives parse →
  serialize → three-way merge with all three intact.
- Fail-closed: a client that supports up to `f07` refuses an `f08` repository with the
  standard upgrade message.
- Migration: `f07 → f08` stamps and is revertible; the interrupted-upgrade partial
  states behave, per the existing `common-dir-layout-doctor` pattern.
- Merge concurrency: two clones each adding a different ref converge to both.

**Phase 3** is mostly golden-output testing of the managed block, plus a spawned-process
check that a `tbd web` deep link selects the right bead.

**Phase 4** exercises hook scripts as executables — the gap `tbd-qd1n` closes — with a
fixture asserting the gate fires at most once and never blocks on a failed sync.

## Rollout Plan

Phase 1 ships as an ordinary patch or minor release; nothing in it changes stored data.
The two efficiency fixes should land together, since either alone leaves the other’s
cost in place.

**Phase 2 is the only release needing the format ceremony.** Follow the `f07` playbook:
land the schema and migration together, stamp via `tbd setup --auto`, and commit the
config diff with the change so no one clones the window between them.
The release notes must state plainly that older clients will refuse the repository, and
why that is protective — a pre-`f08` client would delete bead metadata it does not
understand.

Phases 3 and 4 are additive and ship independently.

This repository is the pilot, as it was for the tracker integration.
The `sync_on_tbd_sync: false` override stays until Phase 1’s exit criteria are met on
hosted CI; lifting it is the signal that syncing constantly is actually free.

## Open Questions

1. **Drop `synced_at`, or guard the write?** Dropping removes the failure mode; guarding
   keeps a diagnostic that nothing currently reads.
   This spec prefers dropping and should be challenged if the field has a consumer.
2. **Does Linear always bump `Issue.updatedAt` on comment creation?** The delta-gated
   comment fetch depends on it.
   Live QA answers this; the fallback is a periodic full reconcile.
3. **Should an inherited `spec_path` select a bead for mirroring?** It accounts for 79
   of 89 non-epic selections, and a single `tbd update --spec` on this spec’s epic added
   30 beads to the mirror.
   Selecting only the carrier would cut the mirror sharply and probably match what
   people expect the rule to say.
4. **Should `spec_path` be renamed or aliased?** It already accepts any repository path
   and propagates usefully, but the name stops agents pointing it at research or
   architecture docs. An alias is cheap; a rename is a format concern.
5. **Should `docs` and `refs` really be separate fields?** One list with a discriminator
   is simpler to explain; two lists keep path resolution and URL opacity from
   contaminating each other.
   This spec chooses two and flags the alternative.
6. **Should `refs` be pushed as native tracker attachments** rather than description
   lines? Linear attachments would make PRs first-class in its UI. The attachment channel
   already carries the bead metadata payload, so the interaction needs thought.
7. **Should `tbd start` sync by default?** Syncing on claim is what makes Linear live,
   but it makes a local bookkeeping command touch the network.
   Phase 1’s efficiency work is what makes the aggressive default defensible.
8. **Does the tracker belong inside the `--issues` surface** rather than as its own?
   Beads and their mirror are arguably one logical thing, and merging them removes the
   `--issues` surprise rather than documenting it.
9. **Should the claim URL carry repo identity?** `tbd://bead/<displayId>` embeds a
   per-repo display prefix and is also the attachment idempotency key, so changing its
   format must tolerate items carrying the old form.
10. **Is team-per-repo (Mode 1) acceptable ceremony?** It is the only structurally
    isolated multi-repo topology and works today, but Linear teams carry membership and
    configuration a small repo may not merit.
11. **Should `mirror_labels: false` come with bulk label removal?** The schema promises
    prefixed labels are removable in bulk, and no command does it.

## References

- [Research: Keeping Agent Sessions Synchronized](../../research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md)
  — the audit, measurements, and primitive designs this spec sequences
- [Research: Linear as a Task Surface for Beads and Agents](../../research/current/research-2026-08-09-linear-task-surfaces.md)
  — verified Linear API facts, rate limits, and the topology option space
- [Feature: External Tracker Integrations](plan-2026-08-10-external-tracker-integrations.md)
  — the shipped sync engine, and the GitHub adapter phase this spec defers to
- [Modernize multi-agent skills and hooks setup](plan-2026-05-24-multi-agent-skills-hooks-setup.md)
  — the `--surfaces` registry Phase 4 extends
- `packages/tbd/src/lib/tbd-format.ts` — the format history and the `f07` precedent for
  a metadata-only stamp that closes the door on lossy older clients

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
