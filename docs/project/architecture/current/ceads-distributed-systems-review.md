# Ceads Design: Distributed Systems Review

**Reviewer:** Claude (Opus 4.5)

**Date:** January 2025

**Document Reviewed:** [ceads-design.md](ceads-design.md)

**Last Updated:** January 2025 (reflects `.ceads/` + `.ceads-sync/` directory split)

* * *

## Executive Summary

The Ceads design makes a clear and correct choice: **Git is the source of truth**. This
is the right foundation.
However, several areas need deeper specification, particularly around the Bridge Layer’s
consistency model, clock synchronization, and claim coordination semantics.

This review identifies issues ranging from critical (will cause data loss) to
nice-to-have (future improvements), with actionable recommendations for each.

### Directory Structure Reference

The design uses a split directory structure:

| Directory | Branch | Contents | Tracked |
| --- | --- | --- | --- |
| `.ceads/config.yml` | main | Project configuration | ✓ Yes |
| `.ceads/.gitignore` | main | Ignores local files | ✓ Yes |
| `.ceads/local/` | main | All local files (nodes, cache, daemon) | ✗ Gitignored |
| `.ceads-sync/nodes/` | ceads-sync | Synced entities | ✓ Yes |
| `.ceads-sync/attic/` | ceads-sync | Conflict archive | ✓ Yes |
| `.ceads-sync/meta.json` | ceads-sync | Runtime metadata | ✓ Yes |

This separation ensures synced data never causes merge conflicts on working branches.

* * *

## Table of Contents

