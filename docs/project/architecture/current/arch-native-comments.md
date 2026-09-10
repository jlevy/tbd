---
title: Native Comment Record Architecture
description: Candidate immutable comment identity, storage, publication, compatibility, and provider boundaries for Git-native agent coordination
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Native Comment Record Architecture

Last updated: 2026-09-10

**Status:** Candidate internal foundation.
PR #282 implements record validation, serialization, bounded reads, deterministic paths,
and create-only local publication under `tbd-e1tu`. PR #283 implements bounded
filesystem, Git-ref, and Git-index inventories, pure immutable-transition planning, and
create-only quarantine evidence under `tbd-4r3w`. Both layers are internal and dormant:
they have no CLI route, public package export, active runtime caller, sync/workspace
integration, provider integration, or generated scaffold.
Current and freshly initialized repositories remain on format `f08`. Format `f09`,
native-comment commands, Git preservation, and provider projection remain proposed work
behind the gates below.

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

The candidate native-comment model would give every bead a durable conversation without
requiring a provider issue, pull request, or hosted mailbox.
Under this model, each comment is an immutable Markdown document.
Independent comments use separate paths and can therefore merge without rewriting the
parent bead or each other.

This document specifies the implemented internal record/storage and inventory/transition
foundations and the proposed contracts around them.
The remaining preservation layers under `tbd-76ad` must pass first.
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
- [tbd On-Disk Format Versioning](../../../tbd-format-versioning.md)
- [tbd design](../../../../packages/tbd/docs/tbd-design.md)

## Core Invariants

These are invariants for the complete candidate design.
PR #282 enforces the record, identity, serialization, and local publication subset.
PR #283 can inventory and classify candidate trees and construct quarantine artifacts,
but no production mutation path calls those helpers yet.

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
        ├── _unattributed/
        │   ├── <sha256-of-candidate-bytes>.md
        │   └── observations/
        │       └── <sha256-of-manifest>.yml
        └── cm-<ulid>/
            ├── <sha256-of-candidate-bytes>.md
            └── observations/
                └── <sha256-of-manifest>.yml
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

## Inventory Contract

Every future preservation path will consume the same `DataSyncInventory` shape.
PR #283 can build an inventory from a filesystem tree, a resolved Git commit, or one Git
index stage. It retains every bounded raw entry as well as the smaller map of accepted
comments, so a malformed file cannot disappear merely because parsing failed.
Filesystem and commit inventories have `full-tree` coverage.
Raw index stages have `sparse-paths` coverage because absence from a stage does not mean
deletion.

A comment is accepted only when all of these conditions hold:

- Its path is exactly `comments/<two lowercase hex>/<cm-id>.md`.
- The filename, hash shard, and embedded ID agree.
- Its Git mode is `100644`; filesystem records are regular, non-symlink files and are
  nonexecutable on POSIX.
- Its bytes are valid UTF-8, parse as the strict record schema, stay within the
  per-record limit, and equal the canonical serialization byte for byte.
- No other entry claims the same identity.

An invalid filename/content mismatch retains both identity claims.
The filename identity owns the occupied path and quarantine scope; the embedded identity
also participates in transition decisions, so neither identity can be accepted while the
conflict is hidden under the other.

The only nonrecord file admitted under the comments root is an empty, regular
`comments/.gitkeep` scaffold.
Empty canonical shard directories are harmless local residue.
The inventory identifies a publisher temporary file only when its name matches the exact
private temporary grammar; every other extra path is invalid.

Missing `comments/` means a complete empty legacy inventory only after the adapter has
proved that the selected data-sync root is valid.
The filesystem adapter requires the selected root to be a real directory before it
examines the optional child.
The Git-ref adapter proves `.tbd` and `.tbd/data-sync` are trees when no comments entry
is present. The index adapter rejects exact non-tree ancestor entries while allowing
Git’s implicit directories.
These checks are the fix for FABLE-283-01; a missing, file, or static symlink root
cannot be reported as a valid empty f08 source.

