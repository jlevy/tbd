# Feature: Linear ↔ bead bidirectional sync pilot (linked subset) + `tbd watch` foundation

**Date:** 2026-07-20 (last updated 2026-07-20)

**Author:** Joshua Levy (with agent assistance)

**Status:** Planned (consolidates prior research; supersedes the pre-rewrite external
issue linking epic tbd-68cw as the plan of record for external tracker sync)

## Overview

This project previously tracked issues in Linear; tracking has since moved to git-native
beads in this repo. The two worlds are currently disconnected: beads are invisible in
Linear, and Linear issues (the surface humans, PMs, and other agent products like Cursor
already watch) are invisible to beads and to the agents that work from `tbd ready`.

This spec defines a **pilot of true bidirectional sync between a linked subset of beads
and Linear issues**, composed with the **bead watch foundation** so that bead changes
(including those originating in Linear) wake and coordinate agents.
The watch foundation itself **shipped first as a working increment** (PR #196,
`tbd changes` + `tbd watch`); the bridge features here are safe additions on top of it —
see §6/§6a for the reconciliation with that plan.

Design inputs, consolidated here:

- **[plan-2026-07-19-bead-watch-and-external-sync.md](plan-2026-07-19-bead-watch-and-external-sync.md)**
  — the sibling plan whose Phase 1 (watch) is implemented and validated; §6a of this
  spec unifies its Phase 2 sketch with this design (naming, bindings, echo suppression,
  comments model, writer model).
- **Design doc §8.7 “External Issue Tracker Linking”**
  ([tbd-design.md](../../../../packages/tbd/docs/tbd-design.md)) — recommends designing
  the `linked` metadata structure now and implementing providers behind an adapter
  interface. This spec is that design, with Linear (not GitHub) as the first provider
  since it is where this project’s external tracking lived.
- **[api-references-bridge-integrations.md](../../research/current/api-references-bridge-integrations.md)
  §5 (Linear APIs, verified 2026-07-20)** — GraphQL endpoint, auth, rate limits, webhook
  constraints, and the Linear Agents platform.
- **[research-2026-06-04-agent-issue-monitors.md](../../research/current/research-2026-06-04-agent-issue-monitors.md)**
  — how agents listen on issues today; tbd’s missing pieces are an event surface, a
  dispatch convention, and anti-recursion.
- **[research-agent-coordination-kernel.md](../../research/current/research-agent-coordination-kernel.md)**
  — durable truth (git) vs.
  live coordination (streams); `watch` emitting JSONL as the universal composition
  point; bridges as thin, stateless adapters.
- **[research-claude-code-orchestration-and-uis.md](../../research/current/research-claude-code-orchestration-and-uis.md)**
  — OpenAI Symphony: a Linear-polling orchestrator daemon (per-issue workspaces,
  reconciliation loops, tracker-driven recovery, no local database) that validates
  polling-first architecture.
- **The pre-rewrite external issue linking epic (bead tbd-68cw, closed 2026-02-11)** —
  the previous codebase shipped GitHub Issues sync (`external_issue_url` field, status
  mapping tables, a 4-phase sync order, `use_gh_cli` gating).
  That code did not survive the v2 rewrite, but its shape (single-URL link field,
  4-phase ordering, status mapping tables) informs this design.
  Where this spec differs deliberately: a structured multi-entry `linked` field instead
  of one URL string, a persisted sync-state base for real 3-way diffs instead of
  stateless push/pull, and API-based access instead of shelling to a vendor CLI.

**Why bidirectional sync and watch belong in one plan:** they share the hard invariant.
Sync must not re-import its own writes (echo), and watch-driven agents must not
re-trigger on their own updates (loops).
Both are solved by the same two mechanisms introduced here: **actor attribution** on
changes and **base-snapshot echo suppression** in the bridge state.

## Goals

- A bead can be **linked** to a Linear issue; the link survives sync/merge and is
  visible in `tbd show`.
- **Pull**: changes made in Linear (title, description, status, priority, labels) to a
  linked issue appear on the linked bead after `tbd bridge sync` (or `tbd sync` with the
  integration enabled).
