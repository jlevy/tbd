# Research: Bead Watching, Comments, and Cross-Agent Coordination

**Date:** 2026-09-06

**Status:** Research complete; design selection and operational experiments remain open.

**Source baseline:** tbd v0.8.1, `c218e90b45c18114a26935dded8fa2cb3b044ede`.

**Landing review:** rebased onto `c43e2d41` (PR #264); readiness changes are
incorporated below. Earlier probe/test results remain attributed to the original
baseline.

**Tracking:** tbd-kvs3.

## Overview

tbd already supplies much of the durable task state needed for agents to cooperate:
stable bead identities, dependencies, delegation, a local claim operation, Git exchange,
remote change watching, and bidirectional Linear comments on linked beads.
The largest gaps are the guarantees connecting these pieces: distinguishing concurrent
sessions, making ownership authoritative across replicas, preserving comments in every
recovery path, avoiding duplicate external posts, and bringing an idle agent back into
execution.

The remote watcher is a useful, carefully isolated Git observer.
It reports net differences between committed snapshots.
It does not supply an operation journal, inbox, scheduler, or distributed claim service.
Existing comments are a bounded external-tracker projection embedded in issue documents,
rather than a native communication facility for arbitrary beads.

Independent comment documents with immutable IDs are a strong candidate for that native
facility. They avoid shared-file edits for independent additions and fit tbd’s stable
identity model. They still need explicit mutation, alias, recovery, delivery, and
compatibility semantics.
This research compares that candidate with embedded entries, immutable revision records,
per-writer logs, and an external mailbox or relay.
No implementation plan or storage design is selected here.

Linear already implements the proposed default-on policy:
`integrations.linear.policy.field_sync.comments` defaults to `two_way`, with `inbound`,
`outbound`, and `off` alternatives.
Native comments could reuse that policy as a projection into Linear for linked beads.
The important change would be making the native comment the durable local record, rather
than relying on Linear for older full text.

## Questions and Scope

The target workflow is an agent discovering work, taking ownership, delegating or
creating dependent tasks, discussing details on beads, and continuing when another agent
finishes. Claude, Codex, and other runtimes should participate through the same data and
command contracts.

1. Which guarantees apply within a checkout, across linked worktrees, and across
   independent clones?
2. What does watching deliver, what can it miss, and what causes an agent to run again?
3. How do native comments, Linear projections, authorship, and relationship records fit
   together without making every bead an external issue?
4. What can current Beads variants, Agent Mail, orchestrators, and runtime protocols
   teach us? What could be reused while keeping tbd’s durable task model?
5. Which defects need attention now, and which experiments should precede a plan?

This is a source review with executable probes, existing-suite validation, and
primary-source research.
External code was checked out for inspection, without installing or executing it.
No live Linear comments or issues were created, and no new live Claude/Codex
coordination session was run.
Findings distinguish observed behavior, inspected source, historical validation, and
proposals.

## Current Implementation

### Durable state and relationships

Beads use immutable internal issue IDs, with short display IDs supplied by mappings.
Issue files are schema-validated and atomically replaced.
Cooperating CLI writers perform read-modify-write operations under a shared data-sync
lock; linked worktrees use the same Git common directory and bead data.
Atomic replacement alone does not implement compare-and-swap or coordinate independent
clones. [Storage][t-storage] [Mutation context][t-context]

An issue’s `parent_id` is the authoritative containment reference on the child.
`child_order_hints` on the parent provides ordering hints, rather than another
authoritative edge. Dependencies are separate: a `blocks` edge lives on the blocker and
points to the blocked issue.
Parentage does not imply an execution dependency.
Scalar conflicts such as `delegate`, `status`, and `parent_id` use last-writer-wins
based on the issue’s `updated_at`; discarded scalar values are archived.
Concurrent array changes use union, while a one-sided removal can survive the three-way
merge shortcut. [Schemas][t-schema] [Merge rules][t-merge]

Git exchange eventually adopts a shared merged snapshot; the merge is not a commutative
CRDT, and graph validity is a separate concern.
A dependency removal concurrent with another addition can resurrect the removed edge.
Independent per-issue merges can introduce a parent cycle even when each local edit was
valid. Hierarchy diagnostics can detect cycles; the reviewed merge path does not
establish graph-wide transactional enforcement.

### Ownership and readiness

`tbd start` resolves an identity, checks the bead under the shared lock, records its
delegate, and preserves the first start time.
It skips closed beads and in-progress beads delegated to another name.
Output exposes `claimed` and `skipped`; a skipped foreign claim still exits zero.
Workers must inspect the result before beginning work.
[Claim implementation][t-start]

| Situation | Current behavior | Consequence |
| --- | --- | --- |
| Distinct named agents sharing the lock | A later claimant skips an in-progress foreign delegate | Useful cooperative ownership if identities differ and callers check `claimed` |
| Two harnesses in one checkout | `whoami --ensure-id` persists one checkout identity; Claude and Codex can resolve the same ID/name | “Already yours” can describe another live session; use explicit distinct `--as` or `TBD_AGENT` names today |
| Independent clones before exchanging state | Both can start the same bead; sync later selects one delegate | Eventual convergence does not prevent duplicate work |
| An open bead delegated to A | An explicit start by B can replace the delegate | Predelegation is not a reserved claim |
| A bead excluded by `ready` | An explicit start can still claim it | `start` is not an atomic “take one currently ready task” operation |

The last two are API distinctions, not automatically bugs in an explicit human-directed
command. An unattended scheduler would benefit from a separate claim-ready contract that
selects, revalidates, and claims under one authority.

Readiness requires an open bead without a delegate or hold and without an unfinished
blocker. The landing change additionally excludes a future `deferred_until`; elapsed
dates remove that exclusion while the other conditions still apply.
Assignee is a separate human ownership axis.
The predicate does not schedule a timer to release holds.
`agid` identity exists, but `delegate` stores the friendly name, not a canonical session
identifier. [Ready selection][t-selection] [Identity resolution][t-identity]

PR #264 passes one evaluation clock through queries and both sides of a change report.
Fresh readiness queries honor deferral dates, but time alone does not schedule a wake.
Remote watch skips an unchanged Git tip; even after an unrelated commit, both snapshots
use the same current time, so an unchanged deferral does not become a reported edge.
The board recomputes readiness for each fresh response, but its local observer and idle
page do not generate an expiry event.
An unattended worker needs periodic ready reconciliation or a timer in addition to
change-driven wakes.
Explicit `deferred` status does not automatically become `open` when its date elapses.
[Latest readiness](https://github.com/jlevy/tbd/blob/c43e2d41/packages/tbd/src/lib/issue-selection.ts#L37)
[One-clock reports](https://github.com/jlevy/tbd/blob/c43e2d41/packages/tbd/src/lib/issue-changes.ts#L451)
[Board refresh](https://github.com/jlevy/tbd/blob/c43e2d41/packages/tbd/src/cli/web/board.ts#L688)

Ready-filtered reports now depend on the evaluation clock as well as commit endpoints,
but the JSON report does not record that clock.
A pure-source probe of the same endpoints with a cleared deferral reported one ready
transition before the original expiry and zero afterward.
Reproducible delivery diagnostics should capture the evaluation instant; an
unchanged-snapshot query still emits no clock-only transition.

Adoption also lags implementation: the managed skill calls
`tbd update <id> --status in_progress` “Claim work,” and the implementation shortcut
does not consistently teach `tbd start`. Existing tbd-c4zl covers that instruction gap;
tbd-zhel covers prime-time ownership/freshness; tbd-qxdb covers stale claims.
Runtime/session linkage remains separate work under tbd-owa5/tbd-ppn1.

### Remote watch and changes

`tbd changes` compares committed sync-branch snapshots.
`tbd watch` polls the remote tip and returns when a selected net change appears.
Selectors include explicit beads, labels, specs, status, readiness, or all beads;
delegate, assignee, and comment-recipient selectors are absent.
Dynamic filters consider before and after state, so leaving a selected set remains
observable. `--ready` detects entry into readiness, including when another bead’s
completion unblocks the selected bead.
[Reports][t-changes] [Watch CLI][t-watch-cli]

The implementation has several valuable properties:

- Private per-watch Git refs avoid changing `FETCH_HEAD`, the normal sync branch, or the
  caller’s checkout. Idle polls use `ls-remote`, fetching when needed.
- Watchers do not retain the shared writer lock while waiting.
  Multiple watchers coexist with normal reads and sync.
- Git operations are bounded; retries distinguish startup failure from subsequent
  transient failures; interrupted-process refs can be reclaimed.
- Baselines must exist and be ancestors of the current tip.
  Rewritten history produces an explicit recovery error.
- Default polling is 30 seconds, minimum 10 seconds.
  Exit codes distinguish match (0), operational failure (1), usage error (2), and
  timeout/no match (3).

Focused tests and the real-Git release smoke confirm these strengths.
[Polling and ref isolation][t-watch][]

The report remains an endpoint diff.
A value changed and reverted between baseline and tip leaves no net report.
Without `--since`, a subscription starts at the first observed remote tip; older work is
not automatically delivered.
Uncommitted local state is invisible.
`--ready` is an edge trigger, not an initial queue drain.
Version/update-time changes alone are not substantive changes.
Snapshot readers enumerate only `issues/` and `mappings/ids.yml`, so a new comments
directory would not automatically be observable.
[Snapshot reader][t-snapshots]

### Local observation and worker delivery

The web viewer has a local observer with filesystem events, a 250 ms debounce, and
one-second reconciliation.
Snapshot publication guards against in-progress writes and tracks issue versions/mapping
changes. Its bounded SSE replay buffer is in memory.
This is a useful building block for local watch, not a durable per-agent inbox.
[Observer][t-local-observer] [Board snapshots][t-board]

The `watch-beads` worker recipe persists a pending report and advances its checkpoint
after successful handling and sync.
It gives one owner an at-least-once processing pattern, assuming idempotent handling,
and explicitly requires unique state names.
It still needs an initial ready scan for backlog predating subscription.
Every wake must be followed by fresh state and a successful claim.
A checkpoint means a report was handled, not that all downstream work completed.
[Worker recipe][t-worker]

tbd does not currently supply the complete runtime loop: start an agent, restore
context, enforce permissions, inject a message, obtain a claim, observe completion, and
recover after process death.
CLI watch can block a running caller or shell supervisor.
An idle or stopped coding task needs a host-specific continuation adapter.

## Linear Sync and Native Comment Projection

### Existing implementation

This repository enables Linear and targets team `OS` and project `tbd`. Its outbound
selector uses status gates and **epic kind OR active spec**, with `max_nesting: 2`. An
inherited active spec can select non-epic descendants; it is not an epic-only policy.
`on_tbd_sync` is `off` in this checkout: ordinary bead Git sync does not automatically
perform Linear exchange here.
The integration command or another configured invocation must do so.
Policy is repository-scoped under the provider; there is no independent policy map for
several Linear projects in one repository.
[Current config][t-config]

```yaml
integrations:
  linear:
    policy:
      field_sync:
        comments: two_way  # Default; also inbound, outbound, off.
```

Outbound selectors decide which beads acquire an external issue.
Linked pairs continue to reconcile; comment eligibility is not a fresh “is this an
epic?” check each time.
Explicitly linked items can be fetched outside the target project’s delta query.
A proposed strict destination-project boundary must therefore be specified separately.
[Policy][t-policy] [Pair planning][t-sync]

`tbd integration comment <bead> <text>` requires a provider link, records a comment
offline, and lets the next integration sync post it.
Local comments have a stable `local_id`; pushing retains it and adds the provider
comment ID. Repeated inbound pulls normally deduplicate by ID. Local and inbound
additions bump bead version/update time, making them visible through today’s issue
observer. [Authoring][t-comment-command] [Comment store][t-comments]

Current limits matter for agent use:

- Comments are embedded under `extensions.linear.comments`; unlinked beads have no
  native comment command.
  Default local attribution is `tbd`, not agent/session identity.
- The model is append-only.
  Already-seen IDs are skipped, so edits and deletions are not synchronized.
  Reply topology and recipients are not a native local message contract.
- Provider-held text is capped at 10,000 characters and 50 full entries; older entries
  become ID/time stubs.
  Pending local prose is preserved until pushed.
  This assumes the tracker retains full text.
  It bounds neither all retained IDs nor all pending comments, and merge itself does not
  enforce the 50-body cap.
- Comment exchange is coupled to pair execution.
  Archived, orphaned, or otherwise suppressed pairs may not exchange comments.
  tbd-bexc already tracks malformed managed markers freezing otherwise independent
  comment work.
- Intents are journaled before external writes.
  Replaying a particular Linear comment UUID is deduplicated.
  Independent replicas currently mint different UUIDs for the same pending local
  comment, allowing duplicate external posts.

These are source findings and local mock-provider results, not a new live Linear test.
The adapter contains historical live evidence for duplicate UUID handling.
[Adapter][t-linear-comments] [Intent planning][t-comment-intent]

### Candidate: native comment plus optional projection

Preserve `two_way` as the default, apply it only to Linear-linked beads, and let project
configuration disable or constrain direction.
Smaller unlinked tasks can have native Git-synced comments.
Commenting should not implicitly create a Linear issue or link a child merely because
its epic is linked.

An independent native comment would link to the immutable internal bead ID. Its Linear
projection would record destination scope, external issue/comment IDs, origin, and
delivery state. An inbound comment receives a native identity once; later pulls resolve
its provider alias to that record.
Outbound echo must enrich that record, not create a second native comment.

Append-only text with stable authorship and optional reply references is a small initial
semantic scope. Even then, several decisions remain:

| Decision | Candidate behavior to test |
| --- | --- |
| Scope | Reuse provider-level `comments: two_way`; introduce per-destination project overrides only if multi-project configuration is needed |
| Destination | Only the bead’s explicit link; no implicit child-to-epic forwarding |
| Delivery identity | Persist or derive a destination-scoped idempotency key from the logical comment, reused across clones |
| Loop suppression | Resolve native identity and namespaced provider aliases before import or delivery planning |
| Attribution | Preserve original author identity/display text separately from the transport credential |
| Backfill | Decide whether linking or enabling sync exports old comments; expose the selected history |
| Disable/re-enable | Preserve native content and aliases; explicitly decide whether queued delivery resumes |
| Relink | Keep old destination lineage; do not silently make historical comments pending for a new issue |
| Edits/deletions | Exclude them explicitly at first or introduce revisions/tombstones |
| Threads | Define flattening or reply mapping when the parent is absent or outside the mirrored subset |

If future messages are private or addressed, distinguish them from ordinary shared bead
discussion before default-on external projection.
Incoming Linear text remains untrusted task content; tbd-8asz already tracks making that
explicit to agents.

## Engineering Findings

“High” below means potential data loss or duplicate external effects, not an observed
production incident.
Contract boundaries should be documented separately from defects.

| Finding | Evidence and impact | Follow-up |
| --- | --- | --- |
| High: workspace/outbox merge discards independent comments | Production filesystem APIs merge `[base,A]` and `[base,B]` into `[base,B]`, report zero conflicts, and leave an empty attic. Direct outbox import deletes the source holding A. An older current snapshot is treated as an ancestor, bypassing union. | Repair recovery merge; add save/import regressions. Historical tbd-p1lz/tbd-hg05 addressed a different aspect. |
| High: one pending comment can be posted twice | Two independent engine stores with the same `local_id`, real Linear adapter, and local mock provider produce two external UUIDs and identical bodies. Sequential stale replicas suffice. | Make delivery identity stable across replicas, beyond the same-journal guarantee in closed tbd-5p9k. |
| Medium: aliases and divergent bodies lack convergent resolution | A provider-only entry and its local-ID/provider-ID twin remain separate. Same-ID different bodies retain the first input; swapping sides changes the result without an archived conflict. | Canonicalize aliases and define conflicting-content handling. |
| Medium: checkout identity aliases live sessions | Claude and Codex probes in one checkout return the same stored ID/name; claiming compares friendly names. | Separate agent, session/invocation, and display identity; connect to runtime research. |
| Medium: concurrent graph edits restore edges or introduce cycles | Pure merge probes show removal resurrection and a parent cycle; hierarchy diagnostics detect the cycle afterward. | Define removal and post-merge validation policy; do not copy arrays as a general relationship CRDT. |
| Workflow gap: instructions lag claiming and queue semantics | Skills still describe status updates as claims; worker recipe omits initial backlog drain. | Reuse tbd-c4zl and add startup-drain coverage. |
| Contract boundary: watch observes snapshots | Add/revert across two commits produces zero net change; dirty local state is also invisible remotely. | Compare a durable message cursor separately. |
| Contract boundary: locks do not span independent replicas | Two clones both claim; sync subsequently chooses one owner. | Choose an authority before advertising exclusive cross-clone assignment. |

The workspace finding exercises `saveToWorkspace` and `importFromWorkspace`. Automatic
sync retains the outbox until a later successful push, so deletion timing differs from
direct import, but the merge operation is shared.
Full sync CLI recovery was not exercised in that probe.
Parent-cycle evidence is a pure merge/diagnostic probe, not a full two-clone sync.
[Workspace merge][t-workspace] [Comment union][t-union]

## Landscape

Task tracking, mailbox delivery, workflow scheduling, and runtime control operate at
different layers. Integrating two tools does not automatically combine their guarantees.

### Beads variants and orchestrators

| System | Relevant support | Boundary and lesson |
| --- | --- | --- |
| Current Go Beads | Dolt issues, comments, atomic claim/claim-ready, heartbeat/reclaim, embedded/server modes | Claim authority is the shared database. Heartbeat leases are explicitly node-local and outside Dolt history. Offline replicas are a different problem. [Claims][beads-claim] [Leases][beads-lease] |
| beads_rust (`br`) | Classic local database/JSONL interchange, transactional foreign-owner checks, comments, optional stdio MCP, stale-claim diagnostics | Current source uses FrankenSQLite. No daemon or implicit Git exchange; diagnostics do not auto-reclaim. Its storage differs from current Go Beads. [Claims][br-claim] [Scope][br-scope] |
| beads_viewer (`bv`) | Graph triage, ranked next work, dependency-based parallel plans over exported data | Recommendations reserve neither work nor files. Parallel graph tracks can overlap in code. Direct tbd YAML support was not established; reuse needs an export/adapter. [Scope][bv-scope] [Limits][bv-plan] |
| Gas Town | Opinionated roles, convoys, workflow molecules, worktrees, supervision, mail, merge coordination | Mail persists before best-effort runtime notification; busy-session delivery differs from an idle nudge. Supplies substantial runtime machinery and operating cost. [Mail][gt-mail] [Runtimes][gt-runtime] |
| Gas City | Configurable SDK/controller extracted from Town; store abstraction, packs, reconciliation, mail, runtime backends | File-store mode avoids bd/Dolt. `mail --notify` requests execution; unread mail alone does not wake. Claim fencing depends on the selected backend contract. [Architecture][gc-readme] [Wake][gc-mail] [Claims][gc-claim] |
| GitHub Agentic Workflows | Comment/slash-command and other GitHub events dispatch coding engines into Actions runs | Workflow concurrency groups do not lock arbitrary local agents. A new run does not resume a local session. Useful hosted dispatch model. [Triggers](https://github.github.com/gh-aw/reference/command-triggers/) [Concurrency](https://github.github.com/gh-aw/reference/concurrency/) |

Historical descriptions of Beads as uniformly SQLite/JSONL, or Agent Mail as only the
Python implementation, are now insufficient.
Source presence is not an independent deployment or performance result; inspected
revisions are recorded below.

### Jeffrey Emanuel’s Agent Mail

Both source families are checked out in the ignored attic: `attic/mcp_agent_mail` and
`attic/mcp_agent_mail_rust`. Rust describes itself as the authoritative rewrite.
The latest published release found on 2026-09-06 was **v0.3.32**, published September 1.
Its tag already includes durable inbox events, mutation idempotency, and optional
identity-proof gating; these are not merely main-branch proposals.
[Upstream][am-readme]
[Release](https://github.com/Dicklesworthstone/mcp_agent_mail_rust/releases/tag/v0.3.32)
[Release inbox source][am-release-events]
[Release send signature](https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/46b06e31fd163052148893eac4581666017b5a2b/crates/mcp-agent-mail-tools/src/messaging.rs#L1807)
[Release identity proof](https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/46b06e31fd163052148893eac4581666017b5a2b/crates/mcp-agent-mail-tools/src/identity.rs#L2066)

Agents register identities, send addressed Markdown messages, share thread IDs,
acknowledge messages, and reserve paths.
Beads integration is a convention: keep task state in `br`, correlate mail through the
bead ID, and discuss progress in the mailbox.
An acknowledgment does not close a bead, and a thread ID does not establish a
transactional bridge.
[Beads workflow][am-beads]

The most relevant details are:

- **Observation, read, and ACK differ.** Rust `fetch_inbox` marks returned messages read
  by default; `mark_read=false` peeks.
  ACK is separate. The reviewed Python inbox has different, non-consuming behavior.
  Target an exact implementation contract.
  [Rust inbox][am-inbox] [Python inbox][am-python-inbox]
- **Durable events improve on timestamp polling.** `fetch_inbox_events` returns
  recipient-scoped events oldest first, with continuation and expired/ahead errors.
  Recipient insertion creates a delivery event in the same database transaction.
  Consumers save cursors after processing and tolerate replay after a crash.
  [Events][am-events] [Transactional event][am-event-schema]
- **Mutation deduplication is transactional.** Optional send/reply/ACK and reservation
  keys are coupled to mutations, with request fingerprints and bounded retention.
  Same key/different request conflicts.
  Protection depends on key use and lifetime; it is not exactly-once work execution.
  [Transaction][am-transaction]
- **Wake signals remain hints.** Debounced signal files and host hooks improve
  attention; they neither replace the durable inbox nor universally start stopped
  Claude/Codex tasks. [Signals][am-signals] [Hooks][am-hooks]
- **The live authority is the database.** Git archives are queued after the transaction,
  normally in memory, with fallback/recovery machinery.
  A crash after commit but before enqueue can leave an archive gap; idempotent replay
  skips those side effects.
  That crash consequence is a source-ordering inference, not a reproduced failure.
  Acknowledged send does not prove a Git archive commit exists.
  [Send order][am-send-order] [Queue][am-archive]
- **Reservations arbitrate cooperating callers.** Conflicts are rechecked within the
  database transaction.
  TTL and optional commit guards help, but cannot stop expired or uncooperative
  processes from writing files.
  They are not filesystem fencing or worktree isolation.
  [Reservations][am-reservations]
- **Identity verification is configurable.** Service authentication, contact policy,
  registration proof, and sender tokens differ.
  Fail-closed profiles exist but are optional.
  Omitted sender tokens are accepted as unverified; HTTP authentication is off unless
  configured. Cross-project grouping on one service is not offline mailbox federation.
  [Sender verification][am-identity] [Scope][am-scope]
  [Default security posture](https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/SECURITY.md#L108)

Transferable ideas include separate delivery/receipt/completion state, transactional
delivery identities, explicit cursor recovery, bead IDs as thread correlation, and cheap
wake hints backed by durable reads.
Reusing the whole service adds a database, recovery procedures, identity lifecycle, and
another authority to operate.
Its current license includes an “OpenAI/Anthropic Rider”; it should not be described as
plain MIT in an adoption decision.
No code was reused. [License][am-license]

### Runtime and protocol surfaces

| Surface | Relevant capability | What remains outside it |
| --- | --- | --- |
| Claude Code agent teams | Shared tasks, dependencies, file-lock claiming, mailboxes, completion hooks in the experimental team feature | Cross-vendor task authority and general session recovery; teammates have documented lifecycle/resume limits. [Official docs](https://code.claude.com/docs/en/agent-teams) |
| Codex `exec` and app-server | JSONL noninteractive execution; app-server thread/turn events and approval handling | Bead claims/inbox semantics. Current docs deprecate `codex mcp-server`; app-server is the stronger runtime integration candidate. [Exec](https://learn.chatgpt.com/docs/non-interactive-mode) [App-server](https://learn.chatgpt.com/docs/app-server) [Deprecation](https://learn.chatgpt.com/docs/mcp-server) |
| MCP | Common tool access, used by Agent Mail and trackers | Tool access alone does not define durable recipients, ownership, or host continuation |
| A2A | Tasks/messages/artifacts with streaming and asynchronous push | tbd-specific persistence, leases, and scheduling. Useful when remote agent services expose it. [Async operations](https://a2a-protocol.org/latest/topics/streaming-and-async/) |
| Agent Client Protocol (ACP) | Editor-to-agent sessions, notifications, permissions, tool forwarding | Shared cross-agent task store/mailbox. Distinguish from similarly named communication protocols. [Architecture](https://agentclientprotocol.com/get-started/architecture) |
| LangGraph persistence | Checkpointed execution and resumption; persistent stores for shared state | Bead ownership and side-effect deduplication. Replayed execution still needs idempotent effects. [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) [Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api) |
| Linear Agents | Delegation/mention events, agent sessions, activities, external runtime links | tbd issue/comment sync does not implement that execution lifecycle. It is an adapter option independent of comment storage. [Agent interaction](https://linear.app/developers/agent-interaction) |

## Candidate Designs

### Separate decisions

Choosing comment files does not choose a scheduler; choosing a runtime adapter does not
choose a distributed lock.

| Axis | Material alternatives |
| --- | --- |
| Durable records | Embedded entries; independent documents; immutable revisions/events; per-writer logs; external mailbox |
| Observation | Remote snapshot diff; local reconciliation; durable event query; relay hints backed by durable reads |
| Delivery state | Discoverable discussion; consumer checkpoints; recipient inbox with read/ACK state |
| Ownership | Shared-repository lock; atomic claim-ready authority; dispatcher; remote compare-and-swap protocol; lease service |
| Execution | Active agent polls; shell worker; hooks; persistent runtime adapter/supervisor; hosted dispatch |

### Comment storage comparison

| Candidate | Advantages | Costs and unresolved contracts |
| --- | --- | --- |
| Embedded native entries | Smallest reader change; one issue replacement; existing integration scaffolding | Identity/merge repairs, issue rewrite/version churn, large discussions, recovery and retention |
| Independent identity documents | Distinct additions touch distinct paths; direct lookup; separate lifecycle; readable Markdown | Entity plumbing across sync/recovery/observation, collision handling, indexes, no multi-file atomicity |
| Immutable revision/event documents | Explicit edit/delete history, causality, reconstruction | Reducer, concurrent edit policy, tombstones, missing predecessors, format evolution, compaction |
| Per-writer append logs | Batching, fewer files, writer sequence for local order | Unique writer identity, partial-tail recovery, rotation, cross-writer ordering, indexes |
| External mailbox | Existing addressed delivery, search, receipts, service latency | Another authority; offline outbox/reconciliation; retention, credentials, availability |

A hybrid could retain native comments while sending lossy relay notifications containing
their IDs. Consumers recover missed hints by querying durable state.
Its operating cost must be justified by measured latency or delivery requirements.

### Independent identity documents in detail

An illustrative record contains a comment ID, immutable internal `issue_id`, stable
author identity, creation time, optional `reply_to`, and Markdown body.
Names/schema remain undecided.
Link from comment to bead as the authoritative relation; derive listings instead of
appending every comment ID to a shared parent array.
This follows the useful part of current parent-child storage.

Immutable identity and immutable content are different decisions.
Append-only publication should refuse replacement of an existing ID unless content is an
identical replay. Atomic rename with replacement does not ensure this.
Editable content requires conditional revisions or immutable revision records;
conflicting prose cannot inherit first-input-wins.
Deletion requires a retained tombstone or another explicit observed-removal mechanism.

Validate immutable identity/content on import and merge too, including clean Git merges;
records can arrive without going through the local publication helper.
For embedded entries, older comment parsers strip unknown fields and rewrite the array,
so issue-level passthrough alone would not preserve newly added author/session/reply
fields.

Provider IDs should be namespaced aliases of native identity.
Mutable delivery metadata could live in separate link/projection records, following
existing separation of issue identity and integration bridge state.
This avoids changing prose to mark delivery, but adds a transaction boundary: an intent
must survive a crash between external posting and recording its returned alias.

ULID/time sorting is presentation order, not causal or delivery order.
An older clock’s comment can arrive in a later sync.
A maximum timestamp/ID cursor can skip it.
Compare observed object IDs or a Git frontier enumerating newly reachable records, with
explicit rewrite/retention behavior.
Replies/revisions need predecessor references when causality matters.

A new file type requires more than permissive issue parsing:

- Storage, validation, format gates, doctor, migration, and old-client behavior.
- Normal sync/conflict routing, workspace save/import, outbox, and unrelated-history
  rescue. Current recovery enumerates issues and mappings.
- Remote reports and local reconciliation, including comments changing without parent
  version changes.
- Index rebuilds, pagination, retention, and measured file-count/read costs.
- Alias migration, stable delivery intents, and backfill of text no longer present in
  local stubs. A stub alone cannot reconstruct that text.

### Relationships and ownership authority

Containment, blocking, replies, and loose references need different semantics.
A reply may temporarily reference an unavailable parent; a blocker affects execution; a
containment cycle is invalid.
One union rule cannot handle all three.
Compare tombstoned edge records or observed-remove sets against simpler references with
diagnostics. Avoid duplicate inverse edges without a query need and repair strategy.

For same-repository agents, distinct invocation identities and the existing lock may
suffice for a cooperative pilot.
Atomic claim-ready can close the selection/claim gap.
Independent clones need a dispatcher, shared service, or explicit remote
compare-and-swap protocol for exclusive ownership.
In that protocol, local writes and ordinary eventual merges cannot authorize work: the
remote ownership transition must succeed first, and ambiguous responses need
reconciliation. Offline availability and immediate exclusive ownership cannot both be
assumed during a partition.

Leases add heartbeat, expiry, rejoin, and stale-owner behavior.
Expiry does not stop an old process from editing.
Fencing helps only when the resource accepting writes checks the token.
Even correct bead ownership cannot prevent separate tasks editing the same files.
Worktrees, cooperative reservations, and merge/review ownership address that separate
problem.

## Experiments Before a Plan

Use controlled workflows and the same acceptance cases for competing candidates, so
format preference does not determine the result in advance.

| Experiment | Questions and observable acceptance criteria |
| --- | --- |
| Real Claude and Codex agents | Distinct session identities; claim, delegate, comment, close a blocker, resume dependent work. One owner proceeds after a contested local claim. Record actual host wake mechanism. |
| Worktrees versus independent clones | Contested claims, delayed sync, partition/rejoin, stale-owner restart. Report duplicate work, authority scope, and convergence separately. |
| Initial backlog and restart | Drain existing ready work; discover completion during downtime; safely replay after processing-before-checkpoint crashes; isolate worker checkpoints. |
| Storage comparison | Concurrent appends, identical retries, conflicting content, alias enrichment, long threads, late-clock arrivals. Assert surviving logical records in both candidates. |
| Recovery/compatibility | Save/import, outbox, history rescue, missing parent, old-client round trip, interrupted multi-document writes. Preserve acknowledged comments or expose recoverable conflicts. |
| Linear projection | Four direction modes; linked/unlinked/non-epic beads; shared pending comment across replicas; lost responses; relink; disable/re-enable; backfill. One logical delivery creates one provider comment within the declared contract. |
| Snapshot versus event query | Add/remove or revise between polls; identify which operations remain discoverable and for how long. |
| Wake adapters | Compare polling, local observer, Agent Mail events/hooks, and runtime adapters. Measure latency, resumed context, idle cost, failures, operator intervention. |
| Scheduling/file overlap | Compare readiness with graph priorities; include independent tasks touching identical files. Measure useful parallelism, duplicate work, and merge/review cost. |

Capture actor/session IDs, bead/message IDs, delivery keys, observed Git tips, claim
outcomes, and checkpoints.
Measure median/tail latency, missed/duplicate messages, recovery time, and Git/API
traffic. A two-agent demonstration proves basic operation, not load or crash resilience.

Before selecting a plan, decide which topology needs exclusive ownership; whether
comments are shared discussion or addressed requests; whether edits/deletes matter;
whether eventual discovery suffices; which host can restart agents under existing
permissions; and how much Linear history should be mirrored, and when.

## Validation and Evidence

The repository research shortcut/template was used.
Work was divided among source collection, Agent Mail analysis, and independent design
probes; the integrating review checked source paths, probe setups, and
tested-versus-inferred claims.

| Evidence | Result and limit |
| --- | --- |
| Build | `pnpm build` passed |
| Landing change | Rebuilt after PR #264; six focused readiness/watch/mirror/observer files passed all 97 tests. The expiry-wake limitation is source-derived, not a fresh live-agent experiment. |
| Focused suites | 7 files/80 tests: issue-changes, bead-watch, cli-changes, cli-watch, watch-beads-shortcut, integrations-comments, agent-identity |
| Ownership/local observer | 2 files/19 tests: actor-axis and web-local-observer; 99 focused tests total |
| Release smoke | `pnpm --filter get-tbd qa:watch-release:built` passed on disposable real Git repositories; sandbox IPC restriction required fixture permissions |
| CLI probes | Identity alias; foreign skipped claim/exit 0; open delegation replacement; explicit start bypasses ready; dirty state invisible remotely; dual-clone claims; add/revert yields zero diff |
| Merge probes | Alias duplication, first-input body choice, edge resurrection, parent cycle, two capped arrays merging to 100 full entries |
| Workspace probe | Production save/import loses independent pending A; zero conflicts/empty attic; direct outbox import clears source |
| Mock Linear probe | Real engine/adapter with two stores posts one logical comment twice; rerunning updated store posts zero |
| Full checks | Lint/typecheck passed. Initial suite: 2462 passed, one fixture-setup timeout; isolated file passed 18/18. Full rerun with `--maxWorkers=4`: all 164 files and 2463 tests passed. After the PR #264 rebase, the full pre-push suite passed all 165 files and 2480 tests with four workers. |
| Dependencies | Restored existing lockfile without upgrades/install scripts; 31 age checks passed. Audit: 34 development-tool findings, zero production findings; existing tbd-gx3a updated. |

Workspace reproduction: seed one valid issue with common pending comment `base`. Make
two version-2 snapshots, older `[base,A]` and newer `[base,B]`, with distinct local IDs
and ordered update times.
Save newer data into the older workspace; separately import older outbox into newer
data. Both retain `[base,B]` with no attic conflict.
All comments lack provider IDs, so retention caps do not explain the loss.

Delivery reproduction: copy one linked bead with a pending `local_id` into independent
engine stores with initially empty journal/data directories.
Sync A then stale B against the same local Linear mock.
Both report one push; the provider has identical bodies under different UUIDs.
This isolates delivery identity from Git timing.

Historical watch validation includes real Claude and Codex sessions, but its serialized
note handoff does not validate concurrent comments, leases, or crash recovery.
tbd-ii8p and tbd-t750 were closed as superseded; closure does not prove every old manual
checklist ran. The September 6 reconciliation corrects the actor-axis spec’s stale Draft
status to delivered core with residual UX; runtime/session references remain proposed.
Source and execution evidence take precedence over those document statuses.

### Reconciliation with earlier work

The follow-up review read the earlier coordination plans and research, checked their
beads and close notes, and compared disputed implementation claims with source.
It did not rerun dated vendor probes or fill unchecked manual tests by inference.
The result is the ownership map below, corrected status notices in the governing
documents, and archival of explicitly superseded research and the abandoned outbox
proposal.

## Relationship to Existing Plans and Research

This research adds current evidence and compares candidates.
It does not select, cancel, or complete the distinct plans below.
Their open commitments remain in their governing specs; supporting research links
supplement each bead’s `spec_path`.

| Scope and existing owner | Commitments retained | Relationship to this research |
| --- | --- | --- |
| [Batch transactions](../../specs/active/plan-2026-01-19-transactional-mode-and-agent-registration.md), `tbd-df33` | Private tentative multi-bead changes; begin, review, commit, abort; crash/orphan recovery; immediate mode by default | Unimplemented proposal requiring refresh. Atomic comment files and current identity do not supply batch isolation or all-or-nothing publication. |
| [Watch design](../../specs/active/plan-2026-07-19-bead-watch-and-external-sync.md) and its validation | Read-only committed-state observation, bounded reports, explicit cursor/rewrite behavior | Shipped contract and historical evidence. Superseded pilot/release checks are labeled; generic extension CLI remains `tbd-z95g` in the tracker plan. |
| [Tracker integrations](../../specs/active/plan-2026-08-10-external-tracker-integrations.md), `tbd-gvju` | Linked-bead identity and direction policy, GitHub adapter/PR associations, web projection, unified engine, generic extension CLI | Native comments may become a durable source for these bridges. New delivery/recovery findings qualify the older passing scenarios. |
| [Sync and traceability](../../specs/active/plan-2026-08-14-external-sync-and-traceability.md), `tbd-dzme` | Cheap quiet sync; honest freshness/errors; in-flight rollups and durable links; attention/inherited-spec selection; inbound gestures and origin/remap safety; bounded closing gates and host hooks | Watch/dispatch research does not replace these visibility and completion requirements. Keep the inline-sync override decision (`tbd-9cf9`, overlapping `tbd-zuos`) separate from comment policy. |
| [Actor and identity](../../specs/active/plan-2026-08-18-actor-axis-and-identity.md), delivered `tbd-ncux`, residual `tbd-p0fe` | Human assignee/agent delegate split, provider-ID bindings, metadata privacy; remaining binding UX, migration, actor diagnostics, and explicit acceptance evidence | `tbd-6nmq` sharpens the plan’s existing session-precision question. Completed core and unfinished UX have separate owners. |
| [Tracker state and Linear mapping](../../specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md), `tbd-og20` | Lifecycle projection, owned refinements, explicit provisioning, no prompts or unsolicited board changes during sync | Distinct sibling plan. Closed state epics do not prove every stale checkbox; shared-state carrier acceptance needs a focused audit. |
| [Session refs and runtimes](../../specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md), `tbd-owa5` | Durable refs, volatile status/freshness, bridge projection; offline local authoring; event-first plus bounded reconciliation; optional adapters | Visibility is separate from dispatch. `tbd-i0de` must resolve URL-less reference identity, nested schema compatibility, and merge rules before implementation. |
| [Workspace recovery](../../specs/done/plan-2026-01-30-workspace-sync-alt.md) and [automatic outbox workflow](../../specs/done/plan-2026-02-03-streamlined-outbox-workflow.md) | Durable backup, compatible merge, visible conflicts; explicit import clears after success, automatic sync retains the outbox until imported data is pushed or already synced | Selected successors to January’s abandoned write-through proposal. `tbd-hqb9` violates the intended preservation guarantee; it is not an intentional loss policy. |

### Earlier ideas carried forward

The [June monitor survey](../archive/research-2026-06-04-agent-issue-monitors.md)
separates trigger eligibility and authorization, context assembly, execution, and
reporting. Keep these contracts explicit: readable comments do not authorize execution,
and starting a hosted job does not resume a local session.
Repository Actions, hosted webhook listeners, and compiled repository workflows are
possible adapters; `repository_dispatch` is one optional bridge seam.
Reports can trigger other agents and return through another adapter, so suppression
needs origin, correlation/causation, and delivery identities across channels, beyond the
Linear bridge’s own echo checks.

The [sync/hooks audit](research-2026-08-14-agent-sync-protocol-and-hooks.md) retains the
portable lifecycle of orient, claim, checkpoint, land, and release.
Context injection, deterministic blocking checks, and mechanical execution are different
hook capabilities. Session-end hooks are best effort.
Completion gates must be bounded and block inaction rather than trap a session on
network failure. These hooks still need a host capable of waking a stopped runtime.

The [identity research](research-2026-08-14-agent-and-session-identity.md) retains
namespaced native aliases, lazy registration that is idempotent across lifecycle replay,
and allowlisted metadata.
Resume, compaction, and fork have different identity effects; bookkeeping identity is
not authentication. The
[runtime survey](research-2026-08-19-agent-runtimes-and-session-linkage.md) preserves a
one-bead/many-session relation, durable links separate from observed status, timestamps
and staleness, sticky terminal states, and reconciliation after missed events.
Missing runtime data must not mean completion.

The [Linear surfaces study](research-2026-08-09-linear-task-surfaces.md) retains dated
API probes and distinct human-attention, hierarchy, and recurring-task analysis.
Its conflict-visibility requirement is partly implemented for tracker field conflicts:
archive the losing value and post a resolvable provider comment.
Any native-comment or relationship conflict design must decide how to extend that
lifecycle; transport alone does not implement it, and cross-clone effects still need
stable delivery identity.
Specs also need repository/ref/path links because beads outlive individual branches;
define link updates after merge or branch deletion.
Human-facing epic rollups and attention selection remain separate from transporting a
high-volume agent protocol.

The archived [kernel sketch](../archive/research-agent-coordination-kernel.md)
contributes correlated task/session/run/artifact references, without selecting an event
bus or new core services.
The archived
[Beads bootstrap survey](../archive/research-beads-bootstrapping-mechanisms.md) retains
the separation of installation, initialization, context, and thin hook adapters; its old
bootstrap commands are not current installation guidance.
The identity, sync/hooks, runtime, and Linear studies remain current research references
with dated baseline notices because this brief does not replace their distinct evidence.

The
[January outbox proposal](../../specs/archive/plan-2026-01-29-claude-code-session-sync.md)
is archived as superseded by the selected workspace and streamlined outbox designs, not
as an implemented specification.
The watch plan and validation remain explicitly historical records at their existing
paths; their superseded checks are not silently marked as passed.
Moving a spec alone does not unlink an already-linked Linear bead.

## Follow-Up and Related Work

Repair verified preservation/delivery defects, then compare comment candidates and
runtime workflows. This research makes no implementation selection.

Reuse existing tbd-c4zl (claim instructions), tbd-zhel (prime freshness), tbd-qxdb
(stale claims), tbd-owa5/tbd-ppn1 (runtime/session refs), tbd-bexc (marker failure
isolation), tbd-iqgm (comment fetch cost), tbd-8asz (untrusted inbound prose), and
tbd-64aq (mapping identity).

| New bead | Follow-up |
| --- | --- |
| tbd-hqb9 (P1) | Pending-comment preservation in workspace/outbox recovery |
| tbd-6vg5 (P1) | Stable Linear delivery identity across replicas |
| tbd-58nm (P2) | Canonical aliases and same-ID content conflicts |
| tbd-6nmq (P2) | Simultaneous agents sharing checkout identity |
| tbd-7ybg (P2) | Concurrent relationship removal and graph validation |
| tbd-zxg6 (P2) | Initial backlog drain and successful-claim checks |
| tbd-q2w2 (P2) | Cross-agent and comment-candidate experiments before planning |
| tbd-p0fe (P2) | Previously planned actor binding UX, migration, diagnostics, and remaining acceptance evidence |

The load-sensitive fixture timeout is recorded under existing tbd-2pqp.

Related internal documents:

- [Coordination kernel exploration](../archive/research-agent-coordination-kernel.md):
  speculative separation of durable task truth, presence, leases, mail, and runners.
- [Agent issue monitors](../archive/research-2026-06-04-agent-issue-monitors.md):
  earlier landscape.
- [Identity](research-2026-08-14-agent-and-session-identity.md) and
  [sync/hooks](research-2026-08-14-agent-sync-protocol-and-hooks.md): traceability
  context.
- [Runtime/session linkage](research-2026-08-19-agent-runtimes-and-session-linkage.md):
  adjacent unfinished design.
- [Watch Phase 1 validation](../../specs/active/valid-2026-07-19-bead-watch-phase-1.md)
  and [release validation](../../specs/active/valid-2026-08-09-bead-watch-release.md):
  historical tests and their limits.

## Source Snapshots

Attic checkouts are ignored; pinned upstream references remain usable without them.
Inspected 2026-09-06. Only tbd code was executed in this research.

| Source | Local checkout | Commit |
| --- | --- | --- |
| Go Beads | `attic/beads` | `c0d8da42de5fd15c95adac85e342ba4a121da0fb` |
| beads_rust | `attic/beads_rust` | `dac8ea99bf30f0907ebb1104278233997868a799` |
| beads_viewer | `attic/beads_viewer` | `1e8acace68f6af97c27250a38b15c0358bd7a813` |
| Agent Mail Python | `attic/mcp_agent_mail` | `ac4966c64d7e39692a4fb9c707448a1718ab29db` |
| Agent Mail Rust main | `attic/mcp_agent_mail_rust` | `7b805c4942c2d3a81873313593cd891336a0632d` |
| Agent Mail Rust v0.3.32 | same checkout, tag inspected | `46b06e31fd163052148893eac4581666017b5a2b` |
| Gas Town | `attic/gastown` | `649b832b7672bc7a2dbef26f5983aba6198b819b` |
| Gas City | `attic/gascity` | `2cc11e43ebabad90ee2213d7097a96b94cb462a3` |

[t-storage]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/file/storage.ts#L67
[t-context]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/cli/lib/data-context.ts#L278
[t-schema]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/lib/schemas.ts#L153
[t-merge]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/file/git.ts#L449
[t-start]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/cli/commands/start.ts
[t-selection]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/lib/issue-selection.ts
[t-identity]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/lib/agent-identity.ts
[t-changes]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/lib/issue-changes.ts
[t-watch-cli]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/cli/commands/watch.ts
[t-watch]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/file/bead-watch.ts
[t-snapshots]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/file/sync-branch-changes.ts#L208
[t-local-observer]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/cli/web/local-observer.ts
[t-board]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/cli/web/board.ts#L960
[t-worker]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/docs/shortcuts/standard/watch-beads.md
[t-config]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/.tbd/config.yml#L164
[t-policy]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/lib/schemas.ts#L699
[t-sync]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/integrations/core/sync-engine.ts
[t-comment-command]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/cli/commands/integration.ts#L590
[t-comments]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/integrations/core/comment-store.ts
[t-linear-comments]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/integrations/linear/adapter.ts#L652
[t-comment-intent]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/integrations/core/sync-engine.ts#L1241
[t-workspace]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/file/workspace.ts#L345
[t-union]: https://github.com/jlevy/tbd/blob/c218e90b45c18114a26935dded8fa2cb3b044ede/packages/tbd/src/lib/comment-union.ts
[beads-claim]: https://github.com/gastownhall/beads/blob/c0d8da42de5fd15c95adac85e342ba4a121da0fb/internal/storage/dolt/issue_claimer.go#L27
[beads-lease]: https://github.com/gastownhall/beads/blob/c0d8da42de5fd15c95adac85e342ba4a121da0fb/cmd/bd/heartbeat.go#L16
[br-claim]: https://github.com/Dicklesworthstone/beads_rust/blob/dac8ea99bf30f0907ebb1104278233997868a799/src/storage/sqlite.rs#L7311
[br-scope]: https://github.com/Dicklesworthstone/beads_rust/blob/dac8ea99bf30f0907ebb1104278233997868a799/README.md#L1188
[bv-scope]: https://github.com/Dicklesworthstone/beads_viewer/blob/1e8acace68f6af97c27250a38b15c0358bd7a813/README.md#L193
[bv-plan]: https://github.com/Dicklesworthstone/beads_viewer/blob/1e8acace68f6af97c27250a38b15c0358bd7a813/README.md#L1313
[gt-mail]: https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/internal/mail/router.go#L1194
[gt-runtime]: https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/README.md#L456
[gc-readme]: https://github.com/gastownhall/gascity/blob/2cc11e43ebabad90ee2213d7097a96b94cb462a3/README.md#L15
[gc-mail]: https://github.com/gastownhall/gascity/blob/2cc11e43ebabad90ee2213d7097a96b94cb462a3/docs/reference/cli.md#L2538
[gc-claim]: https://github.com/gastownhall/gascity/blob/2cc11e43ebabad90ee2213d7097a96b94cb462a3/internal/beads/beads.go#L176
[am-release-events]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/46b06e31fd163052148893eac4581666017b5a2b/crates/mcp-agent-mail-tools/src/messaging.rs#L4064
[am-python-inbox]: https://github.com/Dicklesworthstone/mcp_agent_mail/blob/ac4966c64d7e39692a4fb9c707448a1718ab29db/src/mcp_agent_mail/app.py#L9592
[am-readme]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/README.md#L1739
[am-beads]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/README.md#L948
[am-inbox]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-tools/src/messaging.rs#L3735
[am-events]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-tools/src/messaging.rs#L4104
[am-event-schema]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-db/src/schema.rs#L574
[am-transaction]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-db/src/queries.rs#L8336
[am-signals]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-storage/src/lib.rs#L9880
[am-hooks]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-core/src/setup.rs#L1114
[am-send-order]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-tools/src/messaging.rs#L2574
[am-archive]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-storage/src/lib.rs#L1102
[am-reservations]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-db/src/queries.rs#L13155
[am-identity]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/crates/mcp-agent-mail-tools/src/messaging.rs#L1647
[am-scope]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/README.md#L1728
[am-license]: https://github.com/Dicklesworthstone/mcp_agent_mail_rust/blob/7b805c4942c2d3a81873313593cd891336a0632d/LICENSE

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
