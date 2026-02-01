# Research Brief: Bead Subscriptions vs Agent Mail

**Last Updated**: 2026-02-01

**Status**: In Progress

**Related**:

- [Distributed File Sync](research-distributed-file-sync.md) - Sync layer design space
- [Agent Coordination Kernel](research-agent-coordination-kernel.md) - Coordination primitives
- [Agent Mail Implementation](../../../attic/agent_mail/) - Reference implementation

---

## Executive Summary

This research analyzes whether **bead subscriptions** (watching for changes on issues, epics, specs) can replace the explicit message-passing model of **Agent Mail**. We also evaluate whether a **file system sync layer** alone is sufficient for agent coordination, or if additional APIs are needed.

**Key findings**:

1. **Bead subscriptions can replace ~70% of Agent Mail use cases** - status updates, comments, handoffs, and notifications all naturally map to file change events on beads.

2. **Explicit messaging is still needed for some use cases** - direct agent-to-agent requests that aren't tied to a specific bead, cross-project communication, and priority interrupts.

3. **File system sync is necessary but not sufficient** - it handles data distribution well, but lacks primitives for addressing, routing, and presence that messaging provides.

4. **Hybrid approach recommended**: Use bead subscriptions as the primary notification mechanism, with a lightweight message layer for targeted communication.

---

## 1. Agent Mail Architecture Review

### 1.1 Core Concepts

Agent Mail (by Jeffrey Emanuel) provides:

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **Project** | Workspace isolation | SQLite + Git sync |
| **Agent** | Identity with policies | Registration with contact/attachment policies |
| **Message** | Agent-to-agent communication | Subject/body/thread with importance levels |
| **FileReservation** | Advisory file locks | TTL-based exclusive/shared reservations |

### 1.2 Key Features

```
Agent Registration
├── Name, program, model
├── Task description
├── Contact policy (open, auto, contacts_only, block_all)
└── Attachments policy

Messaging
├── Explicit sender/recipients
├── Thread-based conversations
├── Importance levels (low, normal, high, urgent)
├── Acknowledgment tracking
└── Markdown body with attachments

File Reservations
├── Path patterns (glob-based)
├── Exclusive/shared modes
├── TTL-based expiration
└── Active vs released tracking
```

### 1.3 Dual Persistence Model

Agent Mail uses **dual persistence** - SQLite for queries, Git for durability:

```python
# From storage.py - commit queue pattern
class CommitQueue:
    """Batches writes to Git, commits on flush"""
    def queue_write(self, path, content): ...
    def flush(self) -> str:  # Returns commit hash
        ...
```

This is similar to our proposed sync layer but with explicit Git integration.

---

## 2. Bead Subscription Model

### 2.1 Conceptual Model

In a bead-centric model, agents **subscribe to beads** rather than receiving messages:

```yaml
# Agent subscribes to changes on specific beads
subscriptions:
  - bead: is-2025-0042
    events: [status, comments, assignees]
  - bead: ep-2025-0003  # Epic containing multiple issues
    events: [all]
  - pattern: "is-2025-*"  # All 2025 issues
    events: [status]
```

### 2.2 Event Types on Beads

| Event Type | Description | Example |
|------------|-------------|---------|
| `status.changed` | Issue status transition | in_progress → review |
| `comment.added` | New comment on issue | Agent posts findings |
| `assignee.changed` | Claim/release | Agent claims work |
| `dependency.added` | New dependency | Issue blocked by another |
| `label.changed` | Tag added/removed | Priority escalation |
| `content.modified` | Issue body changed | Spec updated |

### 2.3 File-Based Subscription Implementation

With a file sync layer, subscriptions become **directory watches**:

```
data-sync/issues/is-2025-0042/
├── issue.yaml          # Core issue data
├── status.yaml         # Separate file for high-churn fields
├── comments/           # Thread directory
│   ├── 001.md
│   └── 002.md
└── claims/             # Active claims
    └── agent-claude-07.yaml
```

