---
title: Agent Runtimes and Session Linkage
description: Where a coding agent runs, what identity its run carries, and the one contract tbd needs so a bead, a Linear issue, and the bead browser can all point at the same live session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Research: Agent Runtimes, Session Identity, and Linkage

**Date:** 2026-08-19

**Author:** Research brief (AI-assisted; vendor documentation, repository source read,
and the Anthropic Managed Agents reference bundled with the `claude-api` skill)

**Status:** Complete for the landscape survey and the linkage contract.
Runtime adoption is deliberately not decided; see [§11](#11-recommendations).

**Subsumes:**

- `research-running-claude-code.md` (last updated March 2026) — execution environments
  and the multi-agent orchestration survey
- `research-claude-code-orchestration-and-uis.md` (last updated 2026-03-09, status “In
  Progress”) — control protocols, IDE surfaces, and external orchestration interfaces

Both are archived under `docs/project/research/archive/`.
[§1](#1-what-this-subsumes-and-what-changed) records what carried forward, what was
corrected, and what was deliberately dropped.

**Related:**

- [Linear as a Task Surface for Beads and Agents](research-2026-08-09-linear-task-surfaces.md)
  — verified Linear API facts; §6.4 and §6.4a on Linear agent sessions are the inbound
  half of the linkage this brief designs
- [Keeping Agent Sessions Synchronized](research-2026-08-14-agent-sync-protocol-and-hooks.md)
  — the claim protocol and the audit that found Linear receives status but no actor
- [Agent and Session Identity Across Coding Agents](research-2026-08-14-agent-and-session-identity.md)
  — *who* the agent is; this brief covers *where its run lives and how to point at it*.
  The two are complements and neither subsumes the other
- [How Coding Agents Listen On and Monitor Issues](research-2026-06-04-agent-issue-monitors.md)
  — trigger and dispatch mechanics
- [API References for Bridge Integrations](api-references-bridge-integrations.md) —
  protocol reference (MCP, ACP, A2A, ANP);
  [§6.1](#61-acp-the-real-standard-and-what-it-does-not-cover) updates its ACP section

**Tracked as:** epic `tbd-owa5`.

* * *

## Overview

A user watching Linear, or the bead browser, should be able to click from a piece of
work to the agent session currently doing it, and see whether that session is running,
waiting, or dead.

Nothing in tbd can do that today, and the reason is not a missing integration.
It is that “the agent session” has no address.
`tbd start` records *who* claimed a bead
([the identity brief](research-2026-08-14-agent-and-session-identity.md)), but not
*where the run lives*, and every runtime answers that question differently or not at
all.

This brief surveys the runtimes, scores them on one property that turns out to be the
only one that matters for tbd, and proposes the contract that makes the choice of
runtime irrelevant.

The headline finding: **the layer tbd needs is not a runtime and not a wrapper.
It is a reference.** Every credible option can produce a provider name, a session id,
and a URL. That is the whole contract, it is about a day of work, and it survives any of
these vendors disappearing — which, as
[§8](#8-churn-the-case-against-betting-on-a-runtime) documents, several already have.

## Questions to Answer

1. What runtimes can host a coding agent, and which are genuinely platform-neutral?
2. Which of them expose a session that can be linked to and observed from outside?
3. Is there a standard for agent session identity, or anything converging on one?
4. What should tbd build, given that the answer to (3) is no?

## Scope

**In scope:** where a coding agent’s *run* executes and how an outside system addresses
and observes it. Sandboxes, harnesses, wrappers, control planes, and the protocols
between them.

**Out of scope:** agent *identity* (covered by
[the identity brief](research-2026-08-14-agent-and-session-identity.md)); prompt and
context engineering; Claude Code’s internal sub-agent architecture (covered by
`research-claude-code-sub-agents.md`); and the Linear mirror mechanism itself (covered
by [the Linear briefs](research-2026-08-09-linear-task-surfaces.md)).

**Method note:** vendor documentation and repository sources were read directly rather
than summarized from secondary coverage, and repository metadata (stars, licence, last
push) was pulled via `gh api` so staleness is visible.
Facts that could not be verified this way are marked in
[Appendix A](#appendix-a-what-is-not-verified).
Nothing here was probed against a live paid account, which is a real limit: the numbers
in [§4](#4-layer-1-the-sandbox) are vendor claims, not measurements.

* * *

## 1. What this subsumes, and what changed

### 1.1 Why these two, and not the others

The February–March 2026 research effort produced four sibling briefs that cross-cite
each other. Two of them are about *where agents run and how you drive them*, which is
exactly this brief’s subject, and both are now five to six months stale in a field that
has visibly churned.
Those two are subsumed.

The other two are not:

| Brief | Disposition | Why |
| --- | --- | --- |
| `research-running-claude-code.md` | **Subsumed** | Part 6 (execution environments) and Part 10 (ecosystem update) are this brief’s subject and are stale |
| `research-claude-code-orchestration-and-uis.md` | **Subsumed** | Control protocols and orchestration interfaces; status was still “In Progress” |
| `research-claude-code-sub-agents.md` | Kept | Internal sub-agent architecture; different subject, still accurate |
| `api-references-bridge-integrations.md` | Kept | Protocol reference material; [§6.1](#61-acp-the-real-standard-and-what-it-does-not-cover) supplies an ACP update rather than replacing it |

### 1.2 What carried forward

Four findings from the subsumed briefs were still correct and are preserved here rather
than lost:

- **Sprites as the notable execution environment.** Named correctly in March as the
  first sandbox to treat persistence as the point rather than a limitation.
  Carried into [§4](#4-layer-1-the-sandbox) with current figures.
- **Rivet’s Sandbox Agent as the universal-API answer.** The orchestration brief called
  it out in one line under “For sandbox deployment”.
  It deserved more, and the category it belongs to turned out to hold three serious
  implementations rather than one:
  [§5.1](#51-universal-wrappers-three-of-them-no-interop).
- **ACP as the portability story, with limitations.** Correct, and the limitation it
  named is the one that still disqualifies ACP for tbd’s purpose.
  See [§6.1](#61-acp-the-real-standard-and-what-it-does-not-cover).
- **The security framing for sandboxes.** VM-level isolation as the answer to an agent
  that goes wrong. Unchanged and still the main reason to use any of
  [§4](#4-layer-1-the-sandbox).

### 1.3 What was corrected

| Claim in the subsumed briefs | Status as of 2026-08-19 |
| --- | --- |
| Sprites “boot in 1–12 seconds” | Vendor now claims ~25ms cold start and ~300ms checkpoint restore. These measure different things and both may be true; treat the March figure as superseded rather than wrong |
| Terragon listed as a live option | **Shut down January 2026** |
| Vibe Kanban listed as a live option | Bloop, the company behind it, **shut down April 2026**; hosted offering winding down, maintenance is community-volunteer |
| Coder Tasks as the Coder entry point | **Being removed in v2.37 (2026-09-01)**, replaced by Coder Agents |
| ACP as an emerging protocol with uncertain adoption | Adoption resolved: JetBrains plus Zed, registry live 2026-01-28, 50+ agents by late June |

### 1.4 What was deliberately dropped

The subsumed briefs carried a large amount of ecosystem-watch material: star counts,
rebrands, per-project feature inventories, and security incidents in third-party
orchestrators. None of it is reproduced here.

That material aged badly precisely because it was a snapshot of a fast-moving field with
no decision attached to it.
This brief keeps only what bears on a decision tbd has to make.
If a reader wants the February–March snapshot, it is in the archive and in git history.

* * *

## 2. The three layers

Nearly every confusing conversation about “agent runtimes” comes from collapsing three
distinct layers into one word.

### 2.1 Layer 1 — the sandbox

An isolated machine: a container or microVM with a filesystem, a network policy, and a
lifecycle. E2B, Daytona, Modal, Morph, Runloop, Vercel Sandbox, Cloudflare Containers,
Fly.io Sprites.

What it gives you: isolation, and a sandbox id.

What it does not give you: any notion of an agent, a conversation, or a task.
A sandbox does not know an agent is running inside it.

### 2.2 Layer 2 — the harness

The thing that actually runs the agent loop: prompt, tool calls, context management.
Claude Code, the Claude Agent SDK, Codex CLI, OpenCode, Amp, Cursor, OpenHands.

What it gives you: a working agent, and usually a local session id it uses for resume.

What it does not give you: an address anyone else can use.
Claude Code emits JSONL over stdout; Codex speaks JSON-RPC. Both are local formats for a
local consumer.

### 2.3 Layer 3 — session identity and transparency

A stable identifier for one agent run, a URL a human can open, and a status a machine
can read. This is the scarce layer, and it is the only one tbd actually needs.

### 2.4 Why the layers get conflated

Because vendors sell across them.
Sprites ships with Claude Code and Codex preinstalled, which makes it look like a
harness. Claude Managed Agents runs the loop *and* provisions the container, which makes
it look like a sandbox.
Codex Cloud is all three at once and therefore looks like the whole answer, right up
until you need it on your own infrastructure.

The useful question is never “which runtime”, it is “which layer am I actually missing”.
For tbd the answer is layer 3, and layer 3 is a data-modelling problem rather than an
infrastructure one.

* * *

## 3. The linkability test

Three questions. A runtime is useful to tbd if it answers all three, and the amount of
adapter code needed is proportional to how many it answers natively.

1. **Does a session outlive the process that started it?** If the transcript dies with
   the shell, there is nothing to link to.
2. **Is there a URL a human can open?** Not an API response: a page.
   Linear’s `externalUrl` field and the bead browser both want a href.
3. **Can a machine read the status without scraping?** A documented endpoint or CLI flag
   returning something like running / waiting / done / failed.

A runtime failing (1) is disqualified.
Failing (2) means tbd renders an id with no click-through, which is worth roughly
nothing to a human watching Linear.
Failing (3) means the status goes stale silently, which is worse than showing nothing
because it looks alive.

* * *

## 4. Layer 1: the sandbox

Surveyed for completeness and to make one point: **none of these pass the linkability
test, and that is not a defect.** They are not trying to.

| Sandbox | Isolation | Vendor-claimed cold start | Persistence | Notable |
| --- | --- | --- | --- | --- |
| **Sprites** (Fly.io) | Firecracker microVM | ~25ms | Indefinite, object-store backed, 100GB NVMe | Checkpoint/restore ~300ms; hibernates when idle and stops billing; Claude Code and Codex preinstalled |
| **E2B** | Firecracker, dedicated kernel per sandbox | ~150ms | Ephemeral | Strongest hardware boundary in the category; enterprise tier with SOC2/BYOC |
| **Daytona** | Container | sub-90ms claimed, 27ms optimized | Ephemeral | Fastest published cold start |
| **Morph** | microVM | — | Snapshot/branch | Infinibranch: fork a running VM in under 250ms for parallel exploration |
| **Runloop** | Devbox | — | Persistent devboxes | Enterprise-first, benchmarking tooling |
| **Modal** | Container | — | Ephemeral | GPU-oriented |
| **Vercel Sandbox**, **Cloudflare Containers**, **Blaxel**, **Northflank** | Container | — | Varies | Platform-attached, convenient if you are already there |

**Assessment.** Sprites is the most interesting of these for agent work, for one
structural reason rather than a benchmark: an agent that can be checkpointed before a
risky operation and rolled back afterwards is qualitatively different from one that
cannot, and persistence across sessions means a workspace accumulates context instead of
being rebuilt. The user’s instinct that it “looked promising” is well founded.

But it is a layer-1 product.
It gives you a sandbox id, not a session, and putting a coding agent inside it leaves
you exactly where you started: an agent running somewhere with no address.
**Choosing a sandbox does not answer the visibility question at all**, which is why this
section is short and the next two are long.

Pricing has converged (E2B and Daytona both around $0.0504 per vCPU-hour), so this layer
is commoditizing. That is another argument for not coupling to any one of them.

* * *

## 5. Layer 2: harnesses, wrappers, and control planes

### 5.1 Universal wrappers: three of them, no interop

This is the layer the runtime question was really asking about, and it does not merely
exist: there are **three serious implementations**, none of which can talk to the
others. Their existence is the strongest argument in this brief, and so is their
disagreement.

#### 5.1a Rivet Sandbox Agent

[rivet-dev/sandbox-agent](https://github.com/rivet-dev/sandbox-agent) — Apache-2.0,
~1,540 stars, last pushed 2026-06-19. Launched 2026-01-28.

A single static Rust binary runs *inside* your sandbox and exposes HTTP plus SSE. Your
application connects remotely to drive Claude Code, Codex, OpenCode, Cursor, Amp, or Pi
through **one API**, swapping agents with a config change.

The three problems it states it solves are, almost verbatim, the three problems in this
brief:

1. Coding agents need sandboxes, and existing SDKs assume local execution.
2. Every coding agent has a different API, event format, and behaviour.
3. **Sessions are ephemeral** — transcripts live in the sandbox and die with the
   process. Sandbox Agent streams events in a **universal session schema** to storage you
   choose (Postgres, ClickHouse, Rivet), for replay and audit.

Properties that matter for tbd, read from the API surface:

- **Caller-chosen session ids.** `createSession("demo", {agent: "codex"})` takes the
  name from the caller.
  tbd could pass the bead id and the linkage becomes an identity rather than a lookup
  table. This is the single most valuable detail in this brief.
- **Resumable event streams.** `streamEvents(sessionId, {offset})` — an offset, so a
  poller that dies resumes without replaying everything.
- **Sandbox-neutral.** Installs with one curl into E2B, Daytona, Modal, Cloudflare
  Containers, or plain Docker.
  It sits *on top of* [§4](#4-layer-1-the-sandbox) rather than competing with it, which
  means picking it does not pick a cloud.
- **OpenAPI spec, plus a built-in Inspector UI** for sessions and events.
- Server mode or embedded TypeScript SDK.

**Linkability test:** passes (1) and (3) cleanly.
(2) is qualified — the Inspector is a UI you host, so the URL exists but you are running
it, which for a laptop-first tool means it is only reachable where the operator is.

**The caveat that matters:** last push 2026-06-19 is two months quiet, and it is a young
project from a single company.
The cleanest design here, and not a safe dependency.

#### 5.1b bb

[get-bb/bb](https://github.com/get-bb/bb) — MIT, ~2,400 stars, created 2026-02-24, last
pushed 2026-08-20. “The agent IDE that builds itself.”

The most architecturally complete entry in this brief, and the one closest to the
“linkable, clean wrapper” description.
Four components, with contracts between them rather than a monolith:

| Component | Role |
| --- | --- |
| **Server** | SQLite is the source of truth; exposes an HTTP API and pushes changes over WebSocket. Stateless itself |
| **Host daemon** | Runs on each **enrolled execution machine**. Provisions workspaces, runs provider processes, posts events back |
| **App** | Web UI for inspecting projects and threads and steering work |
| **CLI** (`bb`) | “First-class interface for both users and agents. Same capabilities as the app, scriptable” |

Two contract packages, `@bb/server-contract` and `@bb/host-daemon-contract`, are
explicit boundaries: “the server doesn’t know how workspaces are provisioned; the daemon
doesn’t know about threads or projects beyond what commands tell it.”

The data model is the part worth stealing.
A **thread** is the unit of work: a conversation with a provider, a lifecycle state, and
an **append-only event stream**. Threads can be `standard` or `manager` (coordinating
other threads) and can own child threads for delegation.
An **environment** binds a workspace directory to a host, and is garbage-collected when
no unarchived thread needs it.
A **host** is a long-lived daemon identity, so one server dispatches work across several
enrolled machines — which is the “deploy to GCP or AWS as needed” requirement met
directly, without bb itself being a cloud product.

Agents arrive through **plugins**, each shipping a provider bridge that speaks
line-delimited JSON-RPC 2.0 over stdio against a versioned, capability-negotiated
protocol (`@get-bb/plugin-sdk/provider-bridge`). The shipped bridges are
`provider-claude-code`, `provider-codex`, `provider-pi`, and — significantly —
**`provider-acp`**. See [§6.1](#61-acp-the-real-standard-and-what-it-does-not-cover) for
why that last one matters more than it looks.

**The finding that bears directly on this project:** bb ships a `tasks` plugin that is,
in its own words, “a **Linear-style tracker inside bb** for planning work, delegating it
to agents, and **keeping the task record connected to the threads doing the work**.” It
has projects, task keys, statuses, priorities, labels, subtasks, comments, agent
presets, and `bb tasks delegate PROD-1 --preset ...`.

That is the same design this brief proposes, arrived at independently, by people who had
the runtime in hand and still concluded the tracker needed a link to the thread.
It is simultaneously the best validation of [§9](#9-the-linkage-contract) and the
clearest overlap with tbd’s own model, and both facts should be said plainly.

#### 5.1b-i What the tasks plugin source actually does

The plugin was read at `e2749bc` rather than taken from its README, because a working
implementation of [§9](#9-the-linkage-contract) is worth more than any amount of
landscape survey. Five mechanisms, each of which answers a question this brief or the
spec had left open.

**A join table, not a field.** `task_threads` is keyed `(task_id, thread_id)` and
carries `preset_name`, `title`, `live_status`, `attached_at`, and `updated_at`
(`plugins/tasks/db/store.ts`). One task, many threads, with a **cached status and its
own timestamp on the link row**. That is the volatility split [§9.1](#91-the-ref-shape)
proposes, in a schema, reached independently.

**A five-value status vocabulary.** `liveStatusFromThread`
(`plugins/tasks/lifecycle/index.ts`) maps bb’s thread lifecycle onto the task’s view:

| bb thread status | Task-facing `live_status` |
| --- | --- |
| `starting` | `starting` |
| `active`, `stopping` | `working` |
| `idle` | `idle` |
| `error` | `failed` |
| deleted | `completed` |

Set beside [§9.3](#93-a-status-vocabulary-tbd-owns), the agreement is close enough to be
worth noticing: `starting`/`working`/`failed` are common, `idle` covers what tbd splits
into `waiting` and `stale`, and `completed` is tbd’s `done`. Four independent parties
(Linear, VS Code, codecast, bb) have now landed within one or two states of each other.

**Events for speed, reconciliation for correctness.** The plugin subscribes to
`thread.created`, `thread.active`, `thread.idle`, `thread.failed`, and `thread.deleted`
for live transitions, and runs a separate background reconcile loop whose own comment
calls it “a low-frequency recovery path for transitions that happen while the plugin is
unloaded.” This is exactly the conclusion the Linear brief reached about webhooks in
[§1.7 of that document](research-2026-08-09-linear-task-surfaces.md#17-webhooks): the
push channel is a fast path layered over a polling correctness layer, never a
replacement for it.
Seeing the same architecture arrived at for sessions is the strongest
evidence in this brief that the pattern is not Linear-specific.

**Concrete cadences, and bounded work.** `THREAD_STATUS_RECONCILE_INTERVAL_MS` is five
minutes and `THREAD_STATUS_IDLE_INTERVAL_MS` is sixty seconds.
The loop reconciles only threads whose status is **not** terminal, and terminal statuses
are sticky — a `completed` or `failed` link is never transitioned again.
Settled pairs therefore cost nothing, which is the same steady-size property the
[Linear integration design](../../../packages/tbd/docs/references/linear-integration-design.md)
insists on, applied to sessions.
The spec’s open question about a staleness threshold now has at least one worked answer
to argue with rather than a blank.

**A vanished thread is a decision, not an error.** `reconcileTrackedThread` catches SDK
error code `thread_not_found` and transitions the link to `completed`. That is a
deliberate, and optimistic, choice: a thread that disappeared may equally have crashed.
tbd’s derived `stale` ([§9.4](#94-freshness-is-the-hard-part)) is the more honest
handling of the same event, and this is the one place where the design here should
**not** follow bb.

**Two constraints a tbd adapter would inherit**, both confirmed in source rather than
inferred:

- **Thread ids are server-minted.** `raw-thread-id.ts` fixes the shape at `thr_` plus
  ten characters from a restricted alphabet, enforced by a Zod regex, and the tasks
  plugin rejects anything else with “threadId must be a bb `thr_*` id”.
  The caller-chosen-id trick that makes [Rivet](#51a-rivet-sandbox-agent) so clean is
  **not** available here.
- **There is no metadata field.** `createThreadRequestSchema`
  (`packages/server-contract/src/api/threads.ts`) accepts `title`, `origin`,
  `originPluginId`, `originKind`, `parentThreadId`, `sectionId`, and `startedOnBehalfOf`
  — and nothing free-form.
  Unlike Claude Managed Agents, which allows eight metadata keys, a bead id cannot be
  stamped onto a bb thread.

The second constraint matters less than it first appears, and the reason is the whole
argument of this brief: tbd’s ref lives **on the bead** and points outward, so bb never
has to store anything for the forward link to work.
Only `discover` — finding sessions tbd did not start — would need a title convention or
a local mapping. That a design survives contact with a runtime offering neither of the
two hooks it might have wanted is the best evidence available that
[§9.5](#95-why-this-is-not-a-standard-and-should-not-become-one) is right to keep the
ref local.

**Linkability test:** passes all three.
Threads have ids, lifecycle state, and an event stream; the app has URLs; the HTTP API
and CLI are first-class.
Remote access is either `bb connect` (a managed tunnel through getbb.app) or Tailscale
Serve.

**Caveats.** Self-described as in active development with evolving surfaces.
And a real security property, stated in bb’s own docs: **the public API is
unauthenticated and permits command execution and file reads.** Loopback is the default;
wildcard binding is explicitly “behind a trusted network boundary” only, never through a
public tunnel.

#### 5.1c Omnigent

[omnigent-ai/omnigent](https://github.com/omnigent-ai/omnigent) — Apache-2.0, ~9,070
stars, last pushed 2026-08-20, self-described **alpha**.

The broadest reach of the three.
A “meta-harness” over Claude Code, Codex, Cursor, OpenCode, Hermes, Pi, and custom
YAML-defined agents, which can be **mixed in the same session** — one agent reviewing
another’s work is a first-class flow rather than an integration.

For the deployment question it is the most direct answer in this brief: sessions run in
Modal, Daytona, Blaxel, Islo, E2B, CoreWeave, **Kubernetes**, OpenShell, Boxlite, or
Databricks sandboxes, launched from the CLI or provisioned per session by the server
("managed hosts"). Kubernetes alone covers GKE and EKS.

It also carries the two governance features the others lack: **policies** that pause for
approval before risky actions, cap spend, or restrict tools, scoped to a server, an
agent, or one chat; and session sharing so a teammate can watch live, co-drive, or fork.

**Linkability test:** passes.
Sessions are first-class, follow you across devices, and are shareable.

**Caveat:** alpha, and the largest surface area of the three, which is also the most to
depend on.

#### 5.1d How to read the three

|  | Rivet | bb | Omnigent |
| --- | --- | --- | --- |
| Shape | Daemon in a sandbox | Full agent IDE | Meta-harness |
| Agents | 6, adapter per agent | Plugin bridges, incl. **any ACP agent** | 6 + custom YAML, mixable in one session |
| Compute | 5 sandbox providers | Enrolled host daemons | 10 backends incl. Kubernetes |
| Session id | **Caller-chosen** | Server-minted thread id | Server-minted |
| Governance | None | Plugin-level | Policies, spend caps, approvals |
| Activity | Quiet since 2026-06 | Very active | Very active, alpha |

Three credible answers, no shared session format, no migration path between them, and
each is one company.
Picking one is a bet; recording a ref that any of them can satisfy is not.

### 5.2 Self-hosted control planes

**[Coder Agents](https://coder.com/docs/ai-coder/agents)** — beta since 2026-05-06. Runs
entirely on your own infrastructure: control plane, orchestration, and execution all
inside your deployment, with no SaaS component.
The agent loop, chat history, and tool execution stay in your network.
Works with AWS Bedrock, GCP Vertex, or a LiteLLM proxy for the model side, which is the
“deploy to GCP or AWS as needed” requirement met directly.

**Linkability test:** passes all three.
Sessions are workspace-scoped objects with a UI.

**Caveat:** Coder Tasks, the previous entry point, is removed from new releases starting
v2.37 on 2026-09-01, available only via ESR during the support period.
Anything built against Tasks needs to move to Agents.
That is a migration in progress, not a stable target.

**[OpenHands](https://arxiv.org/pdf/2407.16741)** — open platform, self-hostable, its
own harness rather than a wrapper around Claude Code or Codex.
Mature and genuinely neutral, but adopting it means adopting its agent rather than the
one the user already runs.

### 5.3 Vendor clouds

**Claude Managed Agents with a self-hosted environment.** The strongest match to
“platform-neutral runtime with real transparency”, with one significant qualification.

Setting `config.type: "self_hosted"` on an environment moves **tool execution** to
infrastructure you control (GCP, AWS, anywhere) while the agent loop stays on
Anthropic’s orchestration layer.
Connectivity is **outbound only**: your worker long-polls Anthropic’s work queue and
Anthropic never dials into your network.
No inbound ports, no public hostname, no tunnel.
For a laptop-or-VPC deployment story that is close to ideal.

What you get for linkage:

- A stable `session.id`, and a `metadata` object (max 8 keys) for stamping a bead id, so
  reverse lookup by `sessions.list` is possible.
- Statuses: `idle`, `running`, `rescheduling`, `terminated`.
- A live trace URL:
  `https://platform.claude.com/workspaces/{workspace}/sessions/{session_id}`, a Console
  page showing tool calls and messages streaming in real time.
  Note the workspace segment is not returned on the session object and must be carried
  as config.
- `sessions.list` / `retrieve`, an events stream, and HMAC-signed webhooks on state
  change (thin payloads: fetch the resource on receipt).

**Linkability test:** passes all three, and it is the only option here that passes (2)
without the user hosting the page.

**Qualifications, all of them real:** it is beta; it is available on the Claude API and
Claude Platform on AWS only, **not** Bedrock, Vertex, or Foundry; it is Claude-only, so
“or Codex” is out; and the harness is Anthropic’s Managed Agents loop, **not the Claude
Code harness**. If the requirement is “run my Claude Code setup, with my `CLAUDE.md` and
my MCP servers”, this is not that product.

**Amp.** Worth singling out because it has the best linkability story of anything
surveyed, by a distance.
Threads carry stable ids of the form `T-<uuid>` and resolve at
`https://ampcode.com/threads/T-<uuid>`, with four visibility levels (unlisted, meaning
anyone with the link; workspace; group; private) and an `@T-<id>` shorthand for
referencing a thread from inside a prompt.
**Orbs** are ephemeral remote VMs that run threads unsupervised, so a laptop can close
without ending the work.

That is the only URL in this entire brief that a teammate can open without a VPN, a
tunnel, or access to the operator’s machine, which is exactly the property a link pasted
into a Linear issue needs.
Amp has been an independent company, Amp Frontier Corporation, since December 2025.

**Linkability test:** passes all three, and it is the only entry whose URL is public by
construction.

**Caveat:** Amp is its own agent, not a wrapper.
“Run my Claude Code setup” is not on offer.
It belongs here as the reference for what a linkable session should look like, not as a
runtime tbd would adopt.

**Codex Cloud.** Fully hosted, no BYO-cloud option, but excellent on linkage: a task URL
under `chatgpt.com/codex`, and a scriptable CLI — `codex cloud list` with JSON output,
`codex cloud status <task_id>`, `codex apply <TASK_ID>`. Plain-text output prints the
task URL first. An adapter is roughly ten lines wrapping one command.

**Linkability test:** passes all three.
The constraint is deployment, not visibility.

### 5.4 Tracker-native agents

Covered in depth in [the Linear brief](research-2026-08-09-linear-task-surfaces.md)
§6.4a and only summarized here, because they solve the *inbound* problem (tracker
triggers agent) rather than the outbound one (agent reports to tracker).

- **[Cyrus](https://github.com/cyrusagents/cyrus)** — Apache-2.0. Watches Linear,
  GitHub, GitLab, and Slack; creates a git worktree per issue; runs Claude Code, Codex,
  Cursor, or Gemini; streams activity back as native Linear agent activities.
  Self-host or cloud. The most complete implementation of this pattern.
- **[linear-agent-bridge](https://github.com/MPIsaac-Per/linear-claude-bridge)** — runs
  a Claude Agent SDK session on your own machine with `cwd` at a directory you choose,
  so `CLAUDE.md`, MCP servers, and skills all load.
  Needs a public HTTPS route inbound (Tailscale Funnel in the documented topology) and a
  machine that stays on.
- **[claude-managed-agents-demo](https://github.com/linear/claude-managed-agents-demo)**
  — Linear’s own reference implementation, explicitly not for production.

**Relevance to this brief:** all three demonstrate that Linear agent activities are a
working live-status surface.
None of them is a runtime tbd would adopt.

### 5.5 Local orchestrators

Conductor, Sculptor, Claude Squad, Omnara, AQ. Single-user tools for driving 3–10 agents
on one machine, mostly via git worktrees, with Sculptor adding local Docker isolation
around Claude Code and Omnara adding a mobile-first encrypted relay.

**Linkability test:** fails (2) in every case.
Sessions are local, addressable only from the machine running them.
Useful products; irrelevant to a tracker linkage.

### 5.5a Observe-only: watching sessions you did not start

A category the earlier survey missed entirely, and the one most directly useful to tbd’s
first phase.

**[codecast](https://github.com/codecast-sh/codecast)** — MIT, small (~26 stars) but
pushed 2026-08-20. “See, steer, and remember every coding agent session.
Any agent, any machine.”

The mechanism is the interesting part: **a background daemon watches the harnesses’ own
history files** wherever you already run them, and syncs conversations in real time.
Claude Code, Codex CLI, Cursor, and Gemini today, with OpenCode and Pi named as coming.
No wrapper, no sandbox, no change to how the agent is launched.
On top of that it builds a searchable corpus (`cast search`, `cast ask`) and
`cast blame`, which is git blame where the author column is the agent conversation that
wrote the line.

Two things tbd should take from it:

1. **The technique.** Reading a harness’s history files is a proven way to obtain a
   session id and liveness for a run tbd did not launch, which is exactly what the
   `local` provider needs and what the spec listed as an open question.
2. **The status vocabulary.** Its live inbox classifies every session as **working,
   needs input, or idle**. That is independently the same distinction Linear draws with
   `active` / `awaitingInput` / `stale`, and the same one
   [§9.3](#93-a-status-vocabulary-tbd-owns) proposes.
   Three parties converging on the same three states without coordinating is the
   strongest signal in this brief that the vocabulary is right.

**Linkability test:** passes (1) and (3); (2) via a hosted dashboard or self-hosting.

**Caveat:** 26 stars is a prototype, not a dependency.
The technique is the takeaway.

### 5.6 The AWS stack, and where Kiro fits

The user’s read is right: **Kiro is a minor player for this purpose, because it is not a
runtime.** It is an agentic IDE whose unit of work is a natural-language specification,
with code as a build artifact of specs.
It launched internationally on 2026-05-07 and added a mobile app.
Interesting as a spec-driven workflow, and philosophically adjacent to how tbd already
treats plan specs, but it does not host anything.

AWS’s actual runtime answer is **Bedrock AgentCore** (GA since October 2025): a managed
agent runtime explicitly neutral across framework, model, and protocol, with Runtime,
Memory, Identity, Gateway, and Observability components.
The three-layer stack is Kiro (IDE), AgentCore (runtime), Strands (SDK).

**Linkability test:** passes, via AWS-native surfaces.
**Cost:** the stack is coherent because it is coupled, and adopting the runtime pulls
the observability and identity layers with it.
For a tool whose entire premise is git-native portability, that is a poor trade.

* * *

## 6. Protocols and near-standards

### 6.1 ACP: the real standard, and what it does not cover

The
[Agent Client Protocol](https://groundy.com/articles/acp-registry-is-live-zed-and-jetbrains-just-did-for-ai-agents-what-lsp-did/)
is the genuine standardization success in this space.
JSON-RPC 2.0 over stdin/stdout, created by Zed, adopted across the JetBrains IDE suite.
The ACP Registry launched 2026-01-28; more than 40 agents by 2026-04-20 and past 50 by
late June. Claude Code, Gemini CLI, Codex, OpenCode, Goose, Cline, and Auggie are all
reachable. Zed and JetBrains have native support; Neovim, Emacs, and VS Code have
community plugins. Anthropic has not adopted it natively; a bridge wraps Claude Code.

**Why it does not solve tbd’s problem.** ACP standardizes the *editor to local agent*
channel: stdio, one machine, one process pair.
It has session ids and no URLs, no remote transport, and no status anyone outside the
editor can query. It is LSP for agents, which is exactly the right analogy and exactly
why it is the wrong layer here.
LSP never told you where a language server was running either.

**But it composes upward, and that changes the arithmetic.** bb ships a `provider-acp`
bridge ([§5.1b](#51b-bb)), which means every agent in the ACP registry becomes reachable
through a wrapper that *does* mint a thread id, a URL, and a queryable status.
ACP supplies breadth; the wrapper supplies the address.
An adapter written against one wrapper therefore reaches 50+ agents rather than the
handful its own README lists, which is a materially better return on adapter code than
the per-agent adapters in §5.1a suggest.

This updates the ACP section of
[api-references-bridge-integrations.md](api-references-bridge-integrations.md), which
described adoption as uncertain.

### 6.2 VS Code agent sessions: the closest thing to a session registry

VS Code’s
[Agent Sessions view](https://code.visualstudio.com/learn/foundations/agent-sessions-and-where-agents-run)
aggregates local, background, and cloud sessions into one list with status and
last-active times, and can discover local sessions created by Copilot CLI, the Copilot
app, Claude Code, and Codex.
A session target control picks Local, Copilot, Claude, Codex, or Cloud.

This is the industry’s most convincing statement that “an agent session” is a real
first-class object with an id and a status.
It is also an editor feature, not a protocol, and its aggregation is local.

**What tbd should take from it:** the schema, not the integration.
Id, provider, status, last-active, pending-changes is close to the minimum viable
session record, and it was arrived at independently.

### 6.3 Linear agent sessions

Covered in [the Linear brief](research-2026-08-09-linear-task-surfaces.md).
Relevant here for one field: `agentSessionUpdate` accepts an **`externalUrl`**. A Linear
agent session can point at the run living somewhere else, which is precisely the
outbound edge of the linkage this brief proposes.
Session state (`pending`, `active`, `error`, `awaitingInput`, `complete`, `stale`) is
derived automatically from emitted activity, and plans give a live checklist.

### 6.4 What none of them standardize

There is no cross-vendor answer to “given this task, where is the agent working on it,
and is it still alive”.
ACP is local. VS Code is an editor.
Linear is a tracker.
Managed Agents, Codex Cloud, and Coder each have their own.
The gap is real and nobody is closing it.

That is not a reason to build a standard.
It is a reason to build the smallest possible adapter surface and stop.

* * *

## 7. Comparison matrix

Scored against [§3](#3-the-linkability-test).
“Own cloud” asks whether the compute can run on infrastructure you control.

| Runtime | Own cloud | Session outlives process | Openable URL | Machine status | Agents supported | Licence / status |
| --- | --- | --- | --- | --- | --- | --- |
| **Rivet Sandbox Agent** | Yes, any sandbox | Yes, universal schema to your storage | Self-hosted Inspector | Yes, HTTP + SSE, offset resume | Claude Code, Codex, OpenCode, Cursor, Amp, Pi | Apache-2.0, quiet since 2026-06 |
| **bb** | Yes, enrolled host daemons | Yes, threads with an event stream | Yes, app; `bb connect` or Tailscale for remote | Yes, HTTP + WebSocket + CLI | Claude Code, Codex, Pi, **any ACP agent** | MIT, very active; API unauthenticated |
| **Omnigent** | Yes, 10 backends incl. Kubernetes | Yes, sessions follow devices | Yes, shareable | Yes | Claude Code, Codex, Cursor, OpenCode, Hermes, Pi, custom YAML | Apache-2.0, very active, **alpha** |
| **Amp** | Orbs, vendor-run | Yes | **Yes, public `ampcode.com/threads/T-…`** | Search and feed; no documented list CLI | Amp only | Commercial |
| **codecast** (observe-only) | n/a, watches history files | Yes, permanent record | Hosted or self-hosted dashboard | Yes | Claude Code, Codex, Cursor, Gemini | MIT, ~26 stars |
| **Claude Managed Agents** (`self_hosted`) | Tool execution yes, loop no | Yes | Yes, Anthropic Console | Yes, plus signed webhooks | Claude only, not Claude Code harness | Beta; Claude API and Claude Platform on AWS only |
| **Coder Agents** | Yes, fully | Yes | Yes | Yes | Claude Code, Codex | Beta; Tasks removed v2.37 |
| **Codex Cloud** | No | Yes | Yes | Yes, `codex cloud list --json` | Codex only | GA, vendor-hosted |
| **Bedrock AgentCore** | Yes, AWS | Yes | AWS console | Yes | Any framework | GA, AWS-coupled |
| **Cyrus** | Yes | Yes, in Linear | Yes, the Linear thread | Via Linear | Claude Code, Codex, Cursor, Gemini | Apache-2.0, active |
| **Sprites / E2B / Daytona / Morph** | Vendor cloud, some BYOC | Sandbox only, no session concept | No | Sandbox lifecycle only | Any | GA |
| **Conductor / Sculptor / Omnara** | Local | Local only | No | Varies | Claude Code, Codex | Mixed |
| **ACP** | n/a | Local session ids | No | No | 50+ | Open standard |

**Reading the matrix.** Six rows pass all three tests *and* run on infrastructure you
control: Rivet, bb, Omnigent, Coder Agents, Managed Agents in self-hosted mode, and
Cyrus. Every one carries a caveat that disqualifies it as a dependency for a
general-purpose tool: quiet since June; unauthenticated API and evolving surfaces;
alpha; mid-migration; Claude-only beta; and Linear-specific respectively.

Amp scores highest on pure linkability and is the narrowest on agents.
That combination is not a coincidence: **the entries with the best session addresses are
the ones that control the whole stack**, and the entries that run any agent pay for that
breadth with a weaker address.

There is no safe choice.
That is the finding, and it is more firmly established with six candidates than it was
with three.

* * *

## 8. Churn: the case against betting on a runtime

Within the eight months covered by this brief and its predecessors:

- **Terragon** shut down, January 2026.
- **Bloop**, the company behind Vibe Kanban, shut down April 2026; the hosted product is
  winding down and maintenance depends on volunteers.
- **Coder Tasks**, the recommended entry point in May, is removed from new releases on
  2026-09-01.
- **Rivet Sandbox Agent**, the cleanest design in this brief, has had no commits for two
  months.
- **HumanLayer** (~11,300 stars) notes in its own repository that its code is largely
  deprecated in favour of a rebuild.

The clearest single piece of evidence is a curated list that keeps score.
The
[awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)
index maintains a **“Resting”** section for projects with no push in the last few
months, checked 2026-07-28. It held **seventeen** entries, several of them archived,
including Vibe Kanban and `gnap` — the latter a git-native agent protocol coordinating
agents through a shared repository as a task board, which is the nearest thing in the
ecosystem to tbd’s own premise.

The same index lists dozens of live orchestrators across eight categories.
A field with that many entrants, that many casualties, and no interop between the
survivors is not one to take a dependency in.

Meanwhile the layer beneath them is commoditizing on price and cold-start time, and the
layer above (trackers) has standardized on delegation.

A tbd feature that hard-codes any one of these acquires a maintenance liability with a
demonstrated half-life of under a year.
A tbd feature that stores *a provider name, an id, and a URL* does not care which of
them survive.

* * *

## 8a. Options considered

[§5](#5-layer-2-harnesses-wrappers-and-control-planes) assessed products; this section
assesses *postures* — the six strategies tbd could take, argued fully.
Skimming the matrix in [§7](#7-comparison-matrix) makes the ref look like an easy
default. It is the right call, but not an easy one: every option here has a real pull,
and the honest version of this analysis names what choosing the ref gives up.

### Option A: Define a session ref, write thin adapters

**Description:** the [§9](#9-the-linkage-contract) contract.
tbd stores provider, id, URL, actor, and timestamps; adapters translate provider status
into a vocabulary tbd owns; no runtime is adopted.

**Pros:**

- **Survives the churn.** The ref outlives any vendor in
  [§8](#8-churn-the-case-against-betting-on-a-runtime); a dead provider degrades to a
  404 link and a `stale` badge rather than a broken feature.
- **Proportionate.** One schema addition plus adapters measured in tens of lines,
  against integration surfaces measured in thousands (the Linear adapter alone is
  ~1,200).
- **Neutral by construction, not by promise.** `provider` is an opaque string, so
  neutrality cannot regress without someone deliberately special-casing a vendor.
- **Ships in the order value arrives.** The `local` case works offline on day one; every
  adapter after that is optional and independent.
- **Agrees with the governing idea.** The bead stays the system of record and the
  session is a projection onto it — the same shape that made the Linear integration
  sound.

**Cons:**

- **It is the shallowest possible integration.** A ref cannot steer a session, show a
  transcript, replay a run, or approve a tool call.
  Everything in [§5.1](#51-universal-wrappers-three-of-them-no-interop) does more.
- **Freshness is only as good as polling.** A push-based wrapper knows the instant a
  session dies; a poller knows at the next refresh.
  The `stale` derivation bounds the damage but does not eliminate it.
- **N small adapters are still N maintenance burdens**, each coupled to an
  undocumented-or-beta provider surface that can drift.
- **Reverse lookup is inconsistent.** Some providers can answer “which sessions belong
  to this bead” (`discover`); most cannot, so a session started outside `tbd start` may
  never be linked.

**Verdict: chosen.** The cons are bounded and mostly recoverable; the pros are
structural. This is [R1](#11-recommendations).

### Option B: Standardize on a universal wrapper

**Description:** bless one of the three wrappers as *the* tbd runtime — recommend it in
setup, document it as the way to run agents, build the session feature against its API.

The candidates differ enough to argue separately:

- **Rivet Sandbox Agent.** *For:* caller-chosen session ids collapse the linkage problem
  entirely (the bead id *is* the session id); the universal event schema persisted to
  your own Postgres is audit and replay for free; a single static binary with an OpenAPI
  spec is the easiest possible integration target.
  *Against:* two months without a commit; one company; the Inspector URL is only
  reachable where the operator hosts it; no governance layer; a fixed list of six
  agents.
- **bb.** *For:* the most complete architecture surveyed, with real contract boundaries;
  enrolled host daemons answer the multi-machine, deploy-to-GCP-or-AWS requirement
  natively; the `provider-acp` bridge makes one integration reach 50+ agents; very
  active; MIT. *Against:* it is an IDE, so adopting it adopts a server, a SQLite store,
  and an app, not just an API; its API is unauthenticated by design, so tbd would be
  recommending something users must firewall correctly; surfaces are self-described as
  evolving; and its `tasks` plugin is a tracker.
  That last point cuts deep: bb threads belong to bb’s tracker the way beads belong to
  tbd, so coupling to bb means two systems of record with overlapping ambitions — the
  exact conflict the Linear integration spent its whole design budget avoiding.
- **Omnigent.** *For:* the broadest compute story (ten backends including Kubernetes,
  which covers GKE and EKS directly); mixed-harness sessions; the only one with
  policies, spend caps, and approval gates; very active.
  *Against:* self-described alpha; the largest surface area to depend on; server-minted
  session ids; the youngest documentation of its data model.

**Pros (of the posture, whichever candidate):** visibility far beyond a status field —
live transcripts, steering, delegation, approvals; one adapter instead of N; tbd could
stop thinking about runtimes entirely.

**Cons:** it picks a winner in a market with a demonstrated casualty rate and no interop
between candidates, so the pick is sticky in exactly the way
[§8](#8-churn-the-case-against-betting-on-a-runtime) warns about; every candidate is one
company; a server on the install path contradicts tbd’s git-native, no-resident-process
premise; and the bb tasks plugin is evidence that wrappers grow trackers, so today’s
runtime partner is tomorrow’s competitor.

**Verdict: rejected as a posture; embraced as adapters.** Write the adapter for
whichever wrapper a user already runs ([R5](#11-recommendations)), recommend none.

### Option C: Bless a vendor cloud

**Description:** make one hosted runtime the documented path — Claude Managed Agents
with a self-hosted environment, Codex Cloud, or Amp orbs, with Bedrock AgentCore as the
AWS-native variant.

**Pros:**

- **The URLs are real.** Amp threads are public links by construction; the Managed
  Agents Console is a genuine live trace view.
  Nothing self-hosted matches either without the user running infrastructure.
- **Someone else operates it.** No daemon to babysit, no sandbox fleet, vendor-grade
  reliability and audit.
- **The CMA topology is genuinely good for tbd’s audience:** outbound-only long-polling
  means a laptop or a VPC worker with no inbound ports, no tunnel, no public hostname.

**Cons:**

- **Every candidate locks the agent choice.** CMA runs Anthropic’s loop (not the Claude
  Code harness), Codex Cloud runs Codex, Amp runs Amp.
  “Run Claude Code, Codex, or any other coding agent” — the actual requirement — is
  precisely what none of them offer.
- **Availability is conditional.** CMA is beta and absent from Bedrock, Vertex, and
  Foundry; Codex Cloud and Amp have no bring-your-own-cloud story at all.
- **A blessed cloud makes tbd vendor-specific in one step**, undoing the neutrality that
  motivated the survey.

**Verdict: rejected as the blessed path; carried as adapters** (Codex Cloud first,
[R4](#11-recommendations)), with CMA explicitly scheduled for re-evaluation
([R7](#11-recommendations)).

### Option D: Lean on tracker-native agent sessions

**Description:** skip the ref and surface liveness only where humans already look — a
Linear agent session per working bead, in the Cyrus pattern, with `externalUrl` pointing
wherever the run lives.

**Pros:**

- Zero new surface for a Linear-first team; the status appears inside the issue, which
  is where the question gets asked.
- The ecosystem has standardized on this gesture — delegation and agent sessions are
  Linear’s native model, filterable everywhere.
- Cyrus proves the pattern end to end, Apache-2.0.

**Cons:**

- **It couples visibility to one tracker.** tbd is multi-tracker by design (GitHub is
  the next adapter), and `tbd web` plus the CLI need the same answer Linear does; a
  Linear-only mechanism answers none of them.
- **Full agent sessions want infrastructure.** OAuth app, and for the delegation flow a
  reachable endpoint — the same hosting burden
  [the Linear brief](research-2026-08-09-linear-task-surfaces.md) §6.4 documents.
  (Proactive `agentSessionCreateOnIssue` without interaction scopes may dodge the
  webhook requirement, but that is unprobed.)
- **It reports into a surface tbd does not own**, so the bead browser inherits nothing.

**Verdict: complementary, not foundational.** It is the outbound edge of the round trip
— the spec’s Phase 2 `externalUrl` item — layered on the ref rather than replacing it.

### Option E: Observe-only, the codecast technique as the whole answer

**Description:** no ref written at claim; instead a watcher reads the harnesses’ own
history files and reconstructs sessions after the fact.

**Pros:**

- **Requires nothing from anyone.** No wrapper, no adapter cooperation, no change to how
  any agent is launched; it even backfills sessions tbd never knew about.
- Proven against Claude Code, Codex CLI, Cursor, and Gemini simultaneously.

**Cons:**

- **Local machines only.** A cloud run leaves no history file on any machine tbd can
  see, so the option answers exactly the cases the runtime question was not about.
- **History-file formats are internals.** They drift with harness releases and carry no
  compatibility promise; a watcher is a permanent maintenance treadmill.
- **It wants a resident daemon**, which tbd deliberately does not ship.
- **Transcripts are sensitive.** tbd should record that a session exists, not what was
  said in it; a content-indexing watcher changes the tool’s privacy posture.

**Verdict: adopt the technique, not the architecture** — read the history file once at
claim time to detect the session id ([R5a](#11-recommendations)); no daemon, no content.

### Option F: Build a tbd runtime

**Description:** tbd hosts or ships its own session-bearing runtime.

Rejected without a pros list worth writing.
[§8](#8-churn-the-case-against-betting-on-a-runtime) shows a crowded, funded field dying
at a visible rate; tbd’s differentiation is the git-native record, not compute.
This is [R6](#11-recommendations).

### Decision summary

| Option | Posture | Verdict | Carried into |
| --- | --- | --- | --- |
| A. Session ref + adapters | Neutral record | **Chosen** | R1–R4, the spec |
| B. Standardize on a wrapper | Adopt Rivet / bb / Omnigent | Adapters only | R5 |
| C. Bless a vendor cloud | CMA / Codex / Amp / AgentCore | Adapters only; CMA re-check | R4, R7 |
| D. Tracker-native sessions | Linear agent sessions | Complementary outbound edge | Spec Phase 2 |
| E. Observe-only watcher | History-file daemon | Technique only, at claim time | R5a |
| F. Own runtime | Build/host | Rejected | R6 |

The pattern across the verdicts is one sentence: **every option contributes its
mechanism and none earns a dependency** — which is what a commoditizing layer looks like
from the outside.

* * *

## 9. The linkage contract

### 9.1 The ref shape

tbd already has the mechanism: `refs` on beads, added in `f08` with `union_by_key`
merge. A session is one more ref kind.

```yaml
refs:
  - kind: session
    provider: codex-cloud        # codex-cloud | managed-agents | rivet | coder | cyrus | local
    id: task_01J...              # provider-native session/task id
    url: https://chatgpt.com/codex/tasks/task_01J...
    status: running              # see 9.3
    actor: claude@hostname       # from resolveAgentIdentity, ties to tbd start
    started_at: 2026-08-19T18:04:11Z
    updated_at: 2026-08-19T18:22:40Z
```

Nothing here is provider-specific.
`provider` is an opaque string, `url` is optional because some runtimes have none, and
`status` is a small closed vocabulary tbd owns.

### 9.2 Where the id comes from, per runtime

Adapter cost, honestly estimated:

| Provider | Source of id and status | Adapter size |
| --- | --- | --- |
| **codex-cloud** | `codex cloud list --json`, `codex cloud status <id>` | Trivial, wraps one command |
| **managed-agents** | `sessions.list` filtered on `metadata.bead_id`; URL from a workspace template | Small; needs a workspace config value |
| **rivet** | Caller-chosen session id — **pass the bead id directly**; status from HTTP | Smallest, because the id is already ours |
| **coder** | Workspace/session API | Small |
| **cyrus** | Already writes to Linear; read the Linear agent session | None on the tbd side |
| **local** | Claude Code session id from the harness, no URL | Degenerate case, id only |

The `local` row matters more than it looks.
Most runs today are a developer with a terminal, and a ref with an id, an actor, and no
URL is still strictly better than nothing: it tells a human watching Linear that
*something is running and when it last moved*.

### 9.3 A status vocabulary tbd owns

Runtimes disagree on names.
Managed Agents says `idle`, `running`, `rescheduling`, `terminated`. Linear says
`pending`, `active`, `error`, `awaitingInput`, `complete`, `stale`. Codex has its own.

tbd should normalize to the smallest set that answers a human’s question, and each
adapter maps into it:

`starting` · `running` · `waiting` (needs a human) · `done` · `failed` · `stale`

`stale` is not reported by any provider.
It is derived, and [§9.4](#94-freshness-is-the-hard-part) explains why it is the most
important value in the list.

### 9.4 Freshness is the hard part

A status field with no freshness is a liability.
A session that died silently reads `running` forever, and a reader who trusts it once
and gets burned stops trusting the whole surface.

Two rules, both cheap:

1. **Always render `updated_at` next to `status`.** “running, 4m ago” is honest;
   “running” is not.
2. **Derive `stale` locally.** Past a threshold with no update, tbd shows `stale`
   regardless of what the provider last said.
   This is the same judgment the Linear platform makes with its own `stale` session
   state, arrived at independently, which is some evidence it is the right call.

This also resolves a question left open in
[the sync brief](research-2026-08-14-agent-sync-protocol-and-hooks.md) §1.6, which found
that Linear has “no freshness” signal.
The session ref supplies one.

### 9.5 Why this is not a standard, and should not become one

The temptation is to define a session protocol.
Resist it: [§6](#6-protocols-and-near-standards) shows three well-resourced
organizations converging on similar schemas without agreeing, and tbd has no leverage to
change that.

The ref is a *local* record of a *remote* fact.
It does not need agreement from anyone, it degrades gracefully when a provider vanishes
(the ref remains, the link 404s, the status goes `stale`), and it costs one schema
addition.

* * *

## 10. What tbd already has

The prerequisites are further along than they look:

| Piece | State |
| --- | --- |
| `refs` list on beads with `union_by_key` | **Shipped** in `f08` |
| Agent identity (`resolveAgentIdentity`, `tbd whoami`) | **Shipped** |
| Claim primitive (`tbd start`) | **Shipped** |
| Managed block renderer | Shipped, but renders no actor or roll-up (bead `tbd-o6o6`) |
| Attachment metadata carrying canonical fields | Shipped (`mirror.ts:154-174`) |
| `tbd web` bead browser | Shipped, but **no addressable bead** (bead `tbd-kt7z`) |
| Linear `externalUrl` on agent sessions | Available on the platform, unused |

Two open beads are load-bearing for this work rather than adjacent to it: **`tbd-kt7z`**
(addressable bead in `tbd web`) is the destination for the inbound link, and
**`tbd-o6o6`** (managed block roll-up) is where the outbound link renders.

* * *

## 11. Recommendations

**R1. Define the ref, adopt no runtime.** Add `kind: session` to `refs` with the shape
in [§9.1](#91-the-ref-shape).
This is the whole strategic recommendation — argued against its five alternatives in
[§8a](#8a-options-considered) — and everything else is consequence.

**R2. Ship the degenerate case first.** `tbd start` writes a `local` session ref with
the harness session id, the actor, and timestamps.
No adapter, no network, immediately useful, and it proves the rendering path.

**R3. Render freshness everywhere status appears.** `status` and `updated_at` are one
unit and must not be separable in the renderer.

**R4. Codex Cloud is the first real adapter.** Highest ratio of value to code, and it
proves the model against a runtime tbd does not control.

**R5. Write wrapper adapters, adopt no wrapper.** Rivet’s caller-chosen session ids make
the bead id *the* session id, which is the cleanest possible version of this and worth
the first wrapper adapter.
But bb and Omnigent are both larger and far more active, and bb’s `provider-acp` bridge
means one adapter against it reaches the whole ACP registry rather than a fixed list.
Write adapters for the wrappers users actually run, document them, keep every one
opt-in, and put none of them on the install path.

**R5a. Steal codecast’s technique for the local provider.** Watching the harnesses’ own
history files gets a session id and liveness for runs tbd never launched, with no
wrapper and no change to how anyone starts an agent.
That is the highest-value idea in this brief for the phase that ships first.

**R6. Do not build a hosted tbd runtime.**
[§8](#8-churn-the-case-against-betting-on-a-runtime) is the argument.
The market has more entrants than survivors and tbd’s advantage is being git-native and
local-first.

**R7. Revisit Managed Agents self-hosted environments in one quarter.** It is the best
architecture on offer for a laptop-first tool: outbound-only, no tunnel, real Console
visibility. It is beta and Claude-only today.
If it stabilizes and the harness gap closes, it changes the recommendation.

* * *

## 12. Open questions

1. **Does a session ref belong on the bead, or in local state?** A bead is committed to
   git and shared; a session is ephemeral and machine-local.
   Writing every session to the bead store adds commit churn to exactly the hot path
   [the sync brief](research-2026-08-14-agent-sync-protocol-and-hooks.md) worked to make
   quiet. Splitting them means two lookups.
   **This is the main unresolved design decision** and the spec should settle it before
   implementation.
2. What is the right staleness threshold, and should it vary by provider?
3. Should a closed bead retain its session refs, or should they be pruned?
   Retaining gives an audit trail; pruning keeps the bead small.
4. If two agents claim the same bead, does it carry two session refs, or is the second a
   conflict?
5. Does the Linear managed block render the session link, an agent session with
   `externalUrl`, or both?

* * *

## Appendix A: What is not verified

Stated plainly, because this repository’s convention is that unverified claims are
marked rather than smoothed over.

- **All sandbox performance figures in [§4](#4-layer-1-the-sandbox) are vendor claims.**
  Nothing was benchmarked.
  The Sprites cold-start discrepancy with the March brief is noted but not resolved.
- **The three universal wrappers were read, not run.** None was installed or exercised.
  Repository activity is a fact; fitness is not.
  The depth differs, and the difference matters: **bb was read from a local checkout**,
  so the claims in [§5.1b-i](#51b-i-what-the-tasks-plugin-source-actually-does) — the
  join-table schema, the status mapping, the reconcile cadences, the `thread_not_found`
  handling, the server-minted id, the absent metadata field — come from source and can
  be trusted at the level of “this is what the code says”.
  Omnigent and Rivet were assessed from documentation only, and their entries deserve
  the same scepticism as the rest of this survey.
- **No paid account was used.** Managed Agents self-hosted environments, Coder Agents,
  and Codex Cloud were read from documentation, not exercised.
- **Rivet’s caller-chosen session id** is read from the README’s API overview
  (`createSession("demo", …)`). That it accepts arbitrary strings such as a bead id is
  inferred from the signature, **not confirmed**, and it is load-bearing for
  [R5](#11-recommendations).
  Probe before relying on it.
- **The Managed Agents Console URL** requires a workspace segment not present on the
  session object. The failure mode for a wrong workspace is a “Session not found” page,
  not a redirect.
- Claude Code and Codex local session id formats and lifetimes were not re-verified
  here; see [the identity brief](research-2026-08-14-agent-and-session-identity.md).

## References

### Sandboxes

- [Sprites, Thoughtworks Technology Radar](https://www.thoughtworks.com/radar/platforms/sprites)
- [Sandboxes for coding agents, 2026 comparison](https://blaxel.ai/blog/sandboxes-for-coding-agents-comparison)

### Universal wrappers

- [bb](https://github.com/get-bb/bb) — MIT agent IDE; `docs/system-overview.md`,
  `docs/provider-bridge-protocol.md`, `docs/multiple-devices.md`, and
  `plugins/tasks/README.md` read directly
- [Omnigent](https://github.com/omnigent-ai/omnigent) — Apache-2.0 meta-harness
- [Rivet Sandbox Agent](https://github.com/rivet-dev/sandbox-agent) and its
  [launch note](https://rivet.dev/changelog/2026-01-28-sandbox-agent-sdk/)
- [codecast](https://github.com/codecast-sh/codecast) — observe-only session recorder
- [Amp owner’s manual](https://ampcode.com/manual) — threads, thread visibility, orbs
- [OpenCode](https://github.com/anomalyco/opencode) — `opencode serve`, OpenAPI 3.1,
  generated SDK

### Harnesses and control planes

- [Rivet Sandbox Agent](https://github.com/rivet-dev/sandbox-agent) and its
  [launch note](https://rivet.dev/changelog/2026-01-28-sandbox-agent-sdk/)
- [Rivet Sandbox Agent SDK coverage, InfoQ](https://www.infoq.com/news/2026/02/rivet-agent-sandbox-sdk/)
- [Coder Agents](https://coder.com/docs/ai-coder/agents),
  [self-hosted coverage, InfoQ](https://www.infoq.com/news/2026/05/coder-agents-self-hosted-ai/)
- [Codex CLI reference](https://developers.openai.com/codex/cli/reference)
- [Amazon Bedrock AgentCore GA](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available)
- [Amazon’s three-layer agent strategy](https://agentmarketcap.ai/blog/2026/04/08/amazon-three-layer-agent-infrastructure-kiro-bedrock-agentcore-strands-sdk)
- Anthropic Managed Agents reference, bundled with the `claude-api` skill
  (`shared/managed-agents-core.md`, `shared/managed-agents-self-hosted-sandboxes.md`,
  `shared/managed-agents-webhooks.md`, `shared/platform-availability.md`)

### Tracker-native agents

- [Cyrus](https://github.com/cyrusagents/cyrus)
- [linear-agent-bridge](https://github.com/MPIsaac-Per/linear-claude-bridge)
- [Linear claude-managed-agents-demo](https://github.com/linear/claude-managed-agents-demo)

### Protocols and session surfaces

- [ACP Registry launch](https://groundy.com/articles/acp-registry-is-live-zed-and-jetbrains-just-did-for-ai-agents-what-lsp-did/)
- [VS Code: agent sessions and where agents run](https://code.visualstudio.com/learn/foundations/agent-sessions-and-where-agents-run)
- [Linear agent interaction](https://linear.app/developers/agent-interaction)

### Ecosystem churn

- [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)
  — the eight-category index and its “Resting” watchlist, checked 2026-07-28
- [vibe-kanban alternatives, and the Bloop and Terragon shutdowns](https://aq.dev/alternatives/vibe-kanban/)
- [Coder Tasks removal notice](https://coder.com/docs/ai-coder/tasks)

### Internal

- [plan-2026-08-19-agent-session-refs-and-runtimes.md](../../specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md)
  — the spec this brief informs
- `packages/tbd/src/integrations/core/mirror.ts`,
  `packages/tbd/src/integrations/core/managed-block.ts` — the renderers a session ref
  would extend
- `packages/tbd/src/lib/agent-identity.ts` — `resolveAgentIdentity`, the source of
  `actor`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
