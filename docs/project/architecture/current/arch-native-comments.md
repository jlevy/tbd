---
title: Native Comment Record Architecture
description: Candidate immutable comment identity, storage, publication, compatibility, and provider boundaries for Git-native agent coordination
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Native Comment Record Architecture

Last updated: 2026-09-09

**Status:** Candidate internal foundation.
PR #282 implements record validation, serialization, bounded reads, deterministic paths,
and create-only local publication under `tbd-e1tu`. The implementation is not reachable
from the CLI or public package entry points, and current and freshly initialized
repositories remain on format `f08`. Format `f09`, `tbd comment enable`, native-comment
commands, and Git preservation remain proposed Phase 2 work.
Provider projection remains proposed Phase 4 work.

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

The candidate native-comment model would give every bead a durable conversation without
requiring a provider issue, pull request, or hosted mailbox.
Under this model, each comment is an immutable Markdown document.
Independent comments use separate paths and can therefore merge without rewriting the
parent bead or each other.

This document specifies the implemented internal record and storage foundation and the
proposed contracts around it.
The preservation layers under `tbd-76ad` must pass first.
Then `tbd-z3ag` must record the required Phase 2 subset of the broader `tbd-q2w2`
experiment and close the format-freeze gate before `tbd-x6eo` can add a CLI writer or
activate a new repository format.
Phase 2 also remains gated on the open Phase 1 stabilization work.

**Scope:** Native comment records, authorship snapshots, replies, local publication,
repair artifacts, read bounds, format activation, and the boundary with provider
bridges. Continuous Git polling, Linear projection, comment edits and deletions, and
runtime dispatch belong to later phases.

**Related Documents:**

- [Incremental Bead Coordination and Native Comments](../../specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md)
- [Bead Watching and Cross-Agent Coordination](../../research/current/research-2026-09-06-bead-agent-coordination.md)
- [Actor Axis and Identity Mapping](../../specs/active/plan-2026-08-18-actor-axis-and-identity.md)
- [tbd design](../../../../packages/tbd/docs/tbd-design.md)

## Core Invariants

These are invariants for the complete candidate design.
PR #282 enforces the record, identity, serialization, and local publication subset.

| Invariant | Consequence |
| --- | --- |
| A comment ID names one record forever | Publication creates a path and never replaces it |
| The comment points to the bead | Appending does not rewrite an inverse array on the issue |
| Native prose is complete | Provider retention caps and stubs never truncate the native record |
| Retries reuse the comment ID | Identical content succeeds idempotently; divergent content is preserved for repair |
| Records are immutable | There is no version, update timestamp, edit, delete, or reparent operation |
| Provider state is separate | External aliases, destination lineage, credentials, and delivery intents do not rewrite prose |
| Notifications are hints | Durable consumers query records and checkpoint identities rather than trusting a wake event |

The filesystem contract provides atomic visibility of a complete local record.
It does not claim a transaction with the parent bead, remote Git delivery, or survival
from an arbitrary storage-device power loss.

## Record Schema

```yaml
---
type: cm
id: cm-01m220hjjpx5nv44za5c8jbp6a
issue_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
author:
  kind: agent
  display_name: codex@worker-3
  agent_id: agid-01m220j40yd8fcw9n3yf4412dv
  provenance:
    harness: codex
    model: gpt-6
created_at: 2026-09-08T20:00:00.000Z
reply_to: cm-01m220htdx8tv5k1mpjavfpsca
---
The parser work is complete. I am starting the recovery tests next.
```

| Field | Contract |
| --- | --- |
| `type` | Literal `cm` discriminator |
| `id` | `cm-` plus a 26-character lowercase canonical Crockford Base32 ULID |
| `issue_id` | Immutable internal `is-...` identity, never a display ID |
| `author.kind` | `agent`, `human`, `service`, or `unknown` |
| `author.display_name` | Required immutable display snapshot, at most 200 characters |
| `author.agent_id` | Optional `agid-...`, valid only for an agent; its durable grammar remains a pre-freeze decision in `tbd-z3ag` |
| `author.provenance` | Optional allowlisted `harness` and `model` display metadata |
| `created_at` | UTC display and audit timestamp; never a delivery cursor |
| `reply_to` | Optional comment ID; the referenced record may arrive later or remain missing |
| Markdown body | Nonempty native prose, at most 65,536 UTF-8 bytes |

