---
title: Plan Spec
description: Separate who is accountable from who is executing, so an agent can hold a bead without displacing the human who owns it, and resolve actors without hand-maintained identity tables — humans bind per provider to ids discovered from the tracker's own directory, agents carry the identity tbd already mints
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Actor Axis and Identity Mapping

**Date:** 2026-08-18

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Design discussion:** [#246](https://github.com/jlevy/tbd/issues/246) — the provider
comparison and the measured evidence are argued there and are not re-argued here.
One part of its recommendation is superseded: the kind-bearing `user_map` table it
proposed is replaced by the two-namespace model below, which needs no identity table at
all.

**Sibling:**
[plan-2026-08-18-tracker-state-model-and-linear-mapping.md](./plan-2026-08-18-tracker-state-model-and-linear-mapping.md)
(epic `tbd-og20`, [#244](https://github.com/jlevy/tbd/issues/244)) adds `resolution`,
`hold`, and `started_at`, resolves Linear states by name, and owns the slot vocabulary
and board projection.
This spec is the second axis of the same model and depends on that resolver; it does not
restate the state design.

## Overview

tbd has one actor field, `assignee: z.string()`. Linear has two — `assignee`
(accountable) and `delegate` (acting) — and its entire agent platform hangs off the
second. The collapse is silent, and in an agent-driven repository it makes the field
unusable in either direction.

This adds `delegate` beside `assignee` and replaces identity *configuration* with
identity *resolution*:

- **Humans** resolve against the tracker’s own member directory and bind by provider
  user id, one binding per provider since a Linear UUID and a GitHub login are different
  identifiers. Adding a person to the team requires no tbd config change.
- **Agents** carry the identity tbd already mints (`agid-{ulid}` plus a friendly name,
  from `tbd start` / `tbd whoami`). Agents come and go per session; nothing about them
  is registered anywhere, and they reach a shared tracker only through one explicit,
  narrow binding for installed Linear agents.

Nobody maintains an alias table, and identities that must stay local stay local by
construction.

## Goals

- Record that a human is accountable while an agent executes, which is the normal case
  in an agent-driven repository and is currently inexpressible.
- Keep agent identities out of a shared tracker **by construction**, not by remembering
  to omit them from a config table.
- Add a person without touching config: resolve against the workspace directory, bind by
  provider user id, survive renames.
- Keep identity per provider, since a person’s Linear UUID and GitHub login are
  different identifiers, without making the bead field provider-specific.
- Push a delegate to Linear when — and only when — it names an installed Linear agent
  (an app user).
- Land `tbd start` claims on the acting axis instead of overwriting the accountable one.
- Report a field that a flow rule excluded, instead of reporting success for a write
  that went nowhere.

## Non-Goals

- **Agent presence.** Which session is touching a bead right now is a TTL lease in a
  database, not a bead field: heartbeat cadence is seconds, `extensions` merges as
  whole-object last-writer-wins, and sync-branch commits are the wrong granularity.
  `delegate` is the durable, low-frequency fact of who a unit of work is assigned to.
- **Registering tbd as a Linear agent** (agent sessions, ACKs, typed activity streams).
  Setting `delegateId` is a plain field write that happens to create an AgentSession on
  Linear’s side; nothing here requires tbd to become an agent.
- **GitHub adapter work.** The model is chosen to fit it; nothing here implements it.
- Re-specifying `resolution`, `hold`, slots, or the board projection.
  That is the sibling spec.

## Background

Found during the same first-time Linear rollout that produced #244 and #245: ~900 open
beads, ~105 mirrored epics, nearly all execution done by coding agents, and `assignee`
in use on **zero** beads.
Not neglect — there was nothing useful to write.
The human is the same on every bead, so the field carries no information; the agent was
not expressible at all.

### What tbd already has

tbd already mints agent identity, and the design below reuses it rather than inventing a
parallel one:

- `tbd whoami --ensure-id` mints `agid-{ulid}` once per working directory at session
  start and stores it in machine-local state (`.tbd/state.yml`, gitignored — a committed
  value would be wrong for every other checkout).
- A friendly name is joined onto the id, never concatenated into it; renaming an agent
  does not change who it is.
- Resolution is total and layered: `--as` beats `$TBD_AGENT` beats session state beats
  the derived `<harness>@<host>` fallback (`lib/agent-identity.ts`).
- The identity research
  ([research-2026-08-14-agent-and-session-identity.md](../../research/current/research-2026-08-14-agent-and-session-identity.md))
  recommends durable per-agent records at `agents/agid-{ulid}.yml` on the sync branch,
  one file per identity — not a flat union-merged map, whose duplicate-key hazard §5.4
  of that document records.

One piece of that work is interim wiring this spec replaces: `tbd start` currently
claims a bead by writing the agent name into `assignee` (`start.ts:142`), because
`assignee` was the only actor field there was.
That is precisely the overload this axis removes — the claim belongs on the acting axis.

### The gates, and the observability gap

One config gate holds `assignee` shut today, and it is subtler than it looks.
The reconcile engine marks assignee `canPush: capabilities.assignee ?? false`, and the
Linear adapter grants that capability only when `user_map` is non-empty and holds the
alias (`linear/adapter.ts:198`). An unpushable assignee lands in the report’s
`skippedPushes` — collected, but absent from the summary line, which still prints
`skipped 0` because that counter counts pairs, not fields.
The default output therefore reads as success while the field went nowhere, which is the
observability gap this spec fixes.

The `field_sync.fields.assignee: local` default is **not** a second gate: in the engine,
`local` is an ownership short-circuit — the local value still pushes, and an
opposite-side edit is overwritten and reported (`reconcile.ts:324`). What `local` does
cost is the inbound direction: a reassignment made in Linear is overwritten on the next
sync instead of flowing back, which is why `merge` is still the right setting for a
board humans manage.

### What Linear’s model requires

Linear’s 2025 agent platform changed the ground truth the old config comment (“tracker
assignees are people”) was written on: agents are OAuth apps installed with `actor=app`,
they appear in assignment menus under `app:assignable`, and Linear’s stated taxonomy is
**delegation, not assignment**. Per Linear’s own docs, issues are **assigned to humans
only and delegated to agents only**: the issue keeps a human assignee — someone
accountable — while the agent acts as delegate.
Two consequences fall straight out: an agent identity in `assignee` can never publish,
and a human in `delegate` has no Linear rendering.

The governing rule, from the repository this came from: **issues in Linear are managed
per human, not per agent.** Linear is where a person decides what is on their plate.
An agent in the assignee slot answers a question nobody asks there while destroying the
answer to the one they do.

## Design

### Approach

One field beside the existing one:

```
assignee:  <handle>    # accountable. Unchanged field, unchanged meaning: a human.
delegate:  <name>      # acting. Absent reads as "same as assignee".
```

And no identity table.
Each field resolves in its own namespace, and publishability is structural rather than
configured.

### Humans are directory entries

A human actor is whoever the tracker says is on the team, so tbd resolves handles
against the provider’s own member directory instead of asking a config file.
This needs one new adapter capability, `listMembers()`, returning each member’s provider
id, display name, and login or email where the provider exposes them.
Resolution then runs the same ladder for every provider, first match wins:

1. **Recorded binding** for the handle in this provider.
2. **Exact email match** against the directory, case-insensitively, where the provider
   exposes emails.
3. **Exact login or display-name match**, case-insensitively.
4. **Ambiguous or unknown — ask.** Interactively, show the candidates, let the user
   choose, and persist the answer as a binding so it is asked once.
   Non-interactively, skip the field, report it, and never guess — the same posture as
   the sibling’s state resolver and the bulk guard.

Bindings are recorded by **provider user id**, so a display-name change, a login change,
or an email change does not orphan the handle; `tbd doctor` reports drift between a
binding and the live directory.
This is the same resolve-by-name, bind-by-id pattern the sibling uses for workflow
states.

**Binding records are managed data, not config.** One file per identity under the
provider’s bridge state, `bridge/<provider>/users/<provider-user-id>.yml`, holding the
provider user id, the tbd handle, and the display name at bind time — and no email by
default. Bridge state already travels on the sync branch per provider, and
one-file-per-identity sidesteps the union-merge duplicate-key hazard the identity
research documents. Bindings are written only at an interactive confirmation or during
setup, never silently during sync.

**Inbound**, an assignee arrives as a provider user id.
A known id maps through its binding; an unknown one is offered as a new binding
interactively, and otherwise reported and left unsynced — today’s behavior, now with the
report naming the user rather than skipping silently.

**`user_map` stays as an override.** The existing `alias: email-or-uuid` form keeps
parsing unchanged and wins over directory resolution where present, so no existing
config breaks. `tbd integration setup` offers to convert entries into binding records,
after which the map can be deleted.
It stops being the mechanism; adding a person to the workspace needs no tbd change at
all.

### Identity is per provider, and the handle is the join key

A person has no universal id, and tbd should not invent one.
A Linear user is a workspace UUID; a GitHub user is a login; the next tracker will have
something else again.
So the bead field holds a **tbd handle** — `assignee: josh` means “the person tbd knows
as `josh`” — and each provider resolves that handle in its own namespace.

The bridge layout already makes this structural rather than a special case: bindings
live under `bridge/<provider>/users/`, so a person with accounts in two trackers has two
binding records, one per provider directory, both naming the same handle.
The handle is the join key; nothing else is shared between them.

What falls out, without any additional mechanism:

- **Partial coverage is normal, not an error.** A handle bound in Linear and not in
  GitHub pushes to Linear and produces a reported skip on GitHub.
  People genuinely do lack accounts on one side, and that reads as a skip with a reason
  rather than a failure.
- **One bead mirrored to two providers** pushes the same handle to two different ids,
  each resolved independently by its own adapter.
- **Inbound from either provider converges** on the same handle when both bindings
  exist. When only one does, the other provider’s inbound offers a new binding for a
  handle that already exists, which is the ordinary bind prompt rather than a conflict.
- **Unbinding or rebinding in one provider leaves the other untouched**, because no
  record spans providers.

The handle namespace is flat, tbd-local, and unregistered — the same posture as agent
names.
Its integrity check is diagnostic rather than structural: a handle that appears on
a bead but has no binding in any configured provider is either a typo or a person nobody
has bound yet, and `tbd doctor` reports it alongside the resolved actor table.

A central person record (`people/<handle>.yml` holding every provider id at once) was
considered and set aside.
It would be one file written by every provider’s setup path, so two providers binding
the same person collide on a single file, while per-provider records merge file-by-file
like the rest of bridge state.
The join costs nothing either way, since the handle is the key.
The point to revisit is if a person ever needs provider-independent attributes — a
canonical display name, a timezone — which nothing here requires.

The agent side is already per provider for the same reason: `agent_map` sits under
`integrations.linear`, and a GitHub agent binding would get its own key under its own
provider. Same shape, same reasoning.

### Agents are tbd identities

An agent actor is whatever tbd minted for the session doing the work: the friendly name
(`claude-code@host`, or whatever `--as` / `$TBD_AGENT` said) backed by the `agid-{ulid}`
identity, with durable per-agent records on the sync branch as the identity research
recommends.

This is the answer to “agents come and go”: they are **supposed to**. An agent identity
is minted at session start, not registered in advance, so there is nothing to maintain
when harnesses appear, models change, or sessions multiply.
The roster is observed data, not configuration.

An agent identity never publishes to a shared tracker.
The one exception is an agent that is genuinely long-lived and workspace-visible: an
**installed Linear agent** (a seat-free OAuth app user, e.g. Cyrus).
Publishing to one is a deliberate, reviewable act, so it is the only identity that
belongs in config:

```yaml
integrations:
  linear:
    agent_map:
      cyrus: <linear-app-user-id>   # the only identity config that remains
```

`kind` from the original #246 proposal disappears: the namespace carries it.
Humans are publishable because the directory knows them; agents are unpublishable
because only tbd knows them; `agent_map` is the explicit bridge for the rare identity
that is both.

### `tbd start` claims the acting axis

The claim verb is where the two axes meet, and rewiring it settles a question the first
draft left open: a claim **is** a delegation, so `tbd start`:

- sets `delegate` to the resolved agent name (today it sets `assignee`, `start.ts:142`);
- leaves `assignee` alone — the accountable human, or empty;
- moves the collision checks to `delegate` (“already claimed by X” compares the acting
  axis);
- sets `started_at` once the sibling’s Phase 2 lands.

`tbd whoami` and `--as` are unchanged.
Anything more frequent than the claim verb — heartbeats, session tracking — is presence
and stays out of beads entirely.

**Migration:** beads claimed under the interim wiring hold agent names in `assignee`.
The shapes are recognizable (roster names, `agid-` ids, the derived `<harness>@<host>`
form), the feature is days old, and the population is small: `tbd doctor` reports them,
and setup offers to move each to `delegate`.

### Mapping

| tbd | Linear | GitHub (when built) |
| --- | --- | --- |
| `assignee` = bound human | `assigneeId` | assignee |
| `assignee` = agent identity | never pushed; warned once | never pushed |
| `delegate` = agent in `agent_map` | `delegateId` → Linear creates an AgentSession | agent assignment |
| `delegate` = agent, unmapped | local only; reported skip | local only |
| `delegate` = human | local only; reported skip — Linear delegates are agents only | second assignee |

Inbound, a Linear delegate is always an app user: a known one maps through `agent_map`
in reverse; an unknown one warns and leaves the bead unchanged, matching how unmapped
assignees behave.

### Reporting

Two defects from a real debugging session, where a push reported success for a field
that was never eligible:

- The summary gains a field-level line for `skippedPushes`, and `--verbose` names each
  excluded field with its reason (`assignee: no binding for <handle>`,
  `assignee: not eligible (flow=local)`).
- Writing a value that can never publish under current config — an agent identity in
  `assignee` on a mirrored repository, a `delegate` with no `agent_map` entry — warns at
  write time instead of failing silently at sync time.

## Backward Compatibility

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**: KEEP DEPRECATED. `assignee` keeps
  its type and meaning; `delegate` is new and optional.
- **Library APIs**: KEEP DEPRECATED. New field is optional on every create/update path.
- **Server APIs**: N/A.
- **File formats**: SUPPORT BOTH. `delegate` is optional; absent reads as “same as
  assignee”. `f08` preserves unknown keys; whether the new bead fields need a format bump
  is one decision shared with the sibling.
- **Config**: NO CHANGE to `user_map` — the existing string form keeps parsing and keeps
  winning. `agent_map` is additive.
- **Data**: binding records and agent records are additive files under existing bridge
  and sync-branch layouts, and are per provider, so adding a second integration adds
  records rather than reshaping existing ones.
  The only migration is moving agent-shaped `assignee` values to `delegate`, reported by
  doctor and applied on confirmation.

## Implementation Plan

Depends on nothing in the sibling for Phase 1; Phase 2 reuses the sibling’s
resolver-and-ask machinery; each phase is useful without the ones after it.

### Phase 1: The delegate field and the claim verb

- [ ] Add `delegate` to the bead schema; absent reads as “same as assignee”
- [ ] `--delegate` on `tbd create` / `tbd update`, including the bulk path
- [ ] `tbd start` sets `delegate` instead of `assignee`; collision checks move with it
- [ ] Doctor reports agent-shaped `assignee` values; setup offers the move to `delegate`
- [ ] Field-level skip line in the sync summary; `--verbose` names each excluded field
  with its reason; write-time warning for values that can never publish
- [ ] Tests: claim sets delegate and preserves assignee; collision on delegate; the
  red-proof observability cases (a push whose `--verbose` output omits an excluded field
  fails; an unpublishable write that emits no warning fails); an `f08` client
  round-trips a bead carrying `delegate` without stripping it (the format-bump test,
  shared with the sibling)

### Phase 2: Human identity binding

- [ ] Add `listMembers()` to the adapter interface; implement it for Linear
- [ ] Directory resolution ladder (binding, email, login or display name, ask), written
  once against the adapter interface rather than inside the Linear adapter
- [ ] Persist bindings by provider user id under `bridge/<provider>/users/`; never guess
  non-interactively
- [ ] Inbound unknown assignee offers a binding interactively; reports otherwise
- [ ] `user_map` honored as an override; setup migrates entries to binding records
- [ ] `tbd doctor` prints the resolved actor table (handle, provider, user id, display
  name, bound-or-stale) offline, flags directory drift, and flags handles with no
  binding in any configured provider
- [ ] Tests: each ladder step; rename survival via id binding; ambiguity refuses
  non-interactively; migration from `user_map`; a handle bound in one provider and not
  another pushes to the first and reports a skip on the second

### Phase 3: Publishing delegates

- [ ] `agent_map` in config; outbound `delegate` → `delegateId` only for mapped agents
- [ ] Inbound delegate maps through `agent_map` in reverse; unknown app users warn and
  leave the bead unchanged
- [ ] An unmapped agent delegate produces a **reported** skip, never a silent one
- [ ] Tests: each mapping row round-trips; the unpublishable-agent case emits a skip; a
  human delegate is never sent to Linear

## Testing Strategy

Unit tests for the resolution ladders in both namespaces and for the mapping table,
including the three delegate cases, which differ only by what `agent_map` says about the
name. Round-trip tests through the existing Linear adapter fixtures for assignee and
delegate-as-app-user.
The two silent-gate defects get red-proof tests as listed in Phase 1. A migration test
covers a bead claimed under the interim wiring: after the move, the agent name is in
`delegate`, `assignee` is untouched, and a re-run is a no-op.

The per-provider claim is tested against a second provider rather than argued: with a
stub adapter standing in for a non-Linear tracker, one handle bound in both resolves to
two different ids, a handle bound in only one pushes there and reports a skip on the
other, and rebinding in one leaves the other’s record untouched.
This is what keeps the design honest before a real second adapter exists.

## Rollout Plan

Phase 1 is inert until a repository writes a `delegate`, and `tbd start`’s change lands
the claim on a field no sync path publishes by default.
Opening `assignee` to Linear still requires the existing flow-rule gate, so no workspace
starts receiving actor writes because of an upgrade.
Phase 2 writes bindings only at interactive confirmation or setup.
Phase 3 publishes only names listed in `agent_map`.

## Open Questions

Nothing here blocks Phase 1. Each question names the phase that has to answer it, so
implementation can start without resolving them all first.

- **Handle shape** (Phase 2). At bind time, is the handle the display-name slug, the
  email local-part, or free text at the prompt?
  The prompt’s default matters more than the rule, since bindings are made once.
- **Privacy hardening** (Phase 2). Binding records deliberately store provider ids,
  handles, and display names, not emails.
  Should that be schema-enforced so it cannot regress?
- **Session precision** (after Phase 1, from use).
  `delegate` carries the friendly name.
  Should the precise session (`agid-{ulid}`) also land on the bead as a `delegate_id`
  companion, or is per-session provenance the roster records’ job?
  Two concurrent sessions of the same harness on one host share a name, so the name
  alone cannot distinguish them; whether a bead needs to is the question.
- **Agent as assignee** (after Phase 1, from use).
  Reject at write time on tracker-mirrored repositories, or allow and never publish?
  Phase 1 implements the permissive default — allow, warn, never publish — because it
  keeps tbd usable for repositories that do not mirror.
  Tightening later is a one-line change; loosening after people have relied on rejection
  is not.
- **Central person record** (revisit only if needed).
  Per-provider bindings join on the handle and need no shared record.
  If a person ever needs provider-independent attributes, `people/<handle>.yml` is the
  shape to reconsider, along with the concurrent-write problem that set it aside.

Settled:

- **Field name is `delegate`.** It matches Linear exactly, and GitHub’s agent assignment
  is delegation-shaped as well, so a provider-neutral coinage (`acting`, `worker`) would
  buy distance from both vocabularies for no gain.
  Naming it is a Phase 1 precondition, so it is decided here rather than deferred.
- **Format bump: assume none, prove it.** `f08` preserves unknown keys, so a pre-change
  client should round-trip a bead carrying `delegate` without stripping it.
  Phase 1 pins that with a test rather than assuming it; a bump is cut only if the test
  fails, and then jointly with the sibling’s fields rather than for one field alone.
- **`delegate` is set automatically by the claim verb**, because a claim is a
  delegation. Nothing more frequent than the claim verb touches beads.
- **No identity table.** #246’s kind-bearing `user_map` is unnecessary once humans and
  agents resolve in separate namespaces.

## References

- [#246](https://github.com/jlevy/tbd/issues/246) — design discussion and provider
  comparison
- [#244](https://github.com/jlevy/tbd/issues/244) — the state axis
- [#245](https://github.com/jlevy/tbd/pull/245) — spec-lifecycle folders
- [plan-2026-08-18-tracker-state-model-and-linear-mapping.md](./plan-2026-08-18-tracker-state-model-and-linear-mapping.md)
  — the sibling spec, its resolver, and the board projection
- [research-2026-08-14-agent-and-session-identity.md](../../research/current/research-2026-08-14-agent-and-session-identity.md)
  — agent id format, roster records, and the flat-map hazard
- `packages/tbd/src/lib/agent-identity.ts`, `packages/tbd/src/cli/commands/start.ts` —
  the shipped identity machinery and the interim claim wiring
- `packages/tbd/src/integrations/linear/adapter.ts`,
  `packages/tbd/src/integrations/core/reconcile.ts` — the gates and the skip reporting
- Linear docs: [Assign and delegate issues](https://linear.app/docs/assigning-issues),
  [AI Agents](https://linear.app/docs/agents-in-linear),
  [Agents API](https://linear.app/developers/agents) — humans are assigned, agents are
  delegated; `IssueUpdateInput.assigneeId` / `delegateId`; `actor=app`;
  `app:assignable`; AgentSession lifecycle

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