A known but unmaterialized or oversized entry remains visible as an incomplete problem
rather than an empty snapshot.
An overlong canonical UTF-8 path retains its decoded path and is marked invalid; because
the decoded path reproduces the exact bytes, it normally does not need `rawPathBase64`.
A non-UTF-8 path, or a decoded path that is unsafe for quarantine, uses a digest-bearing
diagnostic placeholder and retains its exact bytes in `rawPathBase64`. Exceeding the
entry-count, Git listing, or aggregate-byte ceiling aborts the inventory without
returning a partial result.
Filesystem enumeration, metadata, or bounded-read failure also aborts without returning
a partial inventory.
The initial internal safety ceilings are injectable and remain separate from future CLI
page limits; `tbd-z3ag` will calibrate activation defaults.

Git adapters never check out a source to inspect it.
They resolve symbolic refs to commit IDs, parse NUL-delimited tree and index listings as
raw bytes, and read blobs with bounded `git cat-file --batch` subprocesses.
All object reads disable local Git replacement refs, so validation observes the objects
that an ordinary push transfers.
They do not disable partial-clone or promisor-remote lazy fetch: `ls-tree -l` or
`cat-file` can fetch a missing object before the local listing and record bounds reject
it. The current ceilings therefore bound retained local output, not remote transfer or
object-store growth.
Before activation, `tbd-qo4d` must either disable lazy fetch or explicitly materialize
and measure it, with a partial-clone test.
Index conflicts produce separate stage 1, 2, and 3 inventories, preserving add/add and
deletion evidence. All four raw index stages remain explicitly sparse.
A later Git guard must read complete side commits or construct and validate a full
logical overlay before asking the transition engine to infer deletion.

## Immutable Transition Plans

`classifyNativeCommentTransitions()` is a pure N-way engine.
Its input is an authoritative full-tree common-parent inventory, when one exists, and
one or more full-tree candidate inventories.
It refuses sparse inputs rather than treating their omissions as deletion.
Its output chooses canonical records, classifies violations, and prepares quarantine
evidence; it does not edit, stage, merge, or commit a tree.

When a parent already contains an identity, its exact bytes remain canonical.
An absent candidate is a deletion, a different `issue_id` is reparenting, and any other
byte change is a modification.
A corrupt occupant at the canonical path is classified from the retained invalid entry
instead of being mistaken for a deletion.
A record moved to a wrong shard produces both the missing canonical record and the
invalid alternative.

With unrelated histories and no authoritative parent, absence means only that one source
never observed the identity.
One unique valid digest is accepted.
If multiple valid digests claim an ID, the lexicographically smallest SHA-256 digest
wins deterministically and every other digest is retained.
Reordering input sources cannot change the plan.
An invalid parent, an incomplete source, or an identity without any valid canonical
observation blocks automatic repair.

Plans distinguish accepted additions, byte-identical existing records, repairable
violations, and blocked violations.
A later Git guard may apply only a complete clean or repairable plan and must publish
all required evidence before replacing or restoring a path.

## Quarantine Evidence

Raw alternatives use content-addressed paths below `attic/comment-conflicts/<cm-id>/` or
`attic/comment-conflicts/_unattributed/`. Each preservable transition-plan observation
also gets an immutable manifest at `<scope>/observations/<manifest-sha256>.yml`. The
manifest records the violation, a resolved source revision when available or a stable
source descriptor, a safe relative source path or diagnostic, base64 original path bytes
when required, mode, Git object ID, canonical and candidate digests, and normalized
problem codes. A deletion has a manifest and no candidate blob.
An unmaterialized or over-bound observation that cannot produce a complete artifact
instead blocks mutation without publishing partial evidence.
Before a public CLI writer is enabled, its immediate `EEXIST` conflict path must publish
the same manifest after preserving the raw candidate.