The schema is strict.
Free-form author fields and the body must contain well-formed Unicode so UTF-8 encoding
cannot silently replace unpaired surrogates.
The body exists only after the closing frontmatter delimiter; a `body` key in YAML is
invalid. Unknown author, provider, delivery, and session fields fail validation instead
of becoming accidental durable contracts.
Human identities remain provider scoped, as defined by the actor-axis design; their
provider IDs belong in bridge aliases.
An agent may carry its existing tbd-minted identity across harnesses and clones.
The implemented candidate accepts a lowercase 26-character alphanumeric suffix here; it
does not settle the broader agent-ID compatibility decision described under
[Pre-Freeze Review Debt](#pre-freeze-review-debt).

A reply does not update its parent.
The implemented record validator rejects a self-reply but permits an unavailable parent
because it does not query other records.
Future reads and diagnostics under `tbd-44kw` and `tbd-x6eo` must surface a missing
parent explicitly.
They must also retain and report a reply whose known parent belongs to
another bead rather than reparenting it.
If a missing parent later arrives, the reference can resolve without rewriting either
file.

## Creation and Retry Identity

The storage primitive accepts a complete record.
Its idempotency rule is exact canonical-record equality: the same ID with different
authorship, time, target, reply, or prose is a conflict.

The proposed native CLI has a narrower request-level retry contract.
It would derive `created_at` from the millisecond timestamp encoded in the supplied or
newly generated comment ULID. When `--id` already exists, it would compare the requested
bead, reply, and canonical body, then return the stored record for an equal logical
request. It must not reconstruct volatile ambient author metadata and compare it with a
snapshot that was already committed.
A differing bead, reply, or body would remain an identity conflict.
Future provider importers must journal or recover the complete candidate bytes before
external side effects and replay those bytes on retry.

## Storage Layout

```text
.tbd/data-sync/
├── comments/
│   ├── 00/
│   ├── ...
│   └── ff/
│       └── cm-<ulid>.md
└── attic/
    └── comment-conflicts/
        └── cm-<ulid>/
            └── <sha256-of-candidate-bytes>.md
```

The shard is the first byte of `sha256(comment_id)`, rendered as two lowercase hex
digits. SHA-256 is a deterministic distribution function here, not a security or
integrity claim. Hash fanout spreads time-adjacent ULIDs across 256 directories and
avoids a chronological hot directory.
The full comment ID remains the logical and file identity.

Code validates an ID before using it in a path.
Reads reject invalid UTF-8, symlinked path components, and non-regular record paths.
Successful records are capped at 73,728 input bytes; concurrent-growth detection may
read one sentinel byte beyond that cap before rejecting the record.
The extra 8 KiB above the body limit bounds frontmatter and YAML overhead.
Writers preflight the same whole-record bound before creating a directory or temporary
file.

## Publication

`publishNativeComment()` applies one create-only algorithm:

1. Normalize body line endings to LF and remove terminal blank lines.
2. Validate the complete record and serialize it canonically.
3. Write and close a temporary file on the same filesystem as the final shard.
4. Create the final name with `link(temp, final)`.
5. Remove the temporary name.

The hard-link operation either creates the final path or returns `EEXIST`; it has no
replace mode. Filesystems that cannot provide this primitive return an explicit error.
The implementation does not fall back to a partially visible direct write.

An `EEXIST` occupant is read through the same bounded, non-symlink path:

- Byte-identical canonical content returns `existing` with exit-success semantics for a
  later CLI. A parseable but noncanonical occupant is a conflict rather than an implicit
  rewrite.
- Different or invalid content remains untouched.
  The complete candidate is create-only published to its content-addressed attic path
  before `NativeCommentIdConflictError` is raised.

The content digest makes repeated repair preservation idempotent.
The code still compares bytes at an occupied digest path and errors if they differ.

A controlled failure before the hard link cannot expose the final path.
A failure after the hard link leaves a complete record that an identical retry observes
as existing. An actual process kill can strand a temporary name.
Before any public writer is enabled, the preservation layer must recognize and clean or
quarantine these names before every broad Git stage.
A `.gitignore` rule alone is insufficient because scaffold repair sometimes force-adds
the managed data directory.

## Git and Provider Boundaries

The candidate layout gives distinct comments distinct files, so a later Git integration
can join independent additions without a custom merge driver.
PR #282 does not integrate the comments tree with Git: it does not stage, Git-merge,
recover, commit, or publish the tree to a remote.
A same-ID add/add conflict, modification, reparent, or deletion violates immutability.
The preservation layer must keep one canonical record, retain every complete alternative
in the attic, and report the condition.
This rule applies to clean merges, explicit conflicts, fast forwards, workspace and
outbox import, and unrelated-history rescue.

The parent issue has no comment ID array.
This removes the shared append hotspot and lets a comment arrive without an issue-file
change. Queries and a later local discovery index derive the inverse relation from
`issue_id`.

Provider records are projections:

```text
native comment ── bridge alias ── destination lineage and delivery intent ── provider
```

The proposed bridge could learn a Linear or GitHub comment ID, retry a destination
write, or refresh an author alias without changing the native comment.
Existing provider comments embedded in `extensions.<provider>.comments` remain supported
until the Phase 4 migration and cutover are explicitly enabled.

## Security and Trust Boundaries

Comment prose and provider-authored metadata are untrusted input.
Future readers and watchers must not treat a comment body as an instruction to an agent
or execute Markdown, YAML tags, shell text, or provider payloads.
The implemented parser uses the repository’s existing YAML-only frontmatter boundary.

The local filesystem is also an input boundary.
IDs are validated before path construction; managed directories and final files reject
symlinks; readers use fatal UTF-8 decoding and size limits; publication never replaces
an occupied identity.
The current path checks prevent static redirection inside the selected data-sync root.
They do not claim protection against a hostile local process that can continuously swap
ancestor directories during one operation.

Git authentication authorizes transport, not the truth of an author snapshot.
Provider aliases prove only that a bridge observed an external identity.
Neither is a cryptographic signature over native comment content.

## Alternatives Considered

| Design | Decision |
| --- | --- |
| Append comments to the parent issue | Rejected because concurrent appends rewrite one shared file |
| One JSONL conversation log | Rejected because append order and conflict repair become shared mutable state |
| One immutable file per comment | Candidate selected because independent IDs normally Git-merge by union |
| Chronological directory fanout | Rejected because adjacent ULIDs concentrate write and listing work |
| Hash-based directory fanout | Candidate selected for stable distribution without a registry |
| Put provider IDs in the native record | Rejected because alias and delivery state can change independently |
| Allow comment edits or deletion | Deferred until an explicit immutable revision or tombstone design exists |

SQLite, hosted queues, Agent Mail, GitHub issues, and Linear remain useful indexes or
transports. They are not the source of truth for the provider-independent conversation
because cloud agents cannot assume a shared daemon, database, or provider issue for
every bead.

## Compatibility and Activation

### Current f08 Boundary

At the PR #282 boundary, `CURRENT_FORMAT` is `f08`, and fresh setup writes `f08`. The
binary has no readable or writable `f09` mode, native-comment configuration, format
migration, `tbd comment enable` command, or `tbd comment add/list/show` commands.
The record and storage modules have no public package export or runtime caller.
Standard setup, sync, workspace, recovery, and provider operations do not recognize,
validate, or guarantee preservation of a native comments tree.

A current f08 binary rejects a repository configuration newer than f08 after it observes
that configuration. This refusal does not protect native records from a stale clone that
has not incorporated a future activation commit, and the current binary has none of the
planned comments-tree preservation behavior.

### Candidate f09 Sequence

The plan names `f09` as the candidate native-comment format, subject to the `tbd-z3ag`
format-freeze gate. No f09 constant or behavior is implemented by PR #282. The proposed
`tbd comment enable` spelling belongs to `tbd-x6eo` and remains subject to that bead’s
review.

The proposed activation sequence is:

1. Complete `tbd-4r3w`, `tbd-qo4d`, `tbd-7ufa`, and `tbd-44kw`, then ship an
   f08-compatible preservation release that keeps future comments and evidence intact
   through every copy, merge, repair, and stage path.
2. Establish that preservation release as the minimum binary for every participating
   writer and close the `tbd-z3ag` format-evidence gate.
3. Add the reviewed activation command in `tbd-x6eo`; have it produce an explicit
   `.tbd/config.yml` change to the selected format.
4. Review, commit, and distribute the activation change before creating native records.
5. Permit the future comment writer only after it rechecks the active format while
   holding the shared writer lock.

Git cannot retroactively fence a client on a stale branch.
The writer inventory and stale-clone proof in `tbd-x6eo` must bound this limitation
rather than claim a distributed lock that Git does not provide.

## Implementation Layers

| Layer | Bead | State at PR #282 | Contract | Public behavior at this boundary |
| --- | --- | --- | --- | --- |
| Record and storage foundation | `tbd-e1tu` | Implemented; internal and dormant | ID, schema, parser, bounded create-only storage, and this architecture | None; no CLI writer, public export, or format activation |
| Inventory and transitions | `tbd-4r3w` | Absent from #282; implemented only in stacked PR #283 | Bounded filesystem/Git inventory, immutable transition classification, and content-addressed quarantine | None |
| Git operation guards | `tbd-qo4d` | Open | Validate every broad stage, commit, merge, fast-forward, and push parent edge | None |
| Workspace and history recovery | `tbd-7ufa` | Open | Preserve comments through workspace/outbox, unrelated histories, migrations, repairs, and source clearing | None |
| Diagnostics and compatibility | `tbd-44kw` | Open | Doctor and attic surfaces, scaffold and sync metadata validation, and packed old-client refusal | None |
| Format evidence and freeze | `tbd-z3ag` | Open; follows preservation evidence | Compare candidates, exercise failure contracts, settle durable grammar, and record the selected format | None |
| Activation and commands | `tbd-x6eo` | Open; blocked by the earlier gates | Explicit format enablement, add/list/show/changes, writer inventory, and two-clone proof | None |

All four children of preservation epic `tbd-76ad` must land before the activation layer
can expose a write. The tracker records `tbd-4r3w` complete in stacked PR #283, but that
implementation is not present in #282. The Phase 1 epic `tbd-3eui`, the Phase 2 epic
`tbd-raxf`, and the later preservation, format, and activation gates remain open.

## Pre-Freeze Review Debt

`tbd-z3ag` owns two pre-freeze follow-ups from the independent PR #282 review.
They are mandatory before the candidate format can be frozen and before `tbd-x6eo` can
expose a writer:

- **S282-01, create-only storage failures:** deterministically exercise the remaining
  `open`, write/close, `link`, cleanup close/unlink, and aggregate-error branches.
  The evidence must cover cleanup failure after a successful final link and simultaneous
  primary and cleanup failures, with assertions for final-path visibility, temporary or
  candidate retention, complete error context, cleanup, and exact retry outcomes.
- **S282-02, durable agent-ID grammar:** choose whether stored agent IDs are lowercase
  and whether their suffix must be a canonical Crockford ULID. Use one shared grammar
  across generation, parsing, `isAgentId()`, and `NativeCommentSchema`, with explicit
  compatibility treatment for released f08 data.
  Today `isAgentId()` accepts uppercase input by lowercasing it, while the candidate
  native-comment schema accepts only lowercase input.

These are pre-activation evidence and format decisions.
The dormant foundation exposes no reachable CLI or public write path that depends on
them.

## Query and Cursor Semantics

The proposed presentation order is `(created_at, id)`. Timestamps and greatest-seen
ULIDs must not become durable delivery cursors: an imported or delayed record can arrive
later with an earlier time or identity.

The Phase 2 CLI must bind each opaque list cursor to one bead and one fixed result
snapshot. If that snapshot changes between pages, the command must report a cursor reset
rather than silently skipping an insertion.
Proposed one-shot change reports compare comment-ID sets between two fixed Git commits,
which discovers late records independently of their timestamp.
Phase 3 may replace snapshot resets with the planned receiver-local generation and
sequence index.

Page limits must apply at record boundaries.
The future CLI must return complete bodies or an explicit limit error; it must never
truncate durable prose.
Initial record, byte, and cursor defaults remain candidates until the Phase 2 scale
benchmark records their read cost and Git growth.

## Code Map

| Responsibility | File |
| --- | --- |
| ID type, construction, and validation | `packages/tbd/src/lib/ids.ts` |
| Candidate record, author schema, and internal types | `packages/tbd/src/lib/native-comment.ts` |
| Generic frontmatter envelope | `packages/tbd/src/file/parser.ts` |
| Comment canonicalization and serialization | `packages/tbd/src/file/comment-parser.ts` |
| Sharding, bounded reads, publication, and local conflict preservation | `packages/tbd/src/file/comment-storage.ts` |
| Sync-tree path constants | `packages/tbd/src/lib/paths.ts` |

## Validation

The foundation tests pin:

- ID generation, grammar, path validation, and deterministic fanout
- strict author fields, reply invariants, well-formed Unicode, and UTF-8 body limits
- Markdown round trips, including an ordinary `## Notes` heading
- identical retries, concurrent writers, invalid occupants, and attic preservation
- non-regular paths, fatal UTF-8, and bounded whole-record reads and writes
- phase-hook failures before and after the atomic link, including retryability after the
  final path becomes visible

`tbd-z3ag` owns the remaining syscall-error tests listed under
[Pre-Freeze Review Debt](#pre-freeze-review-debt).
Later layers add two-clone Git exchange, merge/delete/reparent quarantine, workspace and
outbox failures, unrelated-history rescue, old-client refusal, fixed-endpoint discovery,
and measured scale evidence.

## Future Considerations

### Open Questions

- What record-count and Git-growth measurements from `tbd-q2w2` should set the initial
  list, page-byte, and repository inventory limits?
- Should the initial CLI author snapshot include ambient harness and model provenance,
  or reserve it for importers that can journal exact retry bytes?
- Which Windows filesystem and junction cases can provide the same path-containment
  confidence as `O_NOFOLLOW` on Unix?
- What signed-author or repository-signing contract would be useful without confusing
  Git transport authorization with comment authorship?

### Potential Improvements

- Use directory handles and relative open operations if Node exposes a portable
  `openat`-style API, reducing path-swap races further.
- Replace repeated snapshot scans with the receiver-local generation and sequence index
  after the immutable source-of-truth behavior is proven.
- Add immutable revision and tombstone records if real workflows demonstrate a need for
  edits or deletion.
- Add optional signatures over canonical bytes for deployments that need verified
  authorship beyond Git commit identity.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