An agent subscribed to this bead receives file change events:
- `issue.yaml` modified → content changed
- New file in `comments/` → new comment
- New file in `claims/` → someone claimed work

---

## 3. Use Case Comparison

### 3.1 Use Cases That Map Naturally to Bead Subscriptions

| Use Case | Agent Mail Approach | Bead Subscription Approach |
|----------|---------------------|---------------------------|
| **Status updates** | Send message: "Issue X now in review" | Subscribe to `is-X/status.yaml` |
| **Comments/discussion** | Message with thread_id | Watch `is-X/comments/` directory |
| **Work handoffs** | Message: "I've finished part A" | Write to `is-X/handoff.md` |
| **Blocking notifications** | Message: "Blocked by issue Y" | Watch `is-X/dependencies.yaml` |
| **Review requests** | Message with ack_required | Add to `is-X/reviews/pending/` |

**These cases favor bead subscriptions because**:
- The notification is inherently about a specific piece of work
- File changes are the authoritative source of truth
- No separate "message" state to manage

### 3.2 Use Cases That Need Explicit Messaging

| Use Case | Why Bead Subscriptions Fall Short |
|----------|-----------------------------------|
| **Direct requests** | "Agent B, can you help with X?" - not tied to a bead |
| **Cross-project coordination** | No shared bead to subscribe to |
| **Priority interrupts** | Need immediate delivery, not poll-based |
| **Administrative commands** | "Stop all work", "Reprioritize" |
| **Ephemeral queries** | "What's your status?" - doesn't need persistent file |

### 3.3 Hybrid Mapping

```
                    ┌─────────────────────┐
                    │   Agent Activity    │
                    └─────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │  Work on Bead │ │ Coordination  │ │ Direct Comms  │
    │  (File Sync)  │ │   (Leases)    │ │  (Messages)   │
    └───────────────┘ └───────────────┘ └───────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ Bead changes  │ │  TTL claims   │ │  Lightweight  │
    │ trigger subs  │ │ in live tier  │ │ message bus   │
    └───────────────┘ └───────────────┘ └───────────────┘
```

---

## 4. File System Sync: Sufficient or Not?

### 4.1 What File Sync Does Well

| Capability | How File Sync Provides It |
|------------|---------------------------|
| **Data distribution** | Files replicate across nodes |
| **Consistency** | Policy-based (LWW, CAS, merge) |
| **Durability** | Git tier for permanent storage |
| **Tooling compatibility** | Any editor can read/write |
| **Offline support** | Local files work disconnected |
| **Audit trail** | Git history is built-in |

### 4.2 What File Sync Lacks

| Missing Capability | Why It Matters |
|--------------------|----------------|
| **Addressing** | Who is "agent-claude-07"? Where do I send? |
| **Routing** | How does a message reach the right agent? |
| **Presence** | Is this agent online? Will it see my change? |
| **Acknowledgment** | Did the recipient read/act on this? |
| **Priority/QoS** | Some messages are urgent |
| **TTL/expiry** | Ephemeral state that shouldn't persist |

### 4.3 The Gap: Coordination Metadata

File sync handles **content** but not **coordination metadata**:

```yaml
# Content (file sync handles well)
issue:
  title: "Fix login bug"
  status: in_progress

# Coordination (needs additional layer)
coordination:
  claimed_by: agent-claude-07
  claim_expires: 2026-02-01T12:00:00Z
  watching_agents: [agent-claude-12, agent-codex-01]
  last_heartbeat: 2026-02-01T11:45:00Z
```

The coordination metadata is **ephemeral** and **real-time** - it doesn't fit cleanly into a file sync model.

---

## 5. Architecture Options

### 5.1 Option A: Pure File Sync

**Everything is files**, including coordination:

```
live/
├── agents/
│   ├── claude-07/
│   │   ├── heartbeat.yaml    # Updated every 30s
│   │   ├── inbox/            # Incoming messages as files
│   │   └── outbox/           # Outgoing messages
│   └── claude-12/
│       └── ...
├── claims/
│   └── is-2025-0042.yaml     # Claim file with TTL
└── presence/
    └── claude-07.yaml        # Online status
```