Raw bytes are create-only published and verified before a referring manifest becomes
visible.
Both names are content addressed and reject occupied bytes that do not match; on
POSIX they also reject executability that would produce a different Git mode.
The publisher does not validate an index mode; the later Git guard owns that check.
Manifests omit wall-clock time, absolute filesystem paths, parser exception prose, and
symbolic Git refs. The same candidate bytes can therefore share one raw artifact while
distinct durable provenance tuples retain distinct manifests without merge hotspots.

The quarantine tree is protected immutable state, not expendable diagnostics.
PR #283 constructs and publishes individual bounded artifacts but does not inventory or
guard the quarantine tree as a whole.
Before a later Git guard can apply a plan, it must validate artifact paths, modes,
digests, schemas, and references and reject deletion or modification across every parent
edge. Managed data-sync attributes must disable text, encoding, identity, and filter
transformations for comment and quarantine paths.
After every broad stage, the guard must compare the exact index blobs with the planned
bytes before committing.

## Git and Provider Boundaries

The candidate layout gives distinct comments distinct files, so a later Git integration
can join independent additions without a custom merge driver.
PRs #282 and #283 add no comment-aware staging, Git merge, recovery, commit, or remote
publication path. Existing broad Git operations such as `git add -A` can incidentally
carry manually placed comment-shaped files, but that carriage is unsupported and does
not validate immutability or guarantee preservation.
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

At the PR #283 boundary, `CURRENT_FORMAT` is `f08`, and fresh setup writes `f08`. The
binary has no readable or writable `f09` mode, native-comment configuration, format
migration, `tbd comment enable` command, or `tbd comment add/list/show` commands.
The record, storage, inventory, transition, and quarantine modules have no public
package export or active runtime caller.
Standard setup, sync, workspace, recovery, and provider operations do not recognize,
validate, or guarantee preservation of a native comments tree.

A current f08 binary rejects a repository configuration newer than f08 after it observes
that configuration. This refusal does not protect native records from a stale clone that
has not incorporated a future activation commit, and the current binary has none of the
planned comments-tree preservation behavior.

Today `CURRENT_FORMAT` couples the readable-format ceiling, migration target, fresh
repository default, shared common-directory layout validation, and generated agent
integration marker. Merely changing it to `f09` would therefore make existing
repositories auto-migrate and fresh repositories start on f09, bypassing the proposed
opt-in activation. Before activation, `tbd-x6eo` must separate the readable ceiling from
the default and migration target and explicitly decide the common-layout and integration
marker semantics.

### Candidate f09 Sequence

The plan names `f09` as the candidate native-comment format, subject to the `tbd-z3ag`
format-freeze gate. No f09 constant or behavior is implemented by PR #283. The proposed
`tbd comment enable` spelling belongs to `tbd-x6eo` and remains subject to that bead’s
review.

The proposed activation sequence is:

1. Complete the remaining preservation layers `tbd-qo4d`, `tbd-7ufa`, and `tbd-44kw`,
   then ship an f08-compatible preservation release that keeps future comments and
   evidence intact through every copy, merge, repair, and stage path.
2. Establish that preservation release as the minimum binary for every participating
   writer and close the `tbd-z3ag` format-evidence gate.
3. Add the reviewed activation command in `tbd-x6eo`; have it produce an explicit
   `.tbd/config.yml` change to the selected format.
4. Review, commit, and distribute the activation change before creating native records.
5. Permit the future comment writer only after it rechecks the active format while
   holding the shared writer lock.

Git cannot retroactively fence a pre-preservation client on a stale branch.
An unknown writer or one below the preservation floor blocks activation.
The writer inventory and stale-clone proof in `tbd-x6eo` must bound this limitation
rather than claim a distributed lock that Git does not provide.

## Implementation Layers

