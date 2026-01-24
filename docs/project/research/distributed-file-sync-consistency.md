# Distributed File Synchronization with Consistency Guarantees

**Author:** Claude (research document)
**Date:** January 2026
**Status:** Research brief

---

## Executive Summary

This document explores the design space for distributed file synchronization systems that need varying levels of consistency guarantees. The core tension is between:

- **Simplicity**: Files as the interface, any tool can read/write
- **Consistency**: Guarantees about what states are observable
- **Performance**: Latency and throughput of operations

We survey existing systems, categorize approaches along a spectrum, and analyze tradeoffs for building a coordination layer where local files are the primary interface.

---

## 1. Key Concepts and Terminology

Before diving into system designs, we need to establish the vocabulary used throughout this document.

### 1.1 Consistency Models

**Consistency** describes what guarantees a system provides about the order and visibility of operations across multiple nodes (machines, processes, agents).

| Model | Meaning | Real-world analogy |
|-------|---------|-------------------|
| **Strong/Linearizable** | All operations appear to happen in a single, global order. Every read sees the most recent write. | A whiteboard in a room - everyone sees the same thing |
| **Sequential** | All operations happen in some consistent order, but different observers may be "behind" | A news ticker - everyone sees same order, some delayed |
| **Causal** | Operations that are causally related are seen in order; concurrent operations may be seen in any order | Email threads - replies come after originals |
| **Eventual** | All replicas will converge to the same state eventually, but may temporarily disagree | Gossip spreading through a crowd |

### 1.2 Concurrency Control

When multiple agents try to modify the same data simultaneously, we need strategies to handle this.

**Optimistic Concurrency Control (OCC)**
- Assume conflicts are rare
- Allow operations to proceed without locks
- Detect conflicts at commit time
- Retry or abort on conflict

```
Agent A: Read value (version 1) → Modify → Write (if still version 1)
Agent B: Read value (version 1) → Modify → Write (if still version 1)

If A writes first: A succeeds (now version 2), B fails (version mismatch)
B must re-read and retry
```

**Pessimistic Concurrency Control**
- Assume conflicts are common
- Acquire lock before modifying
- Hold lock during operation
- Release lock when done

```
Agent A: Acquire lock → Read → Modify → Write → Release lock
Agent B: Try to acquire lock → Blocked until A releases → Then proceed
```

### 1.3 Compare-and-Swap (CAS)

CAS is an atomic operation that updates a value only if it matches an expected value. It's the building block of optimistic concurrency.

```
CAS(location, expected_value, new_value):
  if location == expected_value:
    location = new_value
    return SUCCESS
  else:
    return FAILURE (current value is different)
```

**In practice:**
```typescript
// Claiming an issue with CAS
const currentOwner = await read('claims/issue-123');
if (currentOwner === null) {
  const success = await cas('claims/issue-123', null, myAgentId);
  if (success) {
    // I claimed it
  } else {
    // Someone else claimed it between my read and write
  }
}
```

### 1.4 Last-Write-Wins (LWW)

The simplest conflict resolution strategy: whichever write has the latest timestamp wins.

```
Timeline:
  t=1: Agent A writes "foo"
  t=2: Agent B writes "bar"
  t=3: Sync happens
  Result: value is "bar" (later timestamp wins)
```

