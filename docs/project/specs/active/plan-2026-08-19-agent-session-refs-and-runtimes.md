---
title: Agent Session Refs and Runtimes
description: Give every bead a reference to the live agent session working on it, rendered in tbd web and Linear, populated by thin per-runtime adapters so no agent runtime or wrapper vendor becomes load-bearing
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Agent Session Refs and Runtimes

**Date:** 2026-08-19 (last updated 2026-08-19)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Draft

**Research:**
[research-2026-08-19-agent-runtimes-and-session-linkage.md](../../research/current/research-2026-08-19-agent-runtimes-and-session-linkage.md)
— the runtime survey, the linkability test, and the ref shape.
This spec sequences that work and settles the one design question the brief left open;
it does not re-argue the survey.

**Tracked as:** epic `tbd-owa5`.

## Overview

A bead should be able to say where the agent working on it is running, and a reader in
Linear or the bead browser should be able to click through to it and see whether it is
still alive.

`tbd start` already records *who* claimed a bead.
This spec adds *where the work is happening*: a `session` ref carrying a provider, an
id, a URL, and a status, written by the claim path and refreshed by thin adapters,
rendered everywhere a bead is displayed.

The research brief’s conclusion drives the shape of this spec: **the scarce layer is not
a runtime, it is a reference.** Every credible runtime can produce a provider name, a
session id, and a URL, and several of the tools that could have supplied a hosted answer
have shut down inside a year.
So tbd defines the ref and writes adapters measured in tens of lines, and stays out of
the runtime business.

## Goals

- **A bead names its live session.** Provider, id, URL, actor, and timestamps, on the
  bead, in a form that survives a provider disappearing.
- **Status is never shown without freshness.** `status` and `updated_at` render as one
  unit, and tbd derives `stale` locally rather than trusting a provider’s last word.
- **The degenerate case works first.** A plain local Claude Code or Codex run with no
  hosted anything still produces a useful ref.
- **Adapters are small and optional.** Adding a runtime is a file, not a refactor.
  Removing one is a deletion.
- **Both click-throughs are real.** From Linear into the session, and from the session’s
  tracker thread back into the bead browser.

## Non-Goals

- **Building or hosting a tbd agent runtime.** Explicitly rejected; see the research
  brief §8.
- **Adopting a specific runtime on the install path.** Adapters ship, defaults do not.
- **Defining a cross-vendor session protocol.** Three well-resourced organizations have
  converged on similar schemas without agreeing.
  tbd records a local view of a remote fact and needs nobody’s agreement.
- **Driving agents.** This is reporting, not dispatch.
  Starting work from a tracker is the inbound problem covered by
  [plan-2026-08-14-external-sync-and-traceability.md](plan-2026-08-14-external-sync-and-traceability.md).
- **Changing agent identity.** `resolveAgentIdentity` is the source of `actor` and is
  unchanged.

## Background

The audit in
[research-2026-08-14-agent-sync-protocol-and-hooks.md](../../research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md)
§1.6 found that Linear receives a bead’s status but no actor, no in-flight detail, and
**no freshness**: a stale mirror and a quiet project look identical.

Phase 2 of the traceability spec fixed the local half by shipping `tbd start`,
`tbd whoami`, and agent identity.
The projection half is still open (`tbd-o6o6`, `tbd-9j5a`, `tbd-klgh`), and even when it
lands it answers “who claimed this” rather than “is that still running, and where can I
watch it”.

One external check is worth stating before the design, because it is the closest thing
to independent validation this spec has.
bb, an actively developed agent IDE that runs Claude Code, Codex, and any ACP agent,
ships a `tasks` plugin described as “a Linear-style tracker inside bb for planning work,
delegating it to agents, and keeping the task record connected to the threads doing the
work.” People who already owned the runtime still concluded that the tracker record
needed a link to the thread.
That is the same conclusion this spec reaches from the other direction, and it is also
the clearest overlap with tbd’s own model, which is worth knowing rather than
discovering later.

The runtime survey exists because the obvious way to answer the second question is to
adopt a runtime that answers it for you.
The survey concluded that no such runtime is safe to depend on, and that the useful part
of all of them reduces to three fields.

## Design

### The decision the research brief left open

The brief flagged one unresolved question: does a session ref belong on the bead
(committed, shared, but churn-inducing) or in local state (cheap, but invisible to
Linear)?

**Resolved: split by volatility, following the precedent already documented in**
[linear-integration-design.md](../../../../packages/tbd/docs/references/linear-integration-design.md).
That document’s rule is “anything Linear can change without tbd’s involvement belongs on
the bridge record, not the bead.”
The same test applies here, with the provider in Linear’s place:

| Fact | Volatility | Home | Written |
| --- | --- | --- | --- |
| `provider`, `id`, `url`, `actor`, `started_at` | Immutable for the life of the session | **Bead `refs`** | Once, at claim |
| `status`, `updated_at` | Changes every poll | **`.tbd/state.yml`** (local, untracked) | Freely, no commit |
| Last-projected status | Changes when the tracker is updated | **Bridge record** (sync branch) | Per sync, as today |