- **Push**: the same fields changed on a linked bead propagate to the Linear issue,
  including close ↔ completed/canceled transitions.
- **Subset scope**: only beads with a `linked` entry participate, and each bead is
  attached to **at most one** external source (see Design §1). Linking happens
  explicitly (`tbd bridge link`, `tbd bridge import`) — no implicit whole-store export.
- **Provider-generic surface**: one command group (`tbd bridge`) and one sync entry
  point cover all configured sources, so adding GitHub later changes configuration and
  adapters, not workflow.
- **Convergent and idempotent**: running sync twice in a row is a no-op; concurrent
  edits on both sides converge with field-level resolution and attic preservation,
  matching tbd’s existing merge philosophy.
- **No echo loops**: the bridge never re-applies its own writes in either direction.
- **Watch composition**: the shipped `tbd watch`/`tbd changes` (PR #196) wake agents on
  Linear-originated bead changes, with `last_actor` attribution added by this spec so
  watchers and the bridge can skip their own writes.
- **Pilot-verifiable**: a written QA playbook exercises the full loop against a real
  Linear team: create in Linear → import → agent works the bead → close → Linear shows
  completed.

## Non-Goals (pilot)

- **No daemon and no webhooks.** Linear webhooks require a public HTTPS endpoint
  (verified: non-localhost, 200 within 5s), which CLI/sandbox environments don’t have.
  Polling is the pilot transport; it is also the reconciliation path any future webhook
  daemon needs anyway.
- **No comments sync in the pilot.** When the `comments` model from
  [plan-2026-07-19-bead-watch-and-external-sync.md](plan-2026-07-19-bead-watch-and-external-sync.md)
  Phase 2 lands (union-by-id, conflict-free), inbound external events land there;
  bidirectional comment sync remains out of scope here (see §6a).
- **No dependency / sub-issue mapping** (Linear relations ↔ bead `dependencies` /
  `parent_id`), no projects/cycles/initiatives, no attachments.
- **No assignee push** unless a `user_map` is configured (bead `assignee` is a free
  string; Linear needs a user UUID). Pull maps to the Linear user’s display name.
- **No GitHub implementation in the pilot** — but the pilot is built so GitHub is a
  mechanical follow-up: the `tbd bridge` command group, `linked` field, per-provider
  bridge-state layout, canonical field mapping types, and `TrackerAdapter` interface are
  all provider-generic from day one.
  Once Linear works end to end, a GitHub adapter is ref parsing (`owner/repo#123`), a
  much simpler state model (open/closed + labels), and auth plumbing — no changes to
  sync, merge, watch, or CLI shape.
- **No leases/claims or agent registry.** Advisory claiming stays `status: in_progress`
  per current docs; the coordination-kernel claim/lease primitive is a follow-up spec.
- **No Linear Agents (AgentSession) integration.** Requires a hosted OAuth `actor=app`
  backend; noted as the target end-state for dispatch, out of pilot scope.

## Background: current state (reviewed 2026-07-20)

- Current tbd (v0.4.x, post-rewrite) has **no external tracker support**: no link field,
  no provider code, no `--external` sync scope.
  `tbd sync` is git-only (issues + docs on the `tbd-sync` branch via the hidden
  worktree, with the field-level merge engine from
  [plan-2026-06-03-tbd-sync-structured-bead-merge.md](plan-2026-06-03-tbd-sync-structured-bead-merge.md)).
- `IssueSchema` has no linkage field.
  `BaseEntity.extensions` exists as a third-party namespace, but the implemented merge
  strategy is whole-object LWW (`extensions: 'lww'`,
  `packages/tbd/src/file/git.ts:407`), while the design doc §3.5 specifies
  `deep_merge_by_key`. Concurrent writers to different namespaces would silently drop
  one side — a data-loss hazard for any bridge metadata (Phase 0 fixes this).
- Issue parsing uses Zod’s default strip mode: **unknown frontmatter fields are
  discarded on parse** and therefore lost when an older CLI rewrites a bead.
  Adding a synced `linked` field requires a compatibility gate (see Rollout).
- No `tbd watch`, no event surface, and no per-change actor attribution exist today.
- Research coverage was consolidated for this spec: Linear API facts were verified and
  added as §5 of the bridge-integrations brief (2026-07-20 addendum); the monitors and
  coordination-kernel briefs supply the watch/dispatch design language.

## Design

### 1. Schema: the `linked` field

Add an optional top-level field to `IssueSchema` (per design doc §8.7, structured for
multiple providers from day one):

```yaml
# bead frontmatter
linked:
  - provider: linear
    id: 9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b   # provider UUID — canonical key
    key: ENG-123                                # human identifier — display only
    url: https://linear.app/acme/issue/ENG-123
    linked_at: 2026-07-20T18:00:00Z
```

- `id` is the provider’s stable UUID (Linear identifiers like `ENG-123` can move teams;
  UUIDs cannot). `key`/`url` are display conveniences refreshed on sync.
- **Single-source invariant (decided 2026-07-20)**: a bead may be attached to **at most
  one external source**. The array shape is kept for §8.7 compatibility and future
  relaxation, but the CLI refuses `bridge link` on an already-linked bead (`--force`
  re-links after unlink semantics), and validation warns on multi-entry beads.
  Rationale: every sync is then exactly one pair (bead ↔ one tracker) resolved against
  one base — never a multi-master reconciliation across several trackers (bead + Linear
  \+ GitHub), which would need per-field provenance to be sound.
  Cross-posting the same work to two trackers is out of scope by design.
- **Merge rule**: `merge_by_id` keyed on `(provider, id)` with per-entry LWW, the same
  machinery as `dependencies` — plus a **collapse rule** enforcing the invariant: if a
  merge would yield more than one entry (two sessions concurrently linked different
  sources), keep the entry with the newest `linked_at` and preserve the loser in the
  attic. Schema change ships with the merge-rule table update and design-doc §2.7 / §3.5
  updates in the same PR.
- Sync bookkeeping (cursors, base snapshots) deliberately does NOT live in the bead: it
  would bump `version`/`updated_at` on every sync and spam history.
  It lives in bridge state (next section).

### 2. Bridge state (on the `tbd-sync` branch)

New directory tracked on the sync branch, sibling to `issues/` and `mappings/` — one
subdirectory per provider (only `linear/` exists in the pilot; `github/` follows the
same layout later):

```
.tbd/data-sync/bridge/linear/
├── state.yml        # per-link sync state
└── meta.yml         # cached team/workspace metadata (state UUIDs by type, label map)
```

`state.yml` entry per link:

```yaml
links:
  is-01k…:                       # bead internal id
    linear_id: 9cbb48f8-…
    linear_updated_at: 2026-07-20T18:04:11Z   # Linear's updatedAt at last sync
    base:                        # canonical field tuple as of last successful sync
      title: "Fix login retry loop"
      status: in_progress        # tbd-side canonical value
      priority: 1                # tbd-side canonical value
      labels: [bug, auth]
      description_hash: sha256:…
    synced_at: 2026-07-20T18:04:12Z
```

- The `base` tuple is what makes sync a **true 3-way merge**: local diff = bead vs.
  base; remote diff = mapped Linear issue vs.
  base. This is the same shape as the bead merge engine and the doc-fork three-way model
  already in the codebase.
- **Echo suppression**: after a push, the bridge records Linear’s post-write `updatedAt`
  into `linear_updated_at` and refreshes `base`, so the next pull sees “no remote diff”
  for its own write. Symmetrically, pull-applied bead edits refresh `base` so they don’t
  re-push. This works with plain API-key auth (no reliance on actor filtering) and is the
  loop-prevention analog of GitHub’s `GITHUB_TOKEN` recursion rule from the monitors
  brief.
- Living on the sync branch makes bridge state shared and versioned: any machine can run
  the sync, and state merges are per-bead-keyed map unions (same conflict story as
  `mappings/ids.yml`).
- Secrets never touch the repo: auth is `LINEAR_API_KEY` from the environment only.

### 3. Field mapping (defaults; overridable in config)

Canonical mapping tables, applied symmetrically (pure functions, unit-tested):

**Status** (Linear `WorkflowState.type` is the mapping target — per-team state UUIDs are
resolved by `type` and cached in `bridge/linear/meta.yml`):

| tbd status | → Linear state type | ← from Linear state type |
| --- | --- | --- |
| `open` | `unstarted` | `triage`, `backlog`, `unstarted` → `open` |
| `in_progress` | `started` | `started` → `in_progress` |
| `blocked` | `started` + label `blocked` | (label `blocked` on a started issue → `blocked`) |
| `deferred` | `backlog` + label `deferred` | (label `deferred` → `deferred`) |
| `closed` | `completed` (or `canceled` if `close_reason` starts with `wontfix`/`canceled`) | `completed`, `canceled` → `closed` (+ `close_reason: "Canceled in Linear"` for canceled) |

`blocked`/`deferred` have no Linear state type, so they round-trip via paired labels —
lossy only if someone strips the label in Linear (LWW then resolves it).

**Priority** (bijective, round-trip stable):

| tbd | Linear |
| --- | --- |
| P0 | 1 (Urgent) |
| P1 | 2 (High) |
| P2 | 3 (Medium) |
| P3 | 4 (Low) |
| P4 | 0 (None) |

**Other fields**: `title` ↔ title (LWW); `description` ↔ description (both markdown; LWW
with attic on conflict); `labels` ↔ team labels by exact name (union on merge; missing
Linear labels are created on push — config `create_labels: false` to disable);
`assignee`: pull → Linear user display name, push → only via config `user_map`
(otherwise warn-and-skip).
Fields not listed (dependencies, parent, spec_path, notes, due dates …) do not sync in
the pilot.

### 4. Sync algorithm and ordering

`tbd bridge sync` (also invoked from `tbd sync` when the integration is enabled), under
the existing data-sync lock, ordered so external changes ride the same git sync.
The external phases iterate over **every configured provider**; because of the
single-source invariant each linked bead is processed by exactly one provider:

```
1. git pull phase        (existing tbd sync pull — beads current)
2. external pull         Per provider, for its linked beads (batched GraphQL query
                         by ids, filtered updatedAt > linear_updated_at):
                           remote diff vs base; apply per-field to bead
3. external push         local diff vs base → issueUpdate mutations
                         (stateId resolved from cached meta; refresh cache on miss)
4. state update          refresh base tuples + linear_updated_at
5. git push phase        (existing tbd sync push — beads + bridge state together)
```

Per-field resolution when **both** sides changed the same field differently: LWW
comparing bead `updated_at` vs.
Linear `updatedAt`, loser preserved to the existing attic (`conflicts/<bead-id>/…`),
consistent with §3.5 merge rules.
Different fields changed on different sides merge cleanly (that’s what the base
enables).

Failure containment: Linear API errors mark the run degraded and are reported per link;
the git phases still complete (external sync failure never corrupts or blocks git sync).
Writes to Linear honor the `X-RateLimit-*` headers with backoff; 5,000 req/hour is ample
for a linked subset (batched pulls are 1–2 queries per run).

Deletion semantics: a Linear issue that is archived/deleted → mark the link `orphaned`
and warn (never auto-delete a bead); an unlinked or deleted bead → leave the Linear
issue untouched (report), no auto-close.

### 5. CLI surface (pilot): the `tbd bridge` group

Decided 2026-07-20: a **generic `bridge` command group**, not per-provider commands —
one `tbd bridge sync` syncs all configured sources (Linear now, Linear + GitHub later),
and links/status are uniform across providers.
The provider is inferred from the ref (`linear:ENG-123`, a Linear/GitHub URL, or
`owner/repo#123`), falling back to the single configured provider; `--provider` scopes
where inference is ambiguous.

```
tbd bridge link <id> <ref>            # attach bead ↔ external issue (one per bead)
tbd bridge unlink <id>
tbd bridge import <ref>               # create a linked bead from an external issue
tbd bridge import --provider linear --team ENG [--state started,unstarted] [--limit N]
tbd bridge sync [--provider <p>] [--pull|--push] [--dry-run] [--json]
tbd bridge status                     # links by provider, drift vs base, orphans
```

Config (`.tbd/config.yml`) — one block per provider under a shared `bridges` key:

```yaml
bridges:
  sync_on_tbd_sync: true         # fold external sync into plain `tbd sync`
  linear:
    enabled: true
    team_key: ENG
    create_labels: true
    user_map: {}                 # tbd assignee string -> Linear user email/UUID
    # status_map / priority_map: optional overrides of the default tables
  # github:                      # future — same shape, adapter not in pilot
  #   enabled: true
  #   repo: owner/name
```

Provider-specific flags (like `--team`) and env keys (`LINEAR_API_KEY`) belong to their
adapter. Commands no-op with a clear message when a provider’s key is unset or its block
is disabled — mirroring the old epic’s `use_gh_cli` gating pattern.
Every command supports `--json` and `--dry-run` per CLI conventions.

### 6. Watch foundation (shipped in PR #196) and agent coordination

**Updated 2026-07-20 after merging the watch implementation.** The watch foundation is
no longer proposed here — it shipped as Phase 1 of
[plan-2026-07-19-bead-watch-and-external-sync.md](plan-2026-07-19-bead-watch-and-external-sync.md)
(PR #196, validated on Claude Code and Codex): `tbd changes --since <commit>` is the
pure snapshot-diff primitive and `tbd watch` is the blocking one-shot — poll the remote
tip via `git ls-remote`, fetch to a private ref on movement, report the selection’s
per-field deltas as human text or one stable JSON document, exit 0/2/1, resume via
`--since <tip>` chaining.
That blocking, stateless contract supersedes this spec’s earlier streaming-JSONL sketch
— it is strictly better for agent wake-ups (resumable, no long-lived process, already
validated), and a streaming layer can be built over it later if needed.
The sequencing principle (per review discussion): **the watch foundation lands first as
a working increment, and bridge features are safe additions on top** — nothing in this
spec modifies the shipped watch contract.

What this spec still adds on top of the shipped watch:

- **Actor attribution (`last_actor`)**: the watch report shows *what* changed but not
  *who* changed it — there is no anti-recursion signal yet.
  Phase 0 adds the optional `last_actor` frontmatter field (LWW), set by every mutating
  command from `TBD_ACTOR` (default: OS user; the bridge sets `linear-bridge`). It then
  appears in watch reports as an ordinary field delta and lets a woken agent skip
  changes it (or the bridge) made itself — the anti-recursion convention the monitors
  brief identifies as the piece tbd must invent.
  (Full per-transition journaling is the coordination-kernel follow-up, not this spec.)
- **Dispatch convention (documented, not enforced)**: `assignee` = which agent, labels =
  mode (`agent:claude`, `needs-implementation`), `status` = lifecycle.
  This maps 1:1 onto how Copilot/Cursor/Claude Action dispatch today, onto the shipped
  watch selectors (`--label`, `--ready`, `--status`), and onto Linear’s own delegate
  model later.
- **The full-loop demonstration** (QA playbook, composing shipped pieces — the
  watch-then-spawn recipe from the `watch-beads` shortcut plus `tbd bridge sync`):

```
PM files/updates an issue in Linear
  → `tbd bridge sync` (cron or pre-agent hook) imports/updates the linked bead
  → a `tbd watch --ready` (or `--label agent:claude`) loop wakes the agent with the delta report
  → agent works, closes the bead, syncs
  → `tbd bridge sync` pushes `completed` back to Linear, where the human sees it
```

Loop-safety: the bridge’s bead writes carry `last_actor: linear-bridge` (visible in
watch reports) and its Linear writes are echo-suppressed by base snapshots, so
watch-driven agents and the bridge run together without ping-pong.

### 6a. Reconciliation with plan-2026-07-19 (one plan of record for Phase 2)

The two specs were written in parallel (2026-07-19 implementation-first for watch;
2026-07-20 research-first for Linear sync) and are reconciled as follows.
This spec is the **detailed elaboration of the external-sync phase**; the 07-19 spec
remains the plan of record for the shipped watch:

- **Command naming**: unified on **`tbd bridge`** (this spec §5) — one command group,
  one `bridge sync` across all configured providers.
  The 07-19 spec’s `tbd mirror pull/push/status` maps to `tbd bridge sync --pull/--push`
  and `tbd bridge status`.
- **Bindings**: bead-side binding is the first-class `linked` field with the
  single-source invariant (§1), replacing the interim label-based binding the 07-19 spec
  suggested for before per-namespace `extensions` merge.
  The 07-19 spec’s **external-side** markers are adopted as designed: a hidden
  `<!-- tbd:bead <id> -->` marker in the external description and (Linear) an attachment
  URL as the per-issue idempotency key.
- **Echo suppression**: complementary, both adopted — this spec’s per-link base tuples
  (§2) give field-level 3-way diffs for bidirectional fields; the 07-19 spec’s content
  hashes guard the projector-owned managed description block; its `[skip-bridge]` commit
  marker convention is kept for bridge-authored sync commits.
- **Comments**: the 07-19 spec’s `comments` model (union-by-id, conflict-free;
  `tbd comment`) is adopted as the landing spot for inbound external events —
  superseding this spec’s blanket “no comments” non-goal.
  Full bidirectional comment sync remains out of the pilot; inbound events land as
  comments when the model ships.
- **Writer model**: single-writer-from-CI (07-19) is the recommended steady state;
  manual `tbd bridge sync` from a dev machine stays supported (it serializes under the
  existing data-sync lock and converges via base snapshots) — which is what the pilot
  and sandbox testing need.
- **Shared work items** (one implementation, referenced by both specs): per-namespace
  `extensions` merge fix, and the `mirror`/`bridge` state file (kept on the sync branch
  per §2 of this spec, holding the 07-19 spec’s watermarks and content hashes alongside
  the base tuples).

### 7. Provider adapter seam

One internal interface, sized to what sync actually needs (not the old epic’s CLI-shaped
one):

```ts
interface TrackerAdapter {
  resolveRef(ref: string): Promise<ExternalRef>;          // "ENG-123" | url -> uuid
  fetchIssues(ids: string[]): Promise<ExternalIssue[]>;   // batched, mapped-canonical
  applyChanges(id: string, patch: CanonicalPatch): Promise<{updatedAt: string}>;
  ensureMeta(): Promise<ProviderMeta>;                    // states by type, labels
}
```

`ExternalIssue`/`CanonicalPatch` use tbd-canonical values (tbd status enum, P0–P4) so
mapping tables live in one place per provider.
The `bridge` command group, sync loop, bridge-state layout, and watch are all written
against this interface; **a GitHub adapter later is just a second implementation** —
simpler than Linear’s (binary open/closed instead of typed workflow states, no state
UUIDs to cache) — with nothing else in sync, merge, or CLI changing.
The pilot proves the seam with Linear, the harder case.

## Implementation Plan

### Phase 0 — prerequisites (small, independently shippable)

- [ ] Fix `extensions` merge: `lww` → `deep_merge_by_key` per design §3.5
  (`packages/tbd/src/file/git.ts:407`), with attic on per-namespace loss + tests.
- [ ] Add `linked` field: schema, `merge_by_id (provider,id)` rule with the
  single-source collapse rule (newest `linked_at` wins, loser to attic), `tbd show`
  display, design-doc §2.7/§3.5 updates, golden tests.
- [ ] Add `last_actor` field (LWW, from `TBD_ACTOR`) set by mutating commands.
- [ ] Compatibility gate for the new synced fields (see Rollout).

### Phase 1 — link + single-bead pull/push

- [ ] `bridges` config block + `LINEAR_API_KEY` gating + generic `tbd bridge` command
  group scaffold with provider inference from refs (all `--json`/`--dry-run` capable).
- [ ] Linear GraphQL client (thin fetch wrapper; no SDK dependency decision yet — see
  Open Questions; honor rate-limit headers).
- [ ] `ensureMeta`: fetch + cache team workflow states (UUID by type) and labels.
- [ ] `tbd bridge link / unlink / import <ref>` with bridge-state creation and the
  one-source-per-bead guard.
- [ ] Mapping tables as pure functions with exhaustive unit tests (status, priority,
  labels, canceled/completed close reasons).
- [ ] `tbd bridge sync` for a single link: 3-way diff vs base, pull-apply, push, state
  refresh, echo suppression.
  Manual e2e against a sandbox Linear team.

### Phase 2 — subset sync, conflicts, integration into `tbd sync`

- [ ] Batched pull for all links (single filtered query); full push scan.
- [ ] Per-field conflict resolution with attic entries; orphan detection
  (archived/deleted Linear issues); `tbd bridge status`.
- [ ] Fold into `tbd sync` (5-step ordering above) behind `bridges.sync_on_tbd_sync`.
- [ ] Mock Linear GraphQL server fixture (local HTTP, `LINEAR_API_URL` override) +
  golden tryscript: link, sync, remote-change pull, local-change push, both-sides
  conflict, double-run idempotency (second run is a no-op), link-guard (second
  `bridge link` on a linked bead refuses).
- [ ] Bulk `tbd bridge import --provider linear --team … --state … --limit N`.

### Phase 3 — coordination pilot on the shipped watch

*(The watch itself shipped in PR #196 — `tbd changes` + `tbd watch`; see §6. This phase
only composes with it.)*

- [ ] Verify `last_actor` (from Phase 0) surfaces in `tbd changes`/`tbd watch` field
  deltas so woken agents can skip their own and the bridge’s writes; add it to the
  normative change-field list if needed.
- [ ] QA playbook (`docs/project/specs/active/` companion or qa-playbook template): the
  full Linear → bead → agent → Linear loop — watch-then-spawn recipe from the
  `watch-beads` shortcut plus `tbd bridge sync` on cron — with two agents + bridge
  running concurrently, verifying no echo/ping-pong.
- [ ] Document the dispatch conventions (assignee/label/status) in tbd-docs, the
  `watch-beads` shortcut, and the agent-facing skill docs.

### Phase 4 — explicitly deferred (tracked as future beads, not in pilot)

Webhook/daemon transport (Symphony-style), Linear Agents `AgentSession` integration
(delegate → bead → agent session activities), comments ↔ notes, dependency/sub-issue
mapping, claim/lease primitives, and the **GitHub `TrackerAdapter`** — expected to be
the first and most mechanical of these once Linear works, since every provider-facing
seam (commands, config, state, mapping types) ships generic in the pilot.

## Testing Strategy

- **Unit**: mapping tables (bijectivity of priority map; status table incl.
  blocked/deferred label round-trip), 3-way field differ, echo-suppression state
  transitions, ref parsing (`ENG-123`, URLs).
- **Golden (tryscript) with mock server**: deterministic fixture responses; covers the
  Phase 2 checklist scenarios end to end, including `--dry-run` output and JSON mode.
- **Property-style convergence test**: random interleavings of local/remote edits +
  syncs converge to identical field tuples with no lost writes (attic accounts for every
  LWW loss) — mirrors the merge-engine tests from the structured-merge spec.
- **Manual pilot (QA playbook)**: real Linear sandbox team, API key from env; the
  agent-coordination loop from Design §6; verify rate-limit headers respected and
  `tbd doctor` stays clean.

## Rollout Plan

1. Phase 0 lands behind no flags (pure merge/schema hardening) but **bumps the
   minimum-version gate**: because Zod strip mode silently drops unknown frontmatter on
   rewrite, older CLIs would destroy `linked`/`last_actor` data.
   Use the existing `tbd_format`/“repository requires a newer version of tbd” mechanism
   so pre-pilot CLIs refuse to write once the repo opts in (config `tbd_format` bump per
   §Format Upgrades; data migration is nil — fields are additive).
2. Phases 1–2 ship enabled-by-config-only (`bridges.linear.enabled`), so no behavior
   change for repos without the block; this repo becomes the pilot by linking a small
   curated subset (5–10 active beads) to a sandbox team first, then to the real team.
3. Phase 3 rides the shipped watch (PR #196) — no new watch surface; the coordination
   conventions and QA playbook are docs + validation, gated only on Phases 0–2.
4. Revisit after pilot: promote or adjust defaults (e.g., `sync_on_tbd_sync`), decide
   GitHub adapter priority, and spec the daemon/webhook phase with the Agents-platform
   end-state from the bridge brief §5.3.

## Open Questions

1. **Command naming — RESOLVED 2026-07-20**: generic `tbd bridge` group (see Design §5).
   Rationale: a single `tbd bridge sync` must cover all configured sources once GitHub
   joins Linear, and the one-source-per-bead invariant makes the generic surface
   unambiguous (every bead resolves to exactly one provider).
2. **`@linear/sdk` vs. raw GraphQL over fetch**: the SDK is typed, maintained by Linear,
   and brings pagination helpers; raw `fetch` keeps the CLI’s runtime dependency profile
   lean when the pilot only needs a handful of queries and mutations.
   (The 14-day package-age cooldown is not a factor either way — it only means pinning
   an SDK version at least 14 days old, which any choice satisfies.)
   Pilot leans raw `fetch` on dependency-weight grounds alone; revisit if the query
   surface grows.
3. **Triage state on push-create**: should a future `tbd bridge export` (reverse
   direction, creating Linear issues from beads — currently out of scope) target
   `triage` or `backlog`? Deferred with the feature.
4. **Description LWW granularity**: whole-field LWW with attic (pilot) vs.
   future text-level merge; also whether to normalize markdown flavors (Linear supports
   a subset) before hashing to avoid false drift.
5. **`blocked`/`deferred` label names in Linear**: fixed names (`blocked`, `deferred`)
   vs. configurable; and whether to prefix (`tbd:blocked`) to avoid colliding with
   existing team labels.
6. **Multi-repo → one Linear team**: bridge state is per-repo; two repos linking the
   same Linear issue would double-write.
   Pilot: document as unsupported; detect via a label or issue attachment later.
7. **Watch replay depth — RESOLVED by PR #196**: the shipped `tbd changes --since` /
   `tbd watch --since` chaining IS the replay mechanism (any historical sync-branch
   commit works as a baseline), so no separate cursor store is needed.

## References

- [plan-2026-07-19-bead-watch-and-external-sync.md](plan-2026-07-19-bead-watch-and-external-sync.md)
  and [valid-2026-07-19-bead-watch-phase-1.md](valid-2026-07-19-bead-watch-phase-1.md) —
  the shipped watch foundation (PR #196) this spec builds on
- Design doc §8.7 (External Issue Tracker Linking), §3.5 (Merge Rules), §2.6 (ID
  mapping), §2.3 (worktree) —
  [tbd-design.md](../../../../packages/tbd/docs/tbd-design.md)
- [api-references-bridge-integrations.md §5](../../research/current/api-references-bridge-integrations.md)
  — Linear GraphQL/webhooks/rate limits/Agents (verified 2026-07-20)
- [research-2026-06-04-agent-issue-monitors.md](../../research/current/research-2026-06-04-agent-issue-monitors.md)
  — trigger surfaces, anti-recursion, the tbd extension sketch this spec implements
- [research-agent-coordination-kernel.md](../../research/current/research-agent-coordination-kernel.md)
  — event envelope, `watch` interface, bridge rules
- [research-claude-code-orchestration-and-uis.md](../../research/current/research-claude-code-orchestration-and-uis.md)
  — OpenAI Symphony architecture (polling orchestrator over Linear)
- [plan-2026-06-03-tbd-sync-structured-bead-merge.md](plan-2026-06-03-tbd-sync-structured-bead-merge.md)
  — the merge engine this design reuses
- Prior art in this repo’s bead history: epic tbd-68cw and children (pre-rewrite GitHub
  sync)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