**Pros:** Simple, always converges, no conflicts to resolve
**Cons:** Data loss (A's write is silently discarded)

### 1.5 Version Vectors / Vector Clocks

A way to track causality in distributed systems. Each node maintains a vector of counters.

```
Agent A's vector: { A: 3, B: 2 }  (A has done 3 ops, seen B's first 2)
Agent B's vector: { A: 2, B: 4 }  (B has done 4 ops, seen A's first 2)

These vectors are concurrent (neither dominates) → potential conflict
```

### 1.6 Conflict Resolution

When two agents modify the same data before syncing, we have a conflict. Strategies:

| Strategy | Description |
|----------|-------------|
| **LWW** | Later timestamp wins, other discarded |
| **First-Write-Wins** | Earlier write wins (via CAS) |
| **Merge** | Combine both values (requires domain knowledge) |
| **Conflict file** | Keep both, let human resolve |
| **CRDT** | Data structure designed to auto-merge |

### 1.7 CAP Theorem

A distributed system can provide at most two of these three guarantees:

- **Consistency**: All nodes see the same data at the same time
- **Availability**: Every request receives a response
- **Partition tolerance**: System continues operating despite network failures

Since network partitions happen in reality, we're typically choosing between **CP** (consistent but may be unavailable during partition) or **AP** (available but may be inconsistent during partition).

### 1.8 Write-Ahead Log (WAL)

A pattern where all changes are first written to an append-only log, then applied to the main data store. Provides:

- **Durability**: Log survives crashes
- **Ordering**: Log defines canonical order of operations
- **Recovery**: Replay log to rebuild state

```
1. Write to log: "Set claims/issue-123 to agent-abc"
2. Acknowledge to client
3. Apply to data store (can happen async)
```

### 1.9 Event Sourcing

An architectural pattern where:
- State is never stored directly
- Only **events** (immutable facts) are stored
- Current state is derived by replaying events

```
Events:
  [1] IssueCreated { id: 123, title: "Bug" }
  [2] IssueClaimed { id: 123, agent: "abc" }
  [3] ClaimReleased { id: 123 }
  [4] IssueClaimed { id: 123, agent: "def" }

Current state: Issue 123 is claimed by "def"
(Derived by replaying events in order)
```

### 1.10 CRDT (Conflict-free Replicated Data Type)

Data structures mathematically designed to merge without conflicts:

| CRDT Type | Use Case | Merge Rule |
|-----------|----------|------------|
| G-Counter | Increment-only counter | Sum of all node counters |
| LWW-Register | Single value | Latest timestamp wins |
| OR-Set | Add/remove from set | Adds beat removes on tie |
| RGA | Text/array | Interleave by timestamp |

---

## 2. The Problem Space

### 2.1 What We Want

A system where:
1. **Multiple agents** (processes, machines) collaborate on shared state
2. **Local files** are the primary interface (read YAML/JSON directly)
3. **Changes propagate** to other agents automatically
4. **Consistency guarantees** are appropriate to the use case

### 2.2 The Fundamental Tensions

```
                    CONSISTENCY
                         ▲
                         │
        Spanner ●        │        ● Serializable DBs
                         │
                         │
          etcd ●         │
                         │
    Firebase ●           │         ● CouchDB
                         │
                         │
   Syncthing ●           │
                         │
     Dropbox ●───────────┼─────────────────────► SIMPLICITY
                         │
                         │
         S3 ●            │
                         │
                         ▼
                    PERFORMANCE
```

### 2.3 Why This Is Hard

For a distributed file sync system, we generally need partition tolerance (agents go offline), so we're choosing between consistency and availability. Most systems choose availability (eventual consistency) for better user experience.

---

## 3. How Existing Systems Approach This

### 3.1 File Sync Systems (Eventual Consistency, Maximum Simplicity)

#### Dropbox
- **Model**: File-level sync, last-write-wins
- **Conflicts**: Creates "conflicted copy" files for manual resolution
- **Consistency**: Eventual, no ordering guarantees
- **Cross-file**: None - each file synced independently

```
Agent A writes foo.txt at t=1 ─┐
                               ├→ Both sync → Conflict detected
Agent B writes foo.txt at t=2 ─┘     └→ Creates "foo (conflicted copy).txt"
```

#### Syncthing
- **Model**: File-level sync with vector clocks
- **Conflicts**: `.sync-conflict-*` files created
- **Consistency**: Eventual with causality tracking
- **Cross-file**: None

**Lesson**: Simple, works well, but conflicts require manual intervention and no guarantees across multiple files.

---

### 3.2 Document Databases (Eventual Consistency, Structured)

#### CouchDB / PouchDB
- **Model**: Document-level with revisions (optimistic concurrency)
- **Conflicts**: Tracked in document, application resolves
- **Consistency**: Eventual with conflict detection
- **Cross-file**: None (document = unit of consistency)

```javascript
// Every document has _rev (revision)
{ "_id": "issue-123", "_rev": "2-abc123", "title": "Fix bug" }

// Update requires current _rev (CAS pattern)
db.put({ "_id": "issue-123", "_rev": "2-abc123", "title": "Fixed!" });
// Fails if _rev doesn't match (someone else updated first)
// Returns conflict - application decides what to do
```

**Key insight**: Revision-based CAS at document level catches conflicts without requiring strong consistency. The database tells you about conflicts; you decide how to resolve them.

#### MongoDB
- **Model**: Document-level atomicity
- **Conflicts**: Last-write-wins (no built-in detection)
- **Consistency**: Tunable (from eventual to linearizable per-operation)
- **Cross-file**: Multi-document transactions available (with performance cost)

**Lesson**: Document-level atomicity + CAS is often sufficient. Cross-document transactions add significant complexity.

---

### 3.3 Coordination Services (Strong Consistency, Specialized)

#### etcd / ZooKeeper / Consul

These systems sacrifice some availability for strong consistency, using consensus protocols (Raft, Paxos) to ensure all nodes agree.

- **Model**: Key-value with strong consistency
- **Conflicts**: Prevented by consensus (only one write succeeds)
- **Consistency**: Linearizable
- **Cross-file**: Transactions (etcd), watch-based coordination (ZooKeeper)

```go
// etcd transaction: atomic conditional update
txn := client.Txn(ctx).
    If(clientv3.Compare(clientv3.Version("claim/issue-123"), "=", 0)).
    Then(clientv3.OpPut("claim/issue-123", agentId)).
    Else(clientv3.OpGet("claim/issue-123"))
// Atomically: if key doesn't exist, create it; otherwise get current value
```

**Lesson**: Strong consistency is achievable but requires consensus protocol (higher latency, more complex operations). Best for coordination data, overkill for general storage.

---

### 3.4 Real-time Databases (Tunable Consistency, Developer-Friendly)

#### Firebase Realtime Database / Firestore

These systems offer a pragmatic hybrid: simple operations are eventually consistent, but transactions are available for critical paths.

- **Model**: JSON tree with real-time sync
- **Conflicts**: Last-write-wins by default, transactions available
- **Consistency**: Eventual for reads, strong for transactions
- **Cross-file**: Multi-path transactions

```javascript
// Simple write - eventually consistent, LWW
db.ref('issues/123/status').set('in_progress');

// Transaction - strongly consistent, CAS semantics
db.ref('claims/123').transaction(currentValue => {
  if (currentValue === null) {
    // Not claimed, claim it
    return { agent: 'agent-abc', timestamp: Date.now() };
  }
  // Already claimed, abort transaction
  return undefined;
});
// Transaction retries automatically if concurrent modification detected
```

**Key insight**: Two-tier model - simple writes for most operations, transactions for critical ones. This is a pragmatic middle ground.

---

### 3.5 Event Sourcing / CQRS

#### Datomic / EventStore

These systems store events (facts), not state. Current state is derived.

- **Model**: Append-only log of immutable events
- **Conflicts**: Ordering determined by log position (no conflicts in log)
- **Consistency**: Strong at log level, derived state is eventually consistent
- **Cross-file**: Transactions are atomic event batches

```
Event Log (immutable, ordered):
  [seq=1] IssueCreated { id: 123, title: "Bug" }
  [seq=2] IssueClaimed { id: 123, agent: "abc" }
  [seq=3] StatusChanged { id: 123, status: "in_progress" }

Current State (derived by replay):
  Issue 123: { title: "Bug", agent: "abc", status: "in_progress" }
```

**Lesson**: If you need perfect ordering and complete audit trail, use a log. State becomes a "materialized view" that can be rebuilt anytime.

---

### 3.6 CRDTs (Conflict-Free by Design)

#### Automerge / Yjs

These systems use data structures mathematically designed to merge without conflicts.

- **Model**: Data structures that automatically merge
- **Conflicts**: Mathematically impossible (by design)
- **Consistency**: Strong eventual consistency (all replicas converge to same state)
- **Cross-file**: Depends on CRDT scope

```javascript
// Automerge example - concurrent edits merge automatically
// Agent A:
doc.title = "Fix bug"

// Agent B (concurrently):
doc.title = "Fix typo"

// After sync, one wins (by timestamp), but no data corruption
// Both agents end up with same value
```

**Common CRDTs:**
- **G-Counter**: Increment-only counter (each node tracks own count, sum for total)
- **LWW-Register**: Single value with timestamp (latest wins)
- **OR-Set**: Observed-remove set (add/remove, adds win on concurrent add+remove)
- **RGA**: Replicated growable array (for collaborative text editing)

**Lesson**: If you can model your data as CRDTs, conflicts disappear. But not everything maps naturally to CRDTs, and they can be complex to implement.

---

### 3.7 NATS JetStream

NATS provides building blocks for distributed systems:

#### Key-Value Store
- **Model**: Key-value with revisions
- **Conflicts**: CAS via revision numbers
- **Consistency**: Monotonic reads (with caveats - reads from replicas may lag)
- **Cross-file**: None

```go
// Create fails if key exists - perfect for claims
kv.Create("claims/issue-123", claimData)  // Returns error if key exists

// Update requires revision - CAS semantics
entry, _ := kv.Get("claims/issue-123")
kv.Update("claims/issue-123", newData, entry.Revision)  // Fails if revision changed
```

#### Streams
- **Model**: Append-only ordered log
- **Conflicts**: None (append-only, ordering by sequence)
- **Consistency**: Ordered within stream

**Lesson**: NATS KV provides CAS for coordination, Streams provide ordering. These are building blocks, not a complete solution.

---

### 3.8 Git

- **Model**: Snapshot-based with three-way merge
- **Conflicts**: Detected on merge, require manual resolution (or automated merge drivers)
- **Consistency**: Eventual (push/pull model)
- **Cross-file**: Commit is atomic across all files

```
        base (common ancestor)
       /                      \
   local                    remote
   (your changes)           (their changes)
       \                      /
        merge commit
        (may have conflicts)
```

**Lesson**: Works well for async collaboration on structured content. Conflicts are explicitly surfaced. TBD already uses this model for durable data.

---

## 4. The Spectrum of Approaches

### 4.1 Overview

From least structured to most structured:

```
UNSTRUCTURED                                              STRUCTURED
SIMPLE                                                    COMPLEX
     │                                                         │
     ▼                                                         ▼
┌─────────┬──────────┬──────────┬──────────┬──────────┬───────────┐
│ Pure    │ File +   │ File +   │ Schema + │ Schema + │ Full      │
│ File    │ Conflict │ CAS for  │ Writes   │ Write    │ Event     │
│ Sync    │ Files    │ Critical │ via API  │ Ahead    │ Sourcing  │
│         │          │ Ops      │ Reads    │ Log      │           │
│         │          │          │ Direct   │          │           │
└─────────┴──────────┴──────────┴──────────┴──────────┴───────────┘
     │         │          │          │          │           │
 Dropbox  Syncthing  Firebase   Firestore   Datomic    Full CQRS
                       (hybrid)  (hybrid)
```

---

### 4.2 Approach 1: Pure File Sync (Dropbox-style)

**How it works:**
- Files are atomically written locally
- Daemon syncs files to remote storage/other nodes
- Last-write-wins on conflict (or conflict files created)
- No schema awareness, no cross-file consistency

**Implementation:**
```
Agent writes .tbd/ephemeral/claims/issue-123/owner.yml
  ↓
Daemon detects file change (via inotify/FSEvents)
  ↓
Daemon syncs to NATS/S3/other agents
  ↓
Remote agents receive file, write locally
```

**Pros:**
- Dead simple - any tool can read/write files
- No API layer required
- Easy to debug (just look at files)
- Works offline
- Maximum interoperability

**Cons:**
- No consistency guarantees
- Duplicate claims possible (both agents think they succeeded)
- Orphan references (claim references deleted issue)
- Conflicts require manual intervention or data loss (LWW)

**Best for:**
- Low-stakes data (heartbeats, status updates)
- Human-in-the-loop conflict resolution
- Simple deployments where agents rarely conflict

---

### 4.3 Approach 2: File Sync + Conflict Detection (Syncthing-style)

**How it works:**
- Files have version vectors or revision numbers embedded
- Concurrent modifications detected on sync
- Conflict files created for resolution (no silent data loss)

**Implementation:**
```yaml
# Each file includes metadata for conflict detection
_meta:
  revision: 3
  modified_by: agent-abc
  modified_at: 2026-01-20T10:30:00Z
  vector_clock: { agent-a: 2, agent-b: 1 }

agent_id: agent-abc
claimed_at: 2026-01-20T10:30:00Z
```

```
On sync, if vectors are concurrent (neither dominates):
  owner.yml           ← winner (arbitrary choice or LWW)
  owner.yml.conflict-agent-b-20260120T103000Z  ← loser preserved
```

**Pros:**
- Conflicts are visible (not silently lost)
- Still simple file interface
- Can implement application-level resolution
- Audit trail of conflicts

**Cons:**
- Still no prevention of invalid states (both can claim, conflict detected later)
- Conflict files accumulate, need cleanup
- Application must handle resolution logic

**Best for:**
- When conflicts are rare but important to catch
- When application can merge conflicts programmatically
- When silent data loss is unacceptable

---

### 4.4 Approach 3: File Sync + CAS for Critical Operations (Firebase-style)

**How it works:**
- Most operations: direct file writes (eventually consistent, LWW)
- Critical operations: go through CAS or transaction API
- Hybrid of simplicity and safety

**Implementation:**
```typescript
// Non-critical: direct file write (daemon syncs)
await writeFile('.tbd/ephemeral/agents/agent-abc.yml', {
  status: 'ready',
  last_heartbeat: new Date().toISOString(),
});

// Critical: CAS operation via NATS KV
async function claimIssue(issueId: string, agentId: string): Promise<ClaimResult> {
  try {
    // NATS KV create() fails atomically if key exists
    await kv.create(`claims/${issueId}/owner`, encode({
      agent_id: agentId,
      claimed_at: Date.now(),
    }));

    // Success - also write local file for consistency
    await writeFile(`.tbd/ephemeral/claims/${issueId}/owner.yml`, {
      agent_id: agentId,
      claimed_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (e) {
    if (e.code === 'KEY_EXISTS') {
      // Someone else claimed it first
      const existing = await kv.get(`claims/${issueId}/owner`);
      return {
        success: false,
        reason: 'already_claimed',
        holder: decode(existing.value).agent_id,
      };
    }
    throw e;
  }
}
```

**Pros:**
- Simple file interface for 90% of operations
- Strong guarantees where they matter (claims)
- File interface preserved for reads
- Graceful degradation (CAS fails = clear signal to retry or give up)
- Can mix-and-match per operation type

**Cons:**
- Two code paths (direct write vs API)
- Must correctly classify operations (which need CAS?)
- CAS failures need handling (retry logic, user feedback)
- Critical operations require network (no offline claiming)

**Best for:**
- When specific operations need guarantees (claims, assignments, locks)
- When most operations are non-critical
- When you can tolerate "try and see if it worked" semantics for critical ops

---

### 4.5 Approach 4: Schema-Validated Writes via API, Direct File Reads

**How it works:**
- All writes go through an API that validates against schema
- API ensures structural integrity (no orphan references, valid field values)
- API may enforce business rules (only one working claim per issue)
- Files are written by API, readable directly by any tool
- Sync daemon replicates the validated files

**Implementation:**
```typescript
// Schema definition (e.g., using Zod)
const ClaimSchema = z.object({
  type: z.literal('claim'),
  issue_id: z.string().regex(/^is-[a-z0-9]{26}$/),
  agent_id: z.string().regex(/^ag-[a-z0-9]{26}$/),
  claimed_at: z.string().datetime(),
  claim_type: z.enum(['working', 'reviewing', 'watching']),
});

// Write API validates and enforces invariants
async function createClaim(claim: ClaimInput): Promise<Claim> {
  // 1. Validate schema
  const validated = ClaimSchema.parse(claim);

  // 2. Check referential integrity
  const issue = await loadIssue(validated.issue_id);
  if (!issue) {
    throw new Error(`Issue ${validated.issue_id} does not exist`);
  }

  // 3. Check uniqueness constraint (business rule)
  const existingClaim = await getWorkingClaim(validated.issue_id);
  if (existingClaim && validated.claim_type === 'working') {
    throw new Error(`Issue already has working claim by ${existingClaim.agent_id}`);
  }

  // 4. Generate ID if needed
  const claimWithId = { ...validated, id: generateClaimId() };

  // 5. Write file atomically
  await atomicWrite(
    `.tbd/ephemeral/claims/${validated.issue_id}/owner.yml`,
    yaml.stringify(claimWithId)
  );

  // 6. Return created claim (daemon will sync)
  return claimWithId;
}

// Reads are direct - any tool works
function readClaim(issueId: string): Claim | null {
  const path = `.tbd/ephemeral/claims/${issueId}/owner.yml`;
  if (!existsSync(path)) return null;
  return yaml.parse(readFileSync(path, 'utf8'));
}
```

**Pros:**
- Structural integrity guaranteed (schema validation, referential integrity)
- Business rules enforced centrally
- Direct file reads for simplicity, debugging, interoperability
- Schema evolution controlled (API is the gatekeeper)
- Works with any file-reading tool (grep, cat, editor)

**Cons:**
- All writes must use API (agents can't just write files directly)
- API must be available for writes (library or service)
- Distributed writes still need coordination (API on different machines may race)
- More code to maintain

**Best for:**
- When referential integrity is important (claims must reference existing issues)
- When schema validation is important (prevent malformed data)
- When reads are much more common than writes
- When you want a clear "write contract" but flexible reads

---

### 4.6 Approach 5: Write-Ahead Log with Local Materialization

**How it works:**
- All operations first logged to an ordered, distributed stream (the WAL)
- Local files are "materialized views" - derived from the log
- Log determines canonical order of all operations
- Conflicts resolved at log level (before materialization)
- Can replay log to rebuild state

**Implementation:**
```typescript
// Operation structure
interface Operation {
  txn_id: string;           // Unique transaction ID
  timestamp: number;        // Logical or physical timestamp
  operations: {
    op: 'create' | 'update' | 'delete';
    path: string;           // File path
    content?: any;          // For create/update
    preconditions?: {       // Optional: operation only applies if these hold
      path: string;
      condition: 'exists' | 'not_exists' | 'revision_equals';
      value?: any;
    }[];
  }[];
}

// Writing goes through the log
async function claimIssue(issueId: string, agentId: string) {
  const operation: Operation = {
    txn_id: generateTxnId(),
    timestamp: Date.now(),
    operations: [{
      op: 'create',
      path: `claims/${issueId}/owner.yml`,
      content: { agent_id: agentId, claimed_at: new Date().toISOString() },
      preconditions: [{
        path: `claims/${issueId}/owner.yml`,
        condition: 'not_exists',  // Only create if doesn't exist
      }],
    }],
  };

  // Publish to ordered stream
  await stream.publish('tbd.operations', encode(operation));
  // Returns when acknowledged by stream (durable)
}

// All nodes consume the stream and apply operations
stream.subscribe('tbd.operations', async (msg) => {
  const op = decode(msg.data) as Operation;

  // Check preconditions
  for (const pre of op.operations.flatMap(o => o.preconditions ?? [])) {
    if (!checkPrecondition(pre)) {
      // Precondition failed - log the conflict, skip this operation
      await logConflict(op, 'precondition_failed', pre);
      return;
    }
  }

  // Apply to local files
  for (const o of op.operations) {
    switch (o.op) {
      case 'create':
      case 'update':
        await atomicWrite(`.tbd/ephemeral/${o.path}`, yaml.stringify(o.content));
        break;
      case 'delete':
        await unlink(`.tbd/ephemeral/${o.path}`);
        break;
    }
  }
});
```

**Pros:**
- Strong ordering guarantees (log is canonical order)
- Perfect audit trail (log is complete history)
- Can support multi-file transactions (atomic operations across files)
- Conflict detection is explicit (preconditions checked)
- State is rebuildable from log (disaster recovery, debugging)
- Natural fit for replication (just replay the log)

**Cons:**
- Every write has log latency (must go through stream)
- Log is single point of ordering (potential bottleneck, though can partition)
- More complex than file sync
- Agents can't bypass the log for writes
- Log grows forever (need compaction/snapshotting strategy)
- Reads may lag writes (eventual consistency for materialized views)

**Best for:**
- When ordering is critical
- When audit trail is required (compliance, debugging)
- When multi-file transactions are needed
- When you need "time travel" (what was the state at time T?)

---

### 4.7 Approach 6: Full Event Sourcing / CQRS

**How it works:**
- State is never stored directly - only events (immutable facts) are stored
- Current state is computed by replaying all events from the beginning
- Commands (requests to change state) are validated and produce events
- Queries read from projections (materialized views optimized for reading)
- Separation between write model (commands/events) and read model (projections)

**Implementation:**
```typescript
// Commands represent intent (may be rejected)
interface ClaimIssueCommand {
  type: 'ClaimIssue';
  issue_id: string;
  agent_id: string;
  timestamp: number;
}

// Events represent facts (always valid, immutable)
interface IssueClaimedEvent {
  type: 'IssueClaimed';
  issue_id: string;
  agent_id: string;
  claimed_at: number;
  sequence: number;  // Position in event log
}

// Command handler: validates command, emits events
async function handleClaimIssue(cmd: ClaimIssueCommand): Promise<void> {
  // Rebuild current state from events
  const events = await eventStore.getEvents(`issue-${cmd.issue_id}`);
  const state = events.reduce(applyEvent, initialState);

  // Validate command against current state
  if (!state.issueExists) {
    throw new Error('Issue does not exist');
  }
  if (state.currentClaim !== null) {
    throw new Error(`Already claimed by ${state.currentClaim.agent_id}`);
  }

  // Emit event (this is the source of truth)
  await eventStore.append(`issue-${cmd.issue_id}`, {
    type: 'IssueClaimed',
    issue_id: cmd.issue_id,
    agent_id: cmd.agent_id,
    claimed_at: cmd.timestamp,
  });
}

// Projection: builds local files from events (for reading)
class ClaimsProjection {
  async onEvent(event: Event) {
    switch (event.type) {
      case 'IssueClaimed':
        await writeFile(
          `.tbd/ephemeral/claims/${event.issue_id}/owner.yml`,
          yaml.stringify({
            agent_id: event.agent_id,
            claimed_at: new Date(event.claimed_at).toISOString(),
          })
        );
        break;
      case 'ClaimReleased':
        await unlink(`.tbd/ephemeral/claims/${event.issue_id}/owner.yml`);
        break;
    }
  }
}

// Reducer: applies events to build state
function applyEvent(state: IssueState, event: Event): IssueState {
  switch (event.type) {
    case 'IssueCreated':
      return { ...state, issueExists: true, title: event.title };
    case 'IssueClaimed':
      return { ...state, currentClaim: { agent_id: event.agent_id } };
    case 'ClaimReleased':
      return { ...state, currentClaim: null };
    default:
      return state;
  }
}
```

**Pros:**
- Perfect consistency (events are the canonical source of truth)
- Complete audit trail (every change is an event, forever)
- Time travel (rebuild state at any historical point)
- Natural fit for distributed systems (replicate the event log)
- Scales well (projections can be built in parallel, per-query optimized)
- Debugging: can replay events to reproduce bugs
- Testing: can test with specific event sequences

**Cons:**
- Significant complexity (commands, events, projections, reducers)
- Events are forever (storage grows, need archival strategy)
- Eventual consistency for projections (read after write may not see update)
- Requires careful event schema design (events are immutable, must version)
- Rebuilding projections can be slow (need snapshots for large event streams)
- Overkill for simple use cases

**Best for:**
- Complex domains with many invariants and business rules
- When audit/compliance is critical (financial, healthcare)
- When you need to answer "what happened when?" questions
- High-scale systems with many different read patterns (different projections)
- When business logic is complex and benefits from explicit state machines

---

## 5. Comparison Matrix

| Approach | Consistency | Simplicity | Performance | Offline | Auditability | Best For |
|----------|-------------|------------|-------------|---------|--------------|----------|
| Pure File Sync | Eventual | ★★★★★ | ★★★★★ | ★★★★★ | ★☆☆☆☆ | Low-stakes, simple |
| File + Conflict Detection | Eventual+ | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★☆☆☆ | Conflict-aware |
| File + CAS for Critical | Hybrid | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | Mixed workloads |
| Schema API + Direct Reads | Strong-ish | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | Structured data |
| Write-Ahead Log | Strong | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | Ordered, auditable |
| Full Event Sourcing | Strong | ★☆☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★★★ | Complex domains |

---

## 6. Decision Framework

### 6.1 Choose Pure File Sync When:
- Conflicts are rare and acceptable to lose (or resolve manually)
- Simplicity is paramount
- Offline-first is critical
- Humans can resolve conflicts when they occur
- Data is not critical (can be regenerated)

### 6.2 Choose File + CAS When:
- Most operations are non-critical (can use simple sync)
- Specific operations need guarantees (claims, locks, assignments)
- Want to preserve file simplicity for reads
- Can tolerate failed operations (have retry logic)
- Have a reliable coordination backend (NATS, Redis, etc.)

### 6.3 Choose Schema API When:
- Referential integrity is important (foreign key-like relationships)
- Schema validation is required (prevent malformed data)
- Writes are relatively infrequent compared to reads
- Direct file reads are valuable (debugging, interop)
- Have clear ownership of what can write

### 6.4 Choose WAL/Event Sourcing When:
- Ordering is critical (must know what happened first)
- Audit trail is required (compliance, debugging)
- Multi-entity transactions are needed
- Willing to accept complexity for guarantees
- Have the engineering capacity to maintain it

---

## 7. Hybrid Architectures

### 7.1 Tiered Consistency

Use different consistency levels for different data based on its characteristics:

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Git-durable (strong, async)                        │
│  Issues, mappings, settled state                            │
│  Consistency: Three-way merge on conflict                   │
│  Latency: Seconds to minutes                                │
├─────────────────────────────────────────────────────────────┤
│  TIER 2a: Ephemeral-critical (CAS)                          │
│  Claims, assignments, locks                                 │
│  Consistency: CAS via NATS KV create/update                 │
│  Latency: Milliseconds                                      │
├─────────────────────────────────────────────────────────────┤
│  TIER 2b: Ephemeral-casual (LWW)                            │
│  Heartbeats, status overlays, presence                      │
│  Consistency: Last-write-wins, no guarantees                │
│  Latency: Milliseconds                                      │
├─────────────────────────────────────────────────────────────┤
│  TIER 3: Blobs (content-addressed)                          │
│  Transcripts, attachments, large payloads                   │
│  Consistency: Immutable (no conflicts possible)             │
│  Latency: Depends on size                                   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 The Firebase Model Applied

Path-based configuration determines behavior:

```typescript
const syncConfig = {
  tiers: [
    {
      pattern: '.tbd/data-sync/**',
      consistency: 'git-merge',
      backend: 'git',
      description: 'Durable data with field-level merge',
    },
    {
      pattern: '.tbd/ephemeral/claims/**',
      consistency: 'cas',
      backend: 'nats-kv',
      operations: {
        create: 'fails-if-exists',    // Atomic claim
        update: 'requires-revision',  // CAS update
        delete: 'always-succeeds',    // Release always works
      },
      description: 'Critical coordination with CAS',
    },
    {
      pattern: '.tbd/ephemeral/agents/**',
      consistency: 'lww',
      backend: 'nats-kv',
      ttl: 30_000,  // Auto-expire after 30s
      description: 'Agent presence with TTL',
    },
    {
      pattern: '.tbd/ephemeral/threads/**',
      consistency: 'append-only',
      backend: 'nats-stream',
      retention: { maxAgeDays: 30 },
      description: 'Comments, append-only ordered',
    },
    {
      pattern: '.tbd/blobs/**',
      consistency: 'content-addressed',
      backend: 'nats-object-store',
      description: 'Large files, no conflicts',
    },
  ],
};
```

### 7.3 Read vs Write Path Separation

A pragmatic approach: structured writes, simple reads.

```
WRITE PATH (structured, validated)        READ PATH (simple, direct)

Agent calls API                           Agent reads file directly
    │                                         │
    ▼                                         ▼
Validate schema                           Parse YAML/JSON
    │                                         │
    ▼                                     (done - no API needed)
Check referential integrity
    │
    ▼
CAS / Transaction (if needed)
    │
    ▼
Write file atomically ◄───────────────────────┘
    │                     (same file)
    ▼
Sync daemon propagates to other nodes
```

**Key insight**: Writes go through API for safety and validation, but files remain the source of truth for reads. This gives you validation without sacrificing debuggability or interoperability.

---

## 8. Implementation Considerations

### 8.1 Conflict Resolution Strategies

| Strategy | When to Use | How to Implement |
|----------|-------------|------------------|
| **Last-Write-Wins** | Low stakes, high frequency | Compare timestamps, keep latest |
| **First-Write-Wins** | Claims, locks, reservations | CAS create (fails if exists) |
| **Field-Level Merge** | Structured records with independent fields | Merge each field separately |
| **Conflict File** | Human judgment needed | Keep both, flag for review |
| **Application Callback** | Domain-specific rules | Invoke merge function |
| **CRDT** | Known data structures | Use CRDT library |

### 8.2 Offline Support Patterns

| Pattern | Description | Tradeoff |
|---------|-------------|----------|
| **Queue and Replay** | Store operations locally, replay when online | May fail on replay (conflicts) |
| **Optimistic UI** | Assume success, reconcile later | May need to rollback |
| **Conflict Buffer** | Accumulate conflicts, resolve on reconnect | User sees conflicts later |
| **Degraded Mode** | Allow reads, block critical writes | Limited functionality offline |
| **Local-First** | Full functionality offline, sync when possible | Complex conflict resolution |

### 8.3 Schema Evolution

How to handle changes to data structure over time:

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| **Additive Only** | Only add optional fields, never remove | Simple, safe, limited |
| **Version Field** | Explicit version, migrate on read | Clear, requires migration code |
| **Event Versioning** | Version events, upcast on read | For event sourcing |
| **Projection Rebuild** | Rebuild from events with new schema | If you have event log |

---

## 9. Recommendations for TBD Coordination Layer

Based on this analysis, for a TBD coordination layer:

### 9.1 Recommended Architecture

**Hybrid approach with tiered consistency:**

1. **Git tier** (existing): Full TBD merge logic, async, for durable data
2. **Ephemeral-critical tier**: CAS via NATS KV for claims/locks
3. **Ephemeral-casual tier**: LWW file sync for heartbeats/status
4. **Blob tier**: Content-addressed for large payloads

### 9.2 Implementation Strategy

1. **Sync daemon** handles file watching and replication (mostly domain-agnostic)
2. **TBD library** provides API for critical operations (claims) with CAS
3. **Direct file access** for reads and non-critical writes
4. **Path-based policy** determines sync behavior per directory

### 9.3 Tradeoffs Accepted

- Claims require API call (not pure file write) - necessary for consistency
- Eventual consistency for non-critical data - acceptable for heartbeats
- Offline mode degrades critical operations - can't claim offline
- Complexity of hybrid system - worth it for the guarantees

### 9.4 Tradeoffs Avoided

- No full event sourcing (too complex for this use case)
- No distributed transactions (not needed if we design data model carefully)
- No strong consistency for everything (too slow, not necessary)
- No pure file sync for claims (too risky, duplicate claims unacceptable)

---

## 10. References

### Systems Studied
- Dropbox: https://dropbox.tech/infrastructure
- Syncthing: https://docs.syncthing.net/
- CouchDB: https://docs.couchdb.org/en/stable/replication/
- Firebase: https://firebase.google.com/docs/database/
- etcd: https://etcd.io/docs/
- NATS: https://docs.nats.io/
- Datomic: https://docs.datomic.com/
- Automerge: https://automerge.org/

### Academic Background
- CAP Theorem: Brewer, "Towards Robust Distributed Systems" (2000)
- CRDTs: Shapiro et al., "Conflict-free Replicated Data Types" (2011)
- Vector Clocks: Lamport, "Time, Clocks, and the Ordering of Events" (1978)

### Related Patterns
- Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html
- CQRS: Command Query Responsibility Segregation
- Saga Pattern: Distributed transactions via compensation
- Outbox Pattern: Reliable event publishing