This keeps the hot path quiet.
A status poll every few seconds touches an untracked local file and never produces a
commit, which preserves the “a quiet sync writes nothing” property Phase 0 of the
traceability spec worked to establish.
The durable fact that *this bead was worked by this session* is written once and is
worth committing.

The cost is that a second machine sees the ref but not the live status, and correctly
renders `stale`. That is the honest answer for a machine that cannot observe the run.

### The ref shape

`refs` already exists on beads from `f08` with `union_by_key` merge semantics.
A session is one more kind:

```yaml
refs:
  - kind: session
    provider: codex-cloud
    id: task_01J...
    url: https://chatgpt.com/codex/tasks/task_01J...
    actor: claude-code@spud10
    started_at: 2026-08-19T18:04:11Z
```

`provider` is an opaque string; tbd does not validate it against a registry.
`url` is optional, because a purely local run has none.

### Refresh: events first, reconciliation as the backstop

Adapters should not poll as their primary mechanism where a push channel exists.
The pattern to follow is the one bb’s tasks plugin uses and the one the Linear brief
reached independently about webhooks: **subscribe for speed, reconcile for
correctness.** The push channel carries live transitions; a low-frequency sweep repairs
whatever was missed while tbd was not running, which for a CLI is most of the time.

Two rules keep the sweep bounded, both worth taking directly:

- **Reconcile only non-terminal refs.** A settled session costs nothing.
- **Terminal statuses are sticky.** Once `done` or `failed`, a ref is never transitioned
  again, which prevents a late or duplicated event from resurrecting finished work.