**Pros**:
- Unified model
- All tooling works
- Easy debugging

**Cons**:
- Polling latency for real-time needs
- TTL enforcement is messy (daemon must clean up)
- High write churn for heartbeats

### 5.2 Option B: File Sync + Event Bus

Files for content, **event bus for notifications**:

```
┌────────────┐     file changes     ┌─────────────┐
│   Agent    │ ──────────────────▶  │  Sync Layer │
│            │                      │   (NATS)    │
│            │ ◀──────────────────  │             │
└────────────┘   change events      └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  Event Bus  │
                                    │  (NATS JS)  │
                                    └─────────────┘
```

The sync layer:
1. Watches for file changes
2. Syncs to other nodes
3. **Also publishes events** to interested agents

**Pros**:
- Fast notifications (sub-second)
- Clean separation of concerns
- Can add filtering/routing

**Cons**:
- Two systems to understand
- Potential consistency gaps

### 5.3 Option C: File Sync + Lightweight Message API

Files for content and most notifications, **small message API for direct comms**:

```yaml
# Most communication via file changes
data-sync/issues/is-2025-0042/comments/003.md

# Direct messages via simple API
POST /agents/claude-12/inbox
{
  "from": "claude-07",
  "type": "request",
  "body": "Can you review my PR?",
  "refs": { "pr": "PR-123" }
}
```

The message API is **not durable** - it's for real-time coordination only.
Important messages that need persistence become files.

**Pros**:
- Clear distinction: files = durable, messages = ephemeral
- Simple API surface
- Matches mental model of email vs chat

**Cons**:
- Two mechanisms for "communication"
- Must decide which to use when

### 5.4 Recommended: Option B + Mailbox Files

Combine the best of both:

1. **File sync as primary** - all durable state
2. **Event bus for notifications** - derived from file changes
3. **Mailbox directories for messages** - durable but fast

```
data-sync/agents/claude-07/
├── config.yaml           # Agent configuration
├── inbox/                # Durable message inbox
│   ├── 2026-02-01-001.yaml
│   └── 2026-02-01-002.yaml
└── outbox/               # Sent messages (audit)
    └── ...

live/agents/claude-07/
├── heartbeat.yaml        # Ephemeral presence
├── claims/               # Active work claims
└── status.yaml           # Current activity
```

Messages in `inbox/` are:
- Synced via file sync (durable)
- Also trigger instant event bus notification
- Agent can read as files OR receive as events

---

## 6. Comparison Summary

### 6.1 Agent Mail Features → Bead Model Mapping

| Agent Mail Feature | Bead Model Equivalent | Notes |
|--------------------|----------------------|-------|
| `send_message()` | Write to `recipient/inbox/` | File becomes the message |
| `fetch_inbox()` | Read from `self/inbox/` | Glob + read |
| `mark_as_read()` | Move to `self/inbox/read/` | File move = state change |
| `file_reservation_request()` | Write to `live/claims/` | CAS create for exclusivity |
| `file_reservation_release()` | Delete claim file | Or TTL expiry |
| `register_agent()` | Write to `agents/self/config.yaml` | Self-registration |
| Thread conversations | `issues/X/comments/` directory | Natural fit |

### 6.2 What Bead Subscriptions Replace

✅ **Fully replaced by bead subscriptions**:
- Status update notifications
- New comment notifications
- Work handoff notifications
- Dependency/blocking notifications
- Review request notifications

⚠️ **Partially replaced** (need mailbox hybrid):
- Direct messages between agents
- Cross-project notifications
- Priority/urgent messages

❌ **Not replaced** (need additional primitives):
- Real-time presence (heartbeats)
- TTL enforcement (lease expiry)
- Acknowledgment tracking
- Message routing/filtering

### 6.3 Decision Matrix

