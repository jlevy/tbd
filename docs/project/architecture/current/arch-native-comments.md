---
title: Native Comment Record Architecture
description: Immutable comment identity, storage, publication, compatibility, and provider boundaries for Git-native agent coordination
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Native Comment Record Architecture

Last updated: 2026-09-08

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

Native comments give every bead a durable conversation without requiring a provider
issue, pull request, or hosted mailbox.
Each comment is its own immutable Markdown document on the sync branch.
Concurrent comments therefore create different files and normally merge without touching
the parent bead or each other.

This document defines the candidate record, identity, path, and publication contracts.
They become normative only after the `tbd-q2w2` comparison and Phase 2 acceptance gate
pass. The model remains internal and unreachable from the CLI while that work is open.
This document also defines the compatibility sequence that must finish before a CLI
writer is enabled. The complete Phase 2 release remains gated on the stabilization work
in Phase 1.

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
| `author.agent_id` | Optional portable `agid-...`; valid only for an agent |
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

A reply does not update its parent.
Readers surface a missing parent explicitly.
If the parent later arrives, the reference resolves without rewriting either file.
A self-reply is invalid.
A reply whose known parent belongs to another bead is retained and reported for repair
rather than reparented.

## Creation and Retry Identity

The storage primitive accepts a complete record.
Its idempotency rule is exact canonical-record equality: the same ID with different
authorship, time, target, reply, or prose is a conflict.

The later native CLI has a narrower request-level retry contract.
It derives `created_at` from the millisecond timestamp encoded in the supplied or newly
generated comment ULID. When `--id` already exists, it compares the requested bead,
reply, and canonical body, then returns the stored record for an equal logical request.
It does not reconstruct volatile ambient author metadata and compare it with a snapshot
that was already committed.
A differing bead, reply, or body remains an identity conflict.
Provider importers must journal or recover the complete candidate bytes before external
side effects and replay those bytes on retry.

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
Reads reject invalid UTF-8, symlinked path components, and non-regular record paths, and
read at most 73,728 input bytes for one serialized record.
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

Distinct comments create distinct files, so ordinary Git exchange joins independent
additions without a custom merge driver.
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

The bridge can learn a Linear or GitHub comment ID, retry a destination write, or
refresh an author alias without changing the native comment.
Existing provider comments embedded in `extensions.<provider>.comments` remain supported
until the Phase 4 migration and cutover are explicitly enabled.

## Security and Trust Boundaries

Comment prose and provider-authored metadata are untrusted input.
Reading or watching a comment never makes its body an instruction to an agent and never
executes Markdown, YAML tags, shell text, or provider payloads.
The YAML parser is restricted to the repository’s existing YAML-only frontmatter
boundary.

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

Native comments allocate repository format `f09`, but ordinary repositories and
automatic migrations remain on `f08` until an operator explicitly enables comments.
The implementation separates three concepts:

| Constant | Meaning |
| --- | --- |
| Default/automatic format | `f08`; routine commands do not opt a repository in |
| Maximum readable format | `f09`; the new binary can preserve and validate comments |
| Native comment format | `f09`; writes require this exact repository activation |

Activation is a reviewed repository change, not a side effect of `comment add`:

1. Ship an f08-compatible release that validates sync metadata and preserves the
   comments tree through every copy, merge, repair, and stage path.
2. Run `tbd comment enable` with a compatible binary.
3. Review, commit, and distribute the `.tbd/config.yml` change to `f09`.
4. Let setup reconcile the local common-directory layout to `f09`.
5. Permit `comment add` only after it rechecks the active f09 config while holding the
   shared writer lock.

Released f08 clients refuse a working tree that contains the f09 config before they
mutate it.
Git cannot retroactively fence a client running on a stale branch that has not
incorporated the activation commit.
Teams must distribute the activation commit before creating comments; the two-release
preservation sequence limits the damage from such a stale client.
The release gate records this boundary instead of claiming a distributed lock that the
transport does not provide.

## Implementation Layers

| Layer | Bead | Contract | Public behavior |
| --- | --- | --- | --- |
| Record and storage foundation | `tbd-e1tu` | ID, schema, parser, bounded create-only storage, and this architecture | No CLI writer and no format activation |
| Inventory and transitions | `tbd-4r3w` | Bounded filesystem/Git inventory, immutable transition classification, and content-addressed quarantine | No Git integration or public writer |
| Git operation guards | `tbd-qo4d` | Validate every broad stage, commit, merge, fast-forward, and push parent edge | Existing f08 commands fail closed on comment damage |
| Workspace and history recovery | `tbd-7ufa` | Preserve comments through workspace/outbox, unrelated histories, migrations, repairs, and source clearing | Existing f08 recovery reports comment work accurately |
| Diagnostics and compatibility | `tbd-44kw` | Doctor and attic surfaces, scaffold and sync metadata validation, and packed old-client refusal | An f08-compatible preservation release can ship |
| Activation and commands | `tbd-x6eo` | Explicit f09 enablement, add/list/show/changes, and two-clone proof | Native comments become opt-in |

All four children of preservation epic `tbd-76ad` must be present before the activation
layer exposes any write.
Phase 2 remains a pre-release prototype until its Phase 1 dependency and full acceptance
matrix pass.

## Query and Cursor Semantics

Presentation sorts comments by `(created_at, id)`. Timestamps and greatest-seen ULIDs
are never durable delivery cursors: an imported or delayed record can arrive later with
an earlier time or identity.

Phase 2 list pages bind an opaque cursor to one bead and one fixed result snapshot.
If that snapshot changes between pages, the command reports a cursor reset rather than
silently skipping an insertion.
One-shot change reports compare comment-ID sets between two fixed Git commits, which
discovers late records independently of their timestamp.
Phase 3 may replace snapshot resets with the planned receiver-local generation and
sequence index.

Page limits apply at record boundaries.
The CLI returns complete bodies or an explicit limit error; it never truncates durable
prose. Initial record, byte, and cursor defaults remain release candidates until the
Phase 2 scale benchmark records their read cost and Git growth.

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
- temporary cleanup failures before the link and retryability after the atomic link

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