One deliberate divergence: bb treats a session its API can no longer find as
`completed`. tbd should treat it as `stale`. A thread that vanished may equally have
crashed, and the whole argument of [the freshness rule](#status-vocabulary) is that
guessing optimistically about liveness is the failure mode that destroys trust in the
surface.

### Status vocabulary

Providers disagree on names, so tbd normalizes and each adapter maps into a set chosen
to answer a human’s question rather than to model a runtime:

`starting` · `running` · `waiting` · `done` · `failed` · `stale`

`waiting` means a human is blocking it.
`stale` is never reported by a provider: it is derived when `updated_at` passes a
threshold, and it wins over whatever the provider last said.
Rendering `running` for a session that died an hour ago is worse than rendering nothing,
because a reader who is burned once stops trusting the surface.

### Components

| Component | Change |
| --- | --- |
| `lib/schemas.ts` | `session` ref kind and its fields |
| `cli/commands/start.ts` | Write the ref at claim; mint the local-provider id |
| `file/config.ts` (local state) | Session status map, keyed by session id |
| `integrations/core/managed-block.ts` | Render session line with status and freshness |
| `integrations/core/mirror.ts` | Carry session fields into attachment metadata |
| `web/` | Session row on the bead view, linked |
| `integrations/sessions/*.ts` (new) | One file per adapter, behind a registry mirroring `integrations/core/registry.ts` |

### Adapter interface

Deliberately tiny. An adapter answers one question: given a session ref, what is its
status now.

```ts
export interface SessionAdapter {
  readonly provider: string;
  /** Status for the given refs, or undefined for any it cannot resolve. */
  poll(refs: readonly SessionRef[]): Promise<Map<string, SessionStatus>>;
  /** Optional: discover sessions this provider believes belong to a bead. */
  discover?(beadId: string): Promise<SessionRef[]>;
}
```

`discover` is optional because only some providers support reverse lookup.
Managed Agents does, via `sessions.list` filtered on `metadata.bead_id`. Codex Cloud
does not, so its adapter implements `poll` only.

### API changes

New surface, all additive:

- `tbd start <id> --session-url <url>` and `--session-provider <name>` for a runtime tbd
  cannot detect. Detection is best-effort; the flags are the escape hatch.
- `tbd sessions` lists known sessions with status and age.
  `--json` for scripting.
- `tbd sessions refresh [<id>]` polls adapters and updates local state.
- `tbd prime` reports live sessions alongside claimed work, closing bead `tbd-zhel`.

No format bump. `refs` was designed for this in `f08`, which is the point of having done
the schema work once.

## Implementation Plan

### Phase 1: The ref, the local case, and the renderers

Everything here is offline and needs no adapter, no network, and no runtime decision.

- [ ] Add the `session` ref kind to the schema, with tests for `union_by_key` merge
- [ ] `tbd start` writes a `local` session ref: harness session id where detectable, a
  minted id where not, plus actor and `started_at`
- [ ] Session status map in `.tbd/state.yml`, with the derived `stale` rule
- [ ] `tbd sessions` and `tbd sessions refresh`
- [ ] Render the session line in the managed block, always with `updated_at`
- [ ] Render the session row in `tbd web`
- [ ] `tbd prime` reports live sessions (`tbd-zhel`)

Phase 1 is shippable and useful on its own: a human watching Linear sees “running, 4m
ago, claude-code@spud10” where today they see nothing.

### Phase 2: Adapters and the round trip

- [ ] Adapter registry, mirroring the integration registry pattern
- [ ] Codex Cloud adapter: wraps `codex cloud list --json` and `codex cloud status`
- [ ] Wrapper adapter, one of three.
  All three universal wrappers expose a session id, a status, and an HTTP API, so the
  adapter shape is identical and the choice is about which one users run.
  **Rivet** is the cleanest fit because session ids are caller-chosen, so the bead id
  *is* the session id — probe that assumption first, it is marked unverified in the
  research brief’s Appendix A. **bb** reaches the furthest per line of adapter code,
  because its `provider-acp` bridge makes the whole ACP registry addressable through one
  API. **Omnigent** is the most active and the broadest on compute, including
  Kubernetes, and is self-described alpha **Probe the caller-chosen-id assumption
  first** (research brief, Appendix A)
- [ ] Managed Agents adapter: `sessions.list` on `metadata.bead_id`, Console URL from a
  configured workspace value, `discover` implemented
- [ ] Set `externalUrl` on the Linear agent session so the tracker points at the run
- [ ] Make the reverse click-through real, which needs `tbd-kt7z` (addressable bead in
  `tbd web`)

Phase 2 depends on Phase 1 and on `tbd-kt7z`. Each adapter is independently shippable
and none is on the default path.

## Testing Strategy

- **Unit:** ref merge semantics under `union_by_key` including the two-agent case; the
  `stale` derivation at threshold boundaries; each adapter’s status mapping into the tbd
  vocabulary, driven by recorded provider payloads.
- **Golden:** managed block and `tbd web` rendering with a session present, absent, and
  stale. The absent case matters most: it is what most beads look like.
- **Mock server:** follow `tests/helpers/linear-mock-server.ts` for the HTTP adapters
  rather than hitting live providers in CI.
- **Live QA:** a playbook entry per adapter in the style of
  `tests/qa/linear-integration.qa.md`, since the survey’s facts are
  documentation-derived and every adapter’s first contact with a real provider is where
  they get tested.

## Rollout Plan

Phase 1 ships behind no flag: it writes a ref that is inert if nothing reads it, and the
renderers degrade to today’s output when no session is present.

Adapters ship disabled.
Each is opt-in through integration config, consistent with the existing
`integrations.<provider>.enabled` pattern.
Nothing in `tbd setup` selects a runtime, which is the whole point of the design.

## Open Questions

1. **Staleness threshold.** A fixed default, or per-provider?
   A Codex Cloud task can be legitimately quiet for minutes; a local Claude Code session
   that has not moved in thirty seconds probably has a human reading a diff.
   Starting fixed and generous is safer than starting clever.
   There is now one worked answer to argue with: bb’s tasks plugin reconciles live links
   every **five minutes** and idles at **sixty seconds** when nothing is live, with
   events carrying the fast transitions in between.
2. **Retention on close.** Do session refs survive bead closure as an audit trail, or
   get pruned to keep beads small?
   Retention argues for the traceability goal; pruning argues for the steady-size
   property the Linear design doc insists on.
   bb’s answer is to keep the link row and make terminal statuses **sticky**: once a
   link reads `completed` or `failed` it is never transitioned again and never
   reconciled again, so retention costs storage but no recurring work.
   That resolves most of the tension and is probably what tbd should copy.
3. **Two claimants.** Two session refs on one bead, or a conflict to surface?
   Related to the zombie-claim sweep (`tbd-qxdb`).
4. **Linear rendering.** Managed block line, native agent session with `externalUrl`, or
   both? Both is more work and more honest; the managed block reaches readers who never
   open an agent thread.
5. **Local session id detection.** `tbd start` should read the harness’s own session id
   where it can. The technique is proven rather than speculative: codecast runs a
   background daemon that watches the harnesses’ history files for Claude Code, Codex,
   Cursor, and Gemini, with no wrapper and no change to how the agent is launched.
   Read at claim time rather than watched continuously, that is a bounded amount of
   work. Unresolved harnesses fall back to a minted id, which is still useful.

## References

- [Research: Agent Runtimes, Session Identity, and Linkage](../../research/current/research-2026-08-19-agent-runtimes-and-session-linkage.md)
  — the survey, the linkability test, and the ref shape this spec implements
- [Research: Agent and Session Identity Across Coding Agents](../../research/current/research-2026-08-14-agent-and-session-identity.md)
  — where `actor` comes from, and what harnesses expose as a session id
- [Research: Keeping Agent Sessions Synchronized](../../research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md)
  — §1.6, the finding that Linear has no actor and no freshness
- [Feature: External Sync and Traceability](plan-2026-08-14-external-sync-and-traceability.md)
  — the `refs` list, `tbd start`, and the phases this one builds on
- [Linear Integration Design](../../../../packages/tbd/docs/references/linear-integration-design.md)
  — the identity-versus-dynamics split this spec reuses for the volatility question
- `packages/tbd/src/integrations/core/managed-block.ts`,
  `packages/tbd/src/integrations/core/mirror.ts` — the renderers Phase 1 extends
- `packages/tbd/src/lib/agent-identity.ts` — `resolveAgentIdentity`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