| Requirement | Pure File Sync | File + Events | File + Messages |
|-------------|----------------|---------------|-----------------|
| Sub-second latency | ⚠️ Polling | ✅ Push | ✅ Push |
| All tools work | ✅ | ✅ | ⚠️ Need API |
| Offline support | ✅ | ⚠️ | ⚠️ |
| Direct addressing | ❌ | ⚠️ | ✅ |
| Presence/heartbeat | ⚠️ Churn | ✅ | ✅ |
| Simplicity | ✅ | ⚠️ | ⚠️ |

---

## 7. Recommendations

### 7.1 Primary Recommendation

**Use bead subscriptions as the foundation, with mailbox directories for direct messaging.**

Implementation approach:

1. **Bead subscriptions via file watching**
   - Agents subscribe to issue/epic/spec directories
   - File changes trigger notifications
   - Event bus (NATS) provides sub-second delivery

2. **Mailbox directories for messages**
   - `data-sync/agents/{agent}/inbox/` for durable messages
   - Messages are YAML files with standard envelope
   - Synced like any other file, but also trigger events

3. **Leases in live tier**
   - `live/claims/` for work claims
   - `live/agents/{agent}/heartbeat.yaml` for presence
   - NATS KV with TTL for automatic cleanup

### 7.2 Message Envelope Format

```yaml
# data-sync/agents/claude-12/inbox/2026-02-01T11:45:00Z-claude-07.yaml
id: msg-01hxyz...
from: claude-07
to: [claude-12]
thread: th-abc123
refs:
  issue: is-2025-0042
  pr: PR-123
subject: "Ready for review"
body: |
  I've completed the initial implementation.
  Please review when you have time.
importance: normal
created: 2026-02-01T11:45:00Z
```

### 7.3 Subscription Configuration

```yaml
# data-sync/agents/claude-07/subscriptions.yaml
subscriptions:
  # Watch specific issues I'm working on
  - pattern: "data-sync/issues/is-2025-004*/**"
    events: [all]

  # Watch epic I'm part of for status changes
  - pattern: "data-sync/epics/ep-2025-0003/status.yaml"
    events: [modified]

  # My inbox for direct messages
  - pattern: "data-sync/agents/claude-07/inbox/**"
    events: [created]
```

### 7.4 What This Replaces from Agent Mail

| Agent Mail | This Model |
|------------|------------|
| SQLite + Git dual persistence | File sync with tiered storage |
| `Message` model | YAML files in inbox directories |
| `FileReservation` model | Claim files with CAS + TTL |
| `Agent` registration | Config file + presence heartbeat |
| MCP tools | CLI commands + file operations |

---

## 8. Open Questions

1. **Message ordering**: How to ensure messages are processed in order when using file sync?

2. **Inbox cleanup**: When are read messages archived or deleted?

3. **Cross-project subscriptions**: How does an agent subscribe to beads in another project?

4. **Event deduplication**: If file sync and event bus both notify, how to avoid duplicate processing?

5. **Subscription persistence**: Where do subscription configs live? Who manages them?

---

## 9. Next Steps

1. **Prototype mailbox directories** - implement inbox/outbox pattern with file sync

2. **Add event emission to sync daemon** - file changes → NATS events

3. **Define subscription schema** - standard format for what agents watch

4. **Implement presence layer** - heartbeat files with TTL in live tier

5. **Test latency characteristics** - measure file sync vs event bus delivery times

---

## Appendix A: Agent Mail Code References

Key files from the Agent Mail implementation:

- `models.py:86-105` - Message model with threading and importance
- `models.py:108-123` - FileReservation with TTL
- `storage.py` - Git-backed commit queue pattern
- `app.py` - MCP tool implementations

The dual persistence pattern (SQLite for queries, Git for durability) informed our tiered storage design.

## Appendix B: Related Primitives from Agent Coordination Kernel

From `research-agent-coordination-kernel.md`:

| Primitive | Role | Our Mapping |
|-----------|------|-------------|
| Entity Store | Durable truth | Git tier files |
| Event Journal | Append-only log | NATS JetStream |
| Lease | TTL claims | `live/claims/` with KV |
| Mailbox | Directed messages | `inbox/` directories |
| Watch | Change streams | File sync + event emission |