1. [Source of Truth: Git vs Bridge](#1-source-of-truth-git-vs-bridge)

2. [Clock Synchronization and LWW: A Critical
   Flaw](#2-clock-synchronization-and-lww-a-critical-flaw)

3. [Claim Coordination: Race Conditions](#3-claim-coordination-race-conditions)

4. [Bridge Layer Consistency Guarantees](#4-bridge-layer-consistency-guarantees)

5. [GitHub Issues Bridge: Specific Concerns](#5-github-issues-bridge-specific-concerns)

6. [Message Ordering and Causality](#6-message-ordering-and-causality)

7. [Offline-First Cache: Missing Guarantees](#7-offline-first-cache-missing-guarantees)

8. [Sequence Array Merge: Open Question
   Analysis](#8-sequence-array-merge-open-question-analysis)

9. [Summary of Recommendations](#9-summary-of-recommendations)

10. [Alternative Architecture: Event
    Sourcing](#10-alternative-architecture-event-sourcing)

11. [Additional Issues (Second Pass Review)](#11-additional-issues-second-pass-review)

12. [Operational Plan: Critical and Important
    Edits](#12-operational-plan-critical-and-important-edits)

* * *

## 1. Source of Truth: Git vs Bridge

### Current Design

The document states (line 1749):
> “Git remains truth: Bridges are views/caches; git is always authoritative”

**This is the correct choice.** Here’s why:

| Approach | Pros | Cons |
| --- | --- | --- |
| **Git as truth** (current) | Durable, auditable, works offline, no vendor lock-in | Higher latency for coordination |
| **Bridge as truth** | Sub-second coordination, real-time updates | Single point of failure, requires connectivity, data loss risk |

### Recommendation: Keep Git as Source of Truth

The design correctly positions bridges as **eventually consistent caches** with Git as
the durable log. However, the document needs to be more explicit about what “Git wins”
means in practice.

**Add explicit conflict resolution rules for bridge sync:**

```
Bridge Sync Conflict Resolution:
1. Compare Git entity version vs Bridge entity metadata.synced_version
2. If Git version > synced_version: Git wins (bridge is stale)
3. If Git version == synced_version but bridge changed: Bridge change accepted, bump Git version
4. If Git version > synced_version AND bridge changed: CONFLICT
   → Git wins, bridge change preserved in attic with bridge_source metadata
```

* * *

## 2. Clock Synchronization and LWW: A Critical Flaw

### The Problem

The merge algorithm (section 3.6 of the design) relies heavily on `updated_at`
timestamps:

```typescript
// Line 1011 of design doc
merged[field] = local.updated_at >= remote.updated_at
  ? localVal
  : remoteVal;
```

**This is a classic distributed systems anti-pattern.** Wall-clock time cannot be
trusted:

- NTP drift can be 10-100ms typically, but seconds or minutes in edge cases

- A machine with a fast clock always “wins” LWW conflicts

- Containerized environments often have inconsistent clocks

- Cloud-hosted IDEs may have different clock sources

### Real-World Scenario

```
Machine A (clock: 10:00:00): Updates issue title to "Fix auth"
Machine B (clock: 10:00:05 - 5 seconds fast): Updates title to "Refactor auth"
Machine A syncs first, pushes version 3
Machine B syncs, detects conflict (same version, different hash)
  → B's update "wins" because B's timestamp is later
  → User on Machine A loses their change silently
```

### Recommendation: Hybrid Logical Clocks (HLC)

Replace wall-clock timestamps with **Hybrid Logical Clocks** for conflict resolution:

```typescript
const HybridTimestamp = z.object({
  wall: z.string().datetime(),  // Wall clock (informational)
  logical: z.number().int(),     // Logical counter
  node_id: z.string(),           // Node identifier for tiebreaking
});

// BaseEntity update
const BaseEntity = z.object({
  type: EntityType,
  id: EntityId,
  version: Version,
  created_at: Timestamp,      // Wall clock for display
  updated_at: Timestamp,      // Wall clock for display
  hlc: HybridTimestamp,       // For conflict resolution
});
```

**HLC Merge Rule:**

```typescript
function hlcCompare(a: HybridTimestamp, b: HybridTimestamp): number {
  if (a.logical !== b.logical) return a.logical - b.logical;
  if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
  return a.node_id.localeCompare(b.node_id);  // Deterministic tiebreak
}
```

**Benefits:**

- Provides causal ordering without synchronized clocks

- Deterministic: same inputs always produce same winner

- `wall` field still available for human-readable display

**Reference:** [Kulkarni et al., “Logical Physical Clocks and Consistent Snapshots in
Globally Distributed Databases”](https://cse.buffalo.edu/tech-reports/2014-04.pdf)

* * *

## 3. Claim Coordination: Race Conditions

### The Problem

Claims are critical for multi-agent coordination, but the current design has significant
race windows:

**Without Daemon (section 4.5 of design):**

```
Agent A: cead agent claim cd-a1b2
Agent B: cead agent claim cd-a1b2  (simultaneously)
Both read: issue.assignee is null
Both write: issue.assignee = self
Both sync to git
→ One wins via LWW, but both agents may have started work
```

**With Daemon (local only):**

The daemon provides atomic claims locally, but cross-machine claims still race through
Git.

### Git Sync Latency Problem

Even with frequent sync (sub-minute), there’s a window where:

1. Agent A claims issue, syncs

2. Agent B claims same issue before A’s sync propagates

3. Both believe they own the claim

### Recommendation: Lease-Based Claims with Bridge Coordination

**For single-machine (daemon mode):** Current design is adequate.

**For multi-machine coordination:** Use the Bridge Layer for real-time claim
coordination:

```typescript
const Claim = z.object({
  issue_id: EntityId,
  agent_id: EntityId,
  claimed_at: Timestamp,
  lease_expires: Timestamp,        // TTL for the claim
  lease_sequence: z.number(),      // Monotonic, prevents ABA problem
});
```

**Claim Protocol:**

```
1. Agent requests claim via Bridge (if available)
2. Bridge performs atomic compare-and-swap
3. On success: Bridge returns lease_sequence
4. Agent must renew lease before expiry
5. Git sync records claims durably, but Bridge provides real-time coordination
6. If Bridge unavailable: Fall back to git-based claiming with advisory warning
```

**Add to IssueSchema:**

```typescript
const IssueSchema = BaseEntity.extend({
  // ... existing fields ...
  claim: z.object({
    agent_id: EntityId,
    lease_sequence: z.number(),
    lease_expires: Timestamp,
  }).optional(),
});
```

This separates the **coordination concern** (real-time, through Bridge) from the
**durability concern** (Git).

* * *

## 4. Bridge Layer Consistency Guarantees

### What’s Missing

The document describes the Bridge Layer architecture but doesn’t define explicit
consistency guarantees.
For a distributed system, these must be explicit.

### Recommended Consistency Model Definition

Add a new section to the design doc: **5.2.1 Consistency Guarantees**

```markdown
### Bridge Consistency Model

**Read-Your-Writes**: After an agent writes via Bridge, subsequent reads
from the same agent will reflect that write.

**Eventual Consistency**: All agents will eventually see the same state.
Convergence time depends on sync frequency and network conditions.

**No Strong Consistency**: Ceads does NOT provide linearizability or
serializable transactions. Concurrent writes to the same entity may
require conflict resolution.

**Monotonic Reads**: Once an agent sees version N of an entity, it will
never see version < N (within the same session).

**Conflict Preservation**: No write is ever lost. Conflict losers are
preserved in the attic.
```

### Latency Expectations

Define expected latencies for different modes:

| Mode | Operation | Expected Latency |
| --- | --- | --- |
| File-only | Read/Write | <10ms |
| Git sync | Pull/Push | 1-30 seconds |
| Bridge (GitHub) | Propagation | 1-5 seconds (webhook) |
| Bridge (Native) | Propagation | <100ms |
| Bridge (Slack) | Message delivery | <1 second |

* * *

## 5. GitHub Issues Bridge: Specific Concerns

### Field Mapping Conflicts

The document shows GitHub ↔ Ceads field mapping (section 5.3), but doesn’t address:

**Problem:** GitHub Issues have their own versioning (`updated_at`, ETags).
When both systems change:

```
Ceads: status → in_progress (version 5)
GitHub: User adds comment, closes issue via GitHub UI
Sync runs:
  → Which state wins?
  → Is the GitHub comment captured?
  → Is the status change from GitHub honored?
```

### Recommendation: Define Sync Direction Per-Field

```typescript
const GitHubBridgeConfig = z.object({
  field_sync: z.object({
    title: z.enum(['ceads_wins', 'github_wins', 'lww']).default('lww'),
    description: z.enum(['ceads_wins', 'github_wins', 'lww']).default('ceads_wins'),
    status: z.enum(['ceads_wins', 'github_wins', 'lww']).default('lww'),
    labels: z.enum(['union', 'ceads_wins', 'github_wins']).default('union'),
    comments: z.literal('union'),  // Always merge comments from both
  }),
});
```

### GitHub Rate Limits

Not mentioned: GitHub API has rate limits (5,000 requests/hour for authenticated
requests). With many agents syncing frequently, this becomes a concern.

**Add:** Rate limit handling, exponential backoff, and request batching.

* * *

## 6. Message Ordering and Causality

### Current Design

Messages sort by `created_at`:

```typescript
// Line 594 of design doc
messages.filter(m => m.in_reply_to === 'is-a1b2')
// Implicitly sorted by created_at
```

### The Problem

With clock skew, messages can appear out of order:

```
Agent A (slow clock): Posts "I'll fix this" at 10:00:00
Agent B (fast clock): Posts "Already fixed" at 10:00:05 (actual time: 10:00:00)
UI shows: "Already fixed" then "I'll fix this"
```

### Recommendation: Causal Ordering for Messages

For the threaded case (`in_reply_to` chains), enforce causal ordering:

```typescript
const MessageSchema = BaseEntity.extend({
  // ... existing fields ...

  // Causal ordering
  causal_deps: z.array(EntityId).default([]),  // Messages this depends on
  lamport_time: z.number().int(),              // Logical timestamp
});
```

**Ordering rule:** A message M can only be displayed after all messages in
`M.causal_deps` are displayed.

For simple comment threads (no replies to replies), the current design is probably
acceptable with a note that ordering is best-effort.

* * *

## 7. Offline-First Cache: Missing Guarantees

### Current Design (Section 5.8 of design doc)

```
cache/outbound/  → Queue messages until bridge confirms
cache/inbound/   → Buffer recent messages with TTL
```

### Missing Specifications

**1. Retry Policy**

What happens after repeated failures?

```typescript
const RetryPolicy = z.object({
  max_attempts: z.number().default(10),
  initial_backoff_ms: z.number().default(1000),
  max_backoff_ms: z.number().default(300000),  // 5 minutes
  backoff_multiplier: z.number().default(2),
});
```

**2. Dead Letter Queue**

After max_attempts, where do messages go?

```
cache/dead_letter/  → Messages that failed delivery after max attempts
```

**3. Idempotency Keys**

Prevent duplicate delivery:

```typescript
const OutboundMessage = z.object({
  idempotency_key: z.string().uuid(),  // Unique per message attempt
  message: MessageSchema,
  created_at: Timestamp,
  attempts: z.number().default(0),
  last_attempt: Timestamp.optional(),
  last_error: z.string().optional(),
});
```

**4. Order Guarantees**

Is FIFO required? The document says “FIFO” but doesn’t specify behavior on failure:

- If message 2 succeeds but message 1 fails, is message 2 delivered?

- Or does message 1 block the queue?

* * *

## 8. Sequence Array Merge: Open Question Analysis

The document asks about merging concurrent `sequence` array changes (Question 3 in
Appendix 7.2).

### Analysis of Options

| Option | Behavior | Pros | Cons |
| --- | --- | --- | --- |
| LWW with attic | Later timestamp wins | Simple, recoverable | May lose intentional reordering |
| OT | Transform concurrent ops | Preserves intent | Complex implementation |
| Union + sort | Merge and re-sort | No data loss | Order may not match either intent |
| Conflict marker | User resolves | Explicit | Blocks progress |

### Recommendation: LWW with Enhanced Attic

LWW is the right choice for v1, but enhance the attic entry:

```typescript
const SequenceAtticEntry = AtticEntrySchema.extend({
  field: z.literal('sequence'),
  lost_value: z.array(EntityId),

  // Enhanced context for sequence conflicts
  sequence_context: z.object({
    added_items: z.array(EntityId),    // Items winner added
    removed_items: z.array(EntityId),  // Items winner removed
    reordered: z.boolean(),            // Was this a reorder?
  }).optional(),
});
```

This makes attic recovery more actionable: users can see what changed and manually
reconcile if needed.

* * *

## 9. Summary of Recommendations

### Critical (Should Address Before v1)

These issues will cause data loss or incorrect behavior in production:

- [ ] **Replace LWW timestamps with HLC** — Clock skew will cause silent data loss when
  machines have unsynchronized clocks.
  See [Section 2](#2-clock-synchronization-and-lww-a-critical-flaw).

- [ ] **Define Bridge consistency guarantees explicitly** — Users and implementers need
  to know what consistency properties the system provides.
  See [Section 4](#4-bridge-layer-consistency-guarantees).

- [ ] **Add idempotency keys to outbound queue** — Without idempotency, network retries
  will cause duplicate message delivery.
  See [Section 7](#7-offline-first-cache-missing-guarantees).

### Important (Strong Recommendation)

These issues may cause problems in multi-agent scenarios:

- [ ] **Lease-based claims with Bridge coordination** — Current design has race
  conditions where multiple agents may claim the same issue.
  See [Section 3](#3-claim-coordination-race-conditions).

- [ ] **Define GitHub field-level sync direction** — Bidirectional sync with GitHub
  needs clear conflict resolution rules per field.
  See [Section 5](#5-github-issues-bridge-specific-concerns).

- [ ] **Add retry policy and dead letter queue** — Offline-first messaging needs defined
  failure handling behavior.
  See [Section 7](#7-offline-first-cache-missing-guarantees).

- [ ] **Add explicit bridge sync conflict resolution rules** — Document what happens
  when Git and Bridge both have changes.
  See [Section 1](#1-source-of-truth-git-vs-bridge).

### Nice to Have (v2 Considerations)

These would improve the system but aren’t blocking for v1:

- [ ] **Causal ordering for messages** — Lamport timestamps for threaded conversations
  to handle clock skew.
  See [Section 6](#6-message-ordering-and-causality).

- [ ] **CRDT consideration for labels/dependencies** — More principled merge for
  set-like fields (G-Set or 2P-Set).
  See distributed systems references in design doc.

- [ ] **Enhanced sequence merge context in attic** — Better attic entries for recovery
  when sequence arrays conflict.
  See [Section 8](#8-sequence-array-merge-open-question-analysis).

- [ ] **GitHub rate limit handling** — Add exponential backoff and request batching for
  GitHub API calls.

* * *

## 10. Alternative Architecture: Event Sourcing

One alternative worth considering for future evolution: **Event Sourcing** instead of
state-based sync.

### Current Design (State-Based)

```
Entity: { version: 5, title: "Fix bug", status: "open" }
Sync: Compare states, merge conflicts
```

### Alternative (Event-Based)

```
Events:
  [v1] IssueCreated { title: "Fix bug" }
  [v2] StatusChanged { from: "open", to: "in_progress" }
  [v3] TitleChanged { from: "Fix bug", to: "Fix auth bug" }

Sync: Replicate events, derive state
```

**Benefits:**

- No merge conflicts on concurrent non-overlapping changes

- Complete audit trail built-in

- Events are immutable, append-only

- Natural fit for Git (append-only log)

**Tradeoffs:**

- More complex implementation

- Event log grows unbounded (needs compaction)

- Requires careful event schema design

This is a significant architectural change that may not be appropriate for v1, but worth
considering for future evolution if merge conflicts become a pain point.

* * *

## Conclusion

The Ceads design is well-thought-out and makes correct foundational choices:

- Git as source of truth ✓

- Schema-agnostic sync ✓

- Layered architecture ✓

- Optional complexity (daemon, bridges) ✓

- No data loss philosophy (attic) ✓

The main areas needing work are:

1. **Clock-independent conflict resolution** (HLC instead of wall-clock LWW)

2. **Explicit consistency guarantees** for the Bridge Layer

3. **Real-time claim coordination** for multi-agent scenarios

4. **Offline-first reliability** (idempotency, retry policy, dead letters)

These are tractable problems with known solutions from distributed systems literature.
The design provides a solid foundation to build on.

* * *

## 11. Additional Issues (Second Pass Review)

The following issues were identified in a second review pass and should be addressed
alongside the original recommendations.

### 11.1 ID Generation and Collision Risk (Important)

**Problem:** The design states IDs are “hash-based” with 4-8 characters but doesn’t
specify:

- Input to the hash function

- Hash algorithm

- Collision detection/handling

With 4-character alphanumeric hashes (36^4 ≈ 1.7M possibilities) and thousands of
entities, birthday paradox collisions become likely.

**Recommendation:** Add explicit ID generation specification:

```typescript
const generateEntityId = (prefix: string): string => {
  // Use crypto-random bytes, not timestamp or content hash
  const bytes = crypto.randomBytes(6);  // 48 bits
  const hash = bytes.toString('base36').slice(0, 6);  // 6 chars
  return `${prefix}${hash}`;
};

// On write, verify no collision exists
const createEntity = async (entity: Entity): Promise<void> => {
  const path = entityPath(entity.id);
  if (await fileExists(path)) {
    throw new CollisionError(`ID collision: ${entity.id}`);
  }
  await writeFile(path, entity);
};
```

Add to design doc Section 2.4:
> ID hash portion uses 6 characters of base36-encoded cryptographically random bytes,
> providing ~2 billion unique values per prefix.
> On the rare collision, regenerate the ID.

* * *

### 11.2 Partial Sync Failures (Important)

**Problem:** What happens if git push succeeds for some objects but the connection drops
mid-push? Or if local file writes succeed for some entities but fail for others during
pull?

**Recommendation:** Add sync transaction semantics:

```markdown
### Sync Atomicity (add to Section 3.3)

**Pull atomicity:**
1. Fetch all remote changes to temp staging area
2. Validate all entities parse correctly
3. Apply changes atomically (write all or none)
4. On failure: log error, leave local state unchanged

**Push atomicity:**
- Git's native push is atomic (succeeds or fails completely)
- If push fails after local modifications, those modifications remain local
- Next sync attempt will retry

**Recovery after max retries:**
- Log detailed error to `.ceads/sync-error.log` (local, gitignored)
- Set `.ceads-sync/meta.json` field `sync_status = "failed"` (on sync branch)
- `cead sync --status` shows pending changes and error
- Manual intervention: `cead sync --force` or `cead sync --reset`
```

* * *

### 11.3 Multi-Entity Atomicity (Important)

**Problem:** Operations like “move subtask to new parent” require updating 3 files
atomically. Process crash mid-operation leaves inconsistent state.

**Recommendation:** Add operation journaling:

```typescript
// Add to design doc Section 2 or new Section 2.6

interface OperationJournal {
  operation_id: string;
  started_at: Timestamp;
  operations: Array<{
    action: 'write' | 'delete';
    path: string;
    content?: string;  // For writes
    backup?: string;   // Previous content for rollback
  }>;
  status: 'pending' | 'committed' | 'rolled_back';
}

// Journal stored in .ceads/local/journal/ (on main branch, gitignored)
// On startup, check for incomplete journals and either:
// - Complete if all writes succeeded
// - Rollback if any failed
```

Alternative (simpler for v1): Document that multi-entity operations may leave
inconsistent state recoverable via `cead doctor --fix`.

* * *

### 11.4 Schema Migration Strategy (Important)

**Problem:** `schema_versions` is tracked but migration execution is undefined.
What happens when Agent A (schema v2) syncs with Agent B (schema v1)?

**Recommendation:** Add migration rules to design doc Section 2:

```markdown
### Schema Versioning and Migration

**Forward compatibility requirement:**
- Newer schemas MUST be able to read older versions
- Unknown fields are preserved (pass-through)
- Missing fields use schema defaults

**Backward compatibility:**
- Old clients reading new entities: unknown fields ignored
- Critical fields (id, version, type) never change shape

**Migration execution:**
- On read: entities auto-upgrade to latest schema in memory
- On write: always write latest schema version
- `schema_versions` in `.ceads-sync/meta.json` tracks minimum required version
- If local schema_version < remote, warn user to upgrade CLI

**Breaking changes:**
- Require explicit migration: `cead migrate --to v2`
- Bumps `.ceads-sync/meta.json` schema_versions
- Transforms all entities in-place
```

* * *

### 11.5 Webhook Security (Important for Bridge Layer)

**Problem:** Bridge Layer receives webhooks from GitHub/Slack but validation isn’t
specified.

**Recommendation:** Add to Section 5:

```markdown
### Bridge Webhook Security (add to Section 5.2)

**GitHub Webhooks:**
- Validate `X-Hub-Signature-256` header using webhook secret
- Reject requests with invalid or missing signatures
- Store secret in environment variable, never in config files

**Slack Events:**
- Validate `X-Slack-Signature` header
- Verify `X-Slack-Request-Timestamp` is within 5 minutes
- Implement URL verification challenge response

**General:**
- Rate limit webhook endpoints (100 req/min per source)
- Log all webhook validation failures
- Webhook secrets rotatable without downtime
```

* * *

### 11.6 Outbound Queue Crash Safety (Medium)

**Problem:** If crash occurs after bridge confirms delivery but before queue file
deletion, message resends on restart.

**Recommendation:** This is solved by idempotency keys (already in Critical
recommendations). Add clarification:

```markdown
### Outbound Queue Delivery Guarantees (add to Section 5.8)

**At-least-once delivery:**
- Messages may be delivered multiple times on crash recovery
- Bridges MUST handle duplicate idempotency keys gracefully
- Receivers should deduplicate by `idempotency_key`

**Delivery confirmation:**
1. Send message with `idempotency_key`
2. Bridge confirms receipt
3. Mark queue file as `delivered` (rename to `.delivered`)
4. Periodic cleanup removes `.delivered` files after 1 hour
```

* * *

### 11.7 Entity Reference Integrity During Sync (Medium)

**Problem:** During sync, entities may arrive referencing other entities that haven’t
synced yet.

**Recommendation:** Add to Section 3.3:

```markdown
### Reference Integrity During Sync

**Soft references:**
- `in_reply_to`, `dependencies.target`, `working_on` are soft references
- Missing targets are NOT sync errors
- `cead doctor` detects and reports broken references post-sync

**Sync order:**
- No ordering requirements; entities sync independently
- Temporary broken references are expected during partial sync
- Full integrity restored after complete sync cycle

**Orphan handling:**
- Orphans detected by `cead doctor` or during entity access
- Orphaned entities moved to `attic/orphans/` with context
- Never auto-deleted; always recoverable
```

* * *

## 12. Operational Plan: Critical and Important Edits

This section provides a step-by-step implementation plan for all Critical and Important
items. Work through these sequentially, making the specified edits to
[ceads-design.md](ceads-design.md).

* * *

### Phase 1: Critical Issues (Must Address Before v1)

#### Edit 1.1: Replace LWW Timestamps with Hybrid Logical Clocks

**Location:** Section 2.5.1 (Common Types) and Section 2.5.2 (BaseEntity)

**Current:**
```typescript
// Section 2.5.1
const Timestamp = z.string().datetime();

// Section 2.5.2
const BaseEntity = z.object({
  type: EntityType,
  id: EntityId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,
});
```

**Replace with:**
```typescript
// Section 2.5.1 - Add after Timestamp definition
const Timestamp = z.string().datetime();

// Hybrid Logical Clock for conflict resolution
// See: https://cse.buffalo.edu/tech-reports/2014-04.pdf
const HybridTimestamp = z.object({
  wall: z.string().datetime(),  // Wall clock (for display)
  logical: z.number().int(),     // Lamport-style counter
  node: z.string(),              // Node identifier for deterministic tiebreak
});

// Section 2.5.2 - Update BaseEntity
const BaseEntity = z.object({
  type: EntityType,
  id: EntityId,
  version: Version,
  created_at: Timestamp,      // Wall clock for display
  updated_at: Timestamp,      // Wall clock for display
  hlc: HybridTimestamp,       // For merge conflict resolution
});
```

**Also update Section 3.6 (Merge Algorithm):**

**Current (lines ~1010-1012):**
```typescript
case 'lww':
  merged[field] = local.updated_at >= remote.updated_at
    ? localVal
    : remoteVal;
  break;
```

**Replace with:**
```typescript
case 'lww':
  merged[field] = hlcCompare(local.hlc, remote.hlc) >= 0
    ? localVal
    : remoteVal;
  break;

// Add helper function before mergeEntities:
function hlcCompare(a: HybridTimestamp, b: HybridTimestamp): number {
  // Compare logical counter first (causal ordering)
  if (a.logical !== b.logical) return a.logical - b.logical;
  // Tiebreak by wall clock (best effort)
  if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
  // Final tiebreak by node ID (deterministic)
  return a.node.localeCompare(b.node);
}

// Add HLC update function:
function updateHlc(current: HybridTimestamp, nodeId: string): HybridTimestamp {
  const now = new Date().toISOString();
  return {
    wall: now,
    logical: now > current.wall ? current.logical + 1 : current.logical + 1,
    node: nodeId,
  };
}
```

* * *

#### Edit 1.2: Add Bridge Consistency Guarantees

**Location:** Add new Section 5.2.1 after Section 5.2 (Bridge Architecture)

**Add:**
```markdown
### 5.2.1 Bridge Consistency Guarantees

Bridges provide eventually consistent views of Git state. The following guarantees apply:

#### Consistency Model

| Guarantee | Description |
|-----------|-------------|
| **Read-Your-Writes** | After writing via Bridge, same agent's reads reflect that write |
| **Eventual Consistency** | All agents eventually see the same state |
| **Monotonic Reads** | Once version N seen, never see version < N (same session) |
| **Conflict Preservation** | No data ever lost; conflicts preserved in attic |

**Ceads does NOT provide:**
- Linearizability (global ordering)
- Serializable transactions
- Strong consistency

#### Latency Expectations

| Mode | Operation | Expected Latency |
|------|-----------|------------------|
| File-only | Read/Write | <10ms |
| Git sync | Pull/Push | 1-30 seconds |
| Bridge (GitHub) | Propagation | 1-5 seconds (webhook) |
| Bridge (Native) | Propagation | <100ms |
| Bridge (Slack) | Message delivery | <1 second |

#### Git vs Bridge Conflict Resolution

When Git and Bridge both have changes to the same entity:

1. Compare Git entity `version` vs Bridge metadata `synced_version`
2. If Git version > synced_version: **Git wins** (bridge is stale)
3. If Git version == synced_version AND bridge changed: **Bridge accepted**, bump Git version
4. If Git version > synced_version AND bridge changed: **CONFLICT**
   - Git wins
   - Bridge changes preserved in attic with `source: "bridge"` metadata
```

* * *

#### Edit 1.3: Add Idempotency Keys to Outbound Queue

**Location:** Section 5.8 (Offline-First Architecture), update Cache Types and add
schema

**Current (Section 5.8, Cache State Schema around line 2273):**
```typescript
const CacheState = z.object({
  last_bridge_sync: Timestamp.optional(),
  connection_status: z.enum(['connected', 'disconnected', 'connecting']),
  retry_count: z.number().default(0),
  last_error: z.string().optional(),
  outbound_count: z.number().default(0),
});
```

**Add before CacheState:**
```typescript
// Outbound queue item with idempotency
const OutboundQueueItem = z.object({
  idempotency_key: z.string().uuid(),      // Unique per send attempt
  entity_type: z.enum(['message', 'claim', 'release', 'update']),
  payload: z.unknown(),                     // Entity or operation data
  created_at: Timestamp,
  attempts: z.number().default(0),
  last_attempt_at: Timestamp.optional(),
  last_error: z.string().optional(),
  max_attempts: z.number().default(10),
});

// Retry policy configuration
const RetryPolicy = z.object({
  max_attempts: z.number().default(10),
  initial_backoff_ms: z.number().default(1000),
  max_backoff_ms: z.number().default(300000),  // 5 minutes
  backoff_multiplier: z.number().default(2),
});
```

**Update CacheState:**
```typescript
const CacheState = z.object({
  last_bridge_sync: Timestamp.optional(),
  connection_status: z.enum(['connected', 'disconnected', 'connecting']),
  retry_policy: RetryPolicy.default({}),
  last_error: z.string().optional(),
  outbound_count: z.number().default(0),
  dead_letter_count: z.number().default(0),  // Items that exceeded max_attempts
});
```

**Add to directory structure (Section 5.8):**
```
.ceads/local/cache/
├── outbound/              # Queue: items waiting to send
│   ├── {uuid}.json        # Pending items
│   └── {uuid}.delivered   # Confirmed, awaiting cleanup
├── inbound/               # Buffer: recent items from bridge
├── dead_letter/           # Failed after max_attempts
│   └── {uuid}.json
└── state.json
```

* * *

### Phase 2: Important Issues (Strong Recommendation)

#### Edit 2.1: Add Lease-Based Claims

**Location:** Section 2.5.3 (IssueSchema), add claim field

**Current IssueSchema (around line 460):**
```typescript
const IssueSchema = BaseEntity.extend({
  // ... existing fields ...
  assignee: z.string().optional(),
  // ...
});
```

**Add after assignee:**
```typescript
  assignee: z.string().optional(),

  // Lease-based claim for coordination
  claim: z.object({
    agent_id: EntityId,
    claimed_at: Timestamp,
    lease_expires: Timestamp,       // TTL for the claim
    lease_sequence: z.number(),     // Monotonic, prevents ABA problem
  }).optional(),
```

**Add to Section 4.5 (Agent Commands), update Claim section:**

**Current:**
```bash
cead agent claim <issue-id>
```

**Expand to:**
```bash
cead agent claim <issue-id> [options]

Options:
  --ttl <seconds>         Lease duration (default: 3600 = 1 hour)
  --force                 Claim even if already claimed (steals claim)

# Lease renewal
cead agent renew <issue-id> [options]

Options:
  --ttl <seconds>         New lease duration
```

**Add claim protocol documentation (new subsection under 4.5):**
```markdown
#### Claim Protocol

**Without Bridge (Git-only):**
1. Read issue, check if `claim` exists and `lease_expires > now`
2. If claimed by another agent: error (unless --force)
3. Write issue with new `claim` object, increment `lease_sequence`
4. Sync to propagate claim
5. Race condition window: sync latency (seconds to minutes)

**With Bridge (recommended for multi-agent):**
1. Request claim via Bridge (atomic compare-and-swap)
2. Bridge validates: no active lease OR force flag
3. Bridge updates lease, returns `lease_sequence`
4. Agent must renew before `lease_expires`
5. Git sync records claim durably
6. If Bridge unavailable: fall back to Git-only with warning

**Lease expiry:**
- Expired claims can be stolen by any agent
- `cead ready` excludes issues with active (non-expired) claims
- Stale claims (agent inactive + expired lease) auto-release
```

* * *

#### Edit 2.2: Add GitHub Field-Level Sync Direction

**Location:** Section 5.3 (GitHub Issues Bridge), add configuration schema

**Add after “Field Mapping” table:**
````markdown
#### Sync Direction Configuration

Each field can have a sync direction policy:

```typescript
const GitHubSyncDirection = z.enum([
  'ceads_wins',    // Ceads overwrites GitHub
  'github_wins',   // GitHub overwrites Ceads
  'lww',           // Last-write-wins by timestamp
  'union',         // Merge both (for arrays)
  'readonly',      // Ceads reads from GitHub, never writes
]);

const GitHubBridgeConfig = z.object({
  enabled: z.boolean(),
  repo: z.string(),                    // "owner/repo"
  auto_promote: z.boolean().default(false),

  field_sync: z.object({
    title: GitHubSyncDirection.default('lww'),
    description: GitHubSyncDirection.default('ceads_wins'),
    status: GitHubSyncDirection.default('lww'),
    priority: GitHubSyncDirection.default('ceads_wins'),
    labels: GitHubSyncDirection.default('union'),
    assignee: GitHubSyncDirection.default('lww'),
    comments: z.literal('union'),      // Always merge, never overwrite
  }).default({}),

  rate_limit: z.object({
    requests_per_hour: z.number().default(4000),  // Leave buffer below 5000
    burst_size: z.number().default(100),
  }).default({}),
});
````

**Default behavior:**

- `title`, `status`, `assignee`: LWW (collaborative editing)

- `description`, `priority`: Ceads wins (agent is authority)

- `labels`: Union (both sources contribute)

- `comments`: Always merged, never deleted

#### Rate Limiting

GitHub API limits: 5,000 requests/hour (authenticated).

**Implementation:**

- Track request count in `.ceads/local/cache/state.json`

- Exponential backoff on 429 responses

- Batch operations where possible (GraphQL)

- Log warning at 80% of limit
````

---

#### Edit 2.3: Add Retry Policy and Dead Letter Queue

**Location:** Section 5.8 (Offline-First Architecture)

**Add after "Message Flow" diagram:**
```markdown
#### Retry and Failure Handling

**Retry Policy:**
````
Attempt 1: immediate Attempt 2: 1 second delay Attempt 3: 2 seconds Attempt 4: 4 seconds
… Attempt N: min(initial * 2^(N-1), max_backoff)
````

**After max_attempts exceeded:**
1. Move item from `.ceads/local/cache/outbound/` to `.ceads/local/cache/dead_letter/`
2. Increment `dead_letter_count` in `.ceads/local/cache/state.json`
3. Log error with full context
4. Item preserved indefinitely until manual intervention

**Dead letter recovery:**
```bash
# List dead letter items
cead cache dead-letter list

# Retry a dead letter item
cead cache dead-letter retry <idempotency-key>

# Discard a dead letter item
cead cache dead-letter discard <idempotency-key>
````

**FIFO Ordering:**

- Outbound queue is FIFO within entity type

- If item N fails, items N+1 … are blocked for same entity

- Different entities can proceed independently

- This prevents out-of-order delivery for single entity
````

---

#### Edit 2.4: Add ID Generation Specification

**Location:** Section 2.4 (ID Generation)

**Current:**
```markdown
Entity IDs follow a consistent pattern:

{prefix}-{hash}

- **Prefix**: 2-3 lowercase letters derived from directory name
- **Hash**: Lowercase alphanumeric, typically 4-8 characters
````

**Expand to:**
````markdown
Entity IDs follow a consistent pattern:

{prefix}-{hash}

- **Prefix**: 2 lowercase letters matching directory name (`is-`, `ag-`, `lo-`, `ms-`)
- **Hash**: 6 lowercase alphanumeric characters (base36)

#### ID Generation Algorithm

```typescript
import { randomBytes } from 'crypto';

function generateId(prefix: string): string {
  // 6 bytes = 48 bits of entropy ≈ 281 trillion possibilities
  const bytes = randomBytes(6);
  const hash = bytes.toString('base36').toLowerCase().slice(0, 6);
  return `${prefix}${hash}`;
}
````

**Properties:**

- **Cryptographically random**: No timestamp or content dependency

- **Collision probability**: ~1 in 2 billion per prefix at 50,000 entities

- **On collision**: Regenerate ID (detected by file-exists check on write)

**ID validation regex:**
```typescript
const EntityId = z.string().regex(/^[a-z]{2}-[a-z0-9]{6}$/);
```
````

---

#### Edit 2.5: Add Schema Migration Strategy

**Location:** Add new Section 2.6 after Section 2.5 (Schemas)

**Add:**
```markdown
### 2.6 Schema Versioning and Migration

#### Version Tracking

Schema versions are tracked in `.ceads-sync/meta.json` (on the sync branch):

```json
{
  "schema_versions": [
    { "collection": "issues", "version": 1 },
    { "collection": "agents", "version": 1 }
  ],
  "created_at": "2025-01-07T08:00:00Z",
  "last_sync": "2025-01-07T14:30:00Z"
}
````

> **Note:** User-editable configuration (prefixes, TTLs) lives in `.ceads/config.yml` on
> the main branch. Schema versions live in `meta.json` on the sync branch because they
> describe the synced data and must propagate with it.

#### Compatibility Requirements

**Forward compatibility (required):**

- Newer CLI versions MUST read older entity versions

- Unknown fields MUST be preserved on read/write (pass-through)

- Missing fields MUST use schema defaults

**Backward compatibility (best effort):**

- Older CLI versions reading newer entities: unknown fields ignored

- Core fields (`id`, `version`, `type`) never change shape

- Breaking changes require explicit migration

#### Migration Execution

**Automatic (non-breaking):**

- New optional fields: added with defaults on write

- Field renames: handled in code, both names accepted on read

**Manual (breaking):**
```bash
# Check if migration needed
cead doctor --check-schema

# Run migration
cead migrate --to 2

# What it does:
# 1. Backs up all entities to .ceads-sync/attic/migrations/
# 2. Transforms each entity to new schema
# 3. Updates .ceads-sync/meta.json schema_versions
# 4. Syncs to propagate changes
```

#### Cross-Version Sync

When Agent A (schema v2) syncs with Agent B (schema v1):

1. A’s entities written in v2 format

2. B reads v2 entities, unknown fields preserved

3. B writes entities (preserving unknown v2 fields)

4. A reads B’s changes, sees preserved v2 fields

5. No data loss; both continue operating

**Warning:** If v2 has breaking changes, B may fail to parse.
CLI should warn: “Remote entities require CLI version >= X.Y.Z”
````

---

#### Edit 2.6: Add Webhook Security

**Location:** Section 5.2 (Bridge Architecture), add security subsection

**Add after Bridge Configuration:**
```markdown
#### Bridge Security

**Webhook Validation (required):**

All bridge webhooks MUST validate request authenticity:

```typescript
// GitHub webhook validation
function validateGitHubWebhook(
  payload: string,
  signature: string,  // X-Hub-Signature-256 header
  secret: string
): boolean {
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Slack request validation
function validateSlackRequest(
  timestamp: string,  // X-Slack-Request-Timestamp
  body: string,
  signature: string,  // X-Slack-Signature
  secret: string
): boolean {
  // Reject if timestamp > 5 minutes old (replay attack)
  if (Math.abs(Date.now()/1000 - Number(timestamp)) > 300) {
    return false;
  }
  const baseString = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto
    .createHmac('sha256', secret)
    .update(baseString)
    .digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
````

**Secret Management:**

- Store secrets in environment variables, never in config files

- Support secret rotation without downtime

- Log validation failures (without exposing secrets)

**Rate Limiting:**

- Limit webhook endpoints: 100 requests/minute per source IP

- Return 429 when exceeded

- Log rate limit violations
```

---

### Phase 3: Verification Checklist

After making all edits, verify:

- [ ] **HLC fields** added to all example JSON files in Section 7.5 (`.ceads-sync/nodes/` examples)
- [ ] **Claim field** added to example Issue JSON (`.ceads-sync/nodes/issues/`)
- [ ] **Idempotency key** shown in outbound queue example (`.ceads/local/cache/outbound/`)
- [ ] **Schema version** examples updated to show v1 baseline
- [ ] **Config vs Meta separation** clear in examples:
  - `.ceads/config.yml` on main: prefixes, TTLs, sync settings
  - `.ceads-sync/meta.json` on sync branch: schema_versions, last_sync
- [ ] **Table of Contents** updated if new sections added
- [ ] **Cross-references** updated (any "see Section X" references)

---

## References

- [Hybrid Logical Clocks (Kulkarni et al.)](https://cse.buffalo.edu/tech-reports/2014-04.pdf)
- [CRDTs: Conflict-free Replicated Data Types](https://crdt.tech/)
- [Erta: Building Consistent Transactions with Inconsistent Replication](https://www.usenix.org/conference/osdi16/technical-sessions/presentation/li)
- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Slack Request Verification](https://api.slack.com/authentication/verifying-requests-from-slack)
- Design doc references in Appendix 7.6
```