| Layer | Bead | State at PR #283 | Contract | Public behavior at this boundary |
| --- | --- | --- | --- | --- |
| Record and storage foundation | `tbd-e1tu` | Implemented; internal and dormant | ID, schema, parser, bounded create-only storage, and this architecture | None; no CLI writer, public export, or format activation |
| Inventory and transitions | `tbd-4r3w` | Implemented; internal and dormant | Bounded filesystem/Git inventory, immutable transition classification, and content-addressed quarantine artifacts | None; no active Git guard, recovery caller, public export, or format activation |
| Git operation guards | `tbd-qo4d` | Open | Validate every broad stage, commit, merge, fast-forward, and push parent edge | None |
| Workspace and history recovery | `tbd-7ufa` | Open | Preserve comments through workspace/outbox, unrelated histories, migrations, repairs, and source clearing | None |
| Diagnostics and compatibility | `tbd-44kw` | Open | Doctor and attic surfaces, scaffold and sync metadata validation, and packed old-client refusal | None |
| Format evidence and freeze | `tbd-z3ag` | Open; follows preservation evidence | Compare candidates, exercise failure contracts, settle durable grammar, and record the selected format | None |
| Activation and commands | `tbd-x6eo` | Open; blocked by the earlier gates | Explicit format enablement, add/list/show/changes, writer inventory, and two-clone proof | None |

All four children of preservation epic `tbd-76ad` must land before the activation layer
can expose a write. At this boundary only `tbd-4r3w` is complete within that epic.
The Phase 1 epic `tbd-3eui`, the Phase 2 epic `tbd-raxf`, and the remaining
preservation, format, and activation gates remain open.

## Pre-Freeze Review Debt

`tbd-z3ag` owns two pre-freeze follow-ups from the independent PR #282 review.
They are mandatory before the candidate format can be frozen and before `tbd-x6eo` can
expose a writer:

The
[initial senior review](https://github.com/jlevy/tbd/pull/282#issuecomment-5612012547),
[disposition](https://github.com/jlevy/tbd/pull/282#issuecomment-5612094616), and
[final-head verification](https://github.com/jlevy/tbd/pull/282#issuecomment-5614315337)
record the evidence and the remaining boundaries.

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
| Shared bounded filesystem primitives | `packages/tbd/src/file/bounded-file.ts` |
| Binary-safe bounded Git blob reads | `packages/tbd/src/file/git-object-reader.ts` |
| Filesystem, Git-ref, and index-stage inventory | `packages/tbd/src/file/data-sync-inventory.ts` |
| Pure immutable-transition classification | `packages/tbd/src/file/native-comment-transition.ts` |
| Raw alternatives and provenance manifests | `packages/tbd/src/file/native-comment-quarantine.ts` |
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

The inventory and transition tests additionally pin bounded raw Git object framing,
filesystem and Git-root validation, exact canonical bytes, raw-path preservation,
aggregate limits, sparse-index refusal, deterministic N-way decisions, and idempotent
raw-before-manifest quarantine publication.
Transition classification indexes invalid entries once per source inventory; a
structural regression test pins one full traversal per inventory, and the repository
benchmark reports classification time for 50,000 valid records against a two-second
target. This addresses ASTRA-283-01 from the
[exact-head review](https://github.com/jlevy/tbd/pull/283#issuecomment-5625831806).
FABLE-283-01 was reported in the
[senior review](https://github.com/jlevy/tbd/pull/283#issuecomment-5597942066) and
closed with fail-closed filesystem/Git/index ancestor validation; the
[disposition](https://github.com/jlevy/tbd/pull/283#issuecomment-5598438633) records its
focused evidence.

`tbd-z3ag` owns the remaining syscall-error tests listed under
[Pre-Freeze Review Debt](#pre-freeze-review-debt).
Later layers add delayed-parent and cross-bead reply diagnostics, two-clone Git
exchange, active merge/delete/reparent repair, quarantine-tree integrity, workspace and
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
