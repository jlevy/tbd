# tbd Design Specification

Task management, spec-driven planning, and instant knowledge injection for AI coding
agents.

**Author:** Joshua Levy (github.com/jlevy) and various LLMs

**Status**: Living design; each section labels current and candidate behavior

**First drafted**: January 2025

**Last updated**: 2026-09-10

* * *

## Table of Contents

- [tbd Design Specification](#tbd-design-specification)
  - [Table of Contents](#table-of-contents)
  - [1. Introduction](#1-introduction)
    - [1.1 What is tbd?](#11-what-is-tbd)
    - [1.2 When to Use tbd vs Beads](#12-when-to-use-tbd-vs-beads)
    - [1.3 Why Replace Beads? (Architecture Comparison)](#13-why-replace-beads-architecture-comparison)
    - [1.4 Design Goals](#14-design-goals)
    - [1.5 Design Principles](#15-design-principles)
    - [1.6 Non-Goals](#16-non-goals)
    - [1.7 Layer Overview](#17-layer-overview)
  - [2. File Layer](#2-file-layer)
    - [2.1 Overview](#21-overview)
      - [Markdown and YAML Front Matter Format](#markdown-and-yaml-front-matter-format)
      - [Canonical Serialization](#canonical-serialization)
      - [Atomic File Writes](#atomic-file-writes)
    - [2.2 Directory Structure](#22-directory-structure)
      - [On Main Branch (all working branches)](#on-main-branch-all-working-branches)
      - [In `$GIT_COMMON_DIR/tbd/` (local, shared by linked worktrees)](#in-git_common_dirtbd-local-shared-by-linked-worktrees)
      - [On `tbd-sync` Branch](#on-tbd-sync-branch)
    - [2.3 Hidden Worktree Model](#23-hidden-worktree-model)
      - [Worktree Setup](#worktree-setup)
      - [Worktree Gitignore](#worktree-gitignore)
      - [.tbd/.gitattributes Contents](#tbdgitattributes-contents)
      - [Accessing Issues via Worktree](#accessing-issues-via-worktree)
      - [Worktree Lifecycle](#worktree-lifecycle)
      - [Worktree Initialization Decision Tree](#worktree-initialization-decision-tree)
      - [Worktree Health States](#worktree-health-states)
      - [Path Terminology and Resolution](#path-terminology-and-resolution)
      - [Worktree Errors](#worktree-errors)
    - [2.4 Workspaces](#24-workspaces)
      - [Workspace Structure](#workspace-structure)
      - [Commands](#commands)
      - [Sync Failure Recovery Workflow](#sync-failure-recovery-workflow)
      - [Merge Behavior](#merge-behavior)
    - [2.5 Entity Collection Pattern](#25-entity-collection-pattern)
      - [Directory Layout](#directory-layout)
      - [Adding New Entity Types (Future)](#adding-new-entity-types-future)
    - [2.6 ID Generation](#26-id-generation)
      - [ID Generation Algorithm](#id-generation-algorithm)
      - [ID Mapping](#id-mapping)
      - [ID Resolution (CLI)](#id-resolution-cli)
      - [File Naming](#file-naming)
      - [Display Format](#display-format)
      - [Type-Safe ID Handling (Branded Types)](#type-safe-id-handling-branded-types)
    - [2.7 Schemas](#27-schemas)
      - [2.7.1 Common Types](#271-common-types)
      - [2.7.2 BaseEntity](#272-baseentity)
      - [2.7.3 IssueSchema](#273-issueschema)
      - [2.7.4 ConfigSchema](#274-configschema)
      - [2.7.5 MetaSchema](#275-metaschema)
      - [2.7.6 LocalStateSchema](#276-localstateschema)
      - [2.7.7 AtticEntrySchema](#277-atticentryschema)
    - [2.8 Relationship Types](#28-relationship-types)
      - [2.8.1 Relationship Model Overview](#281-relationship-model-overview)
      - [2.8.2 Parent-Child Relationships](#282-parent-child-relationships)
      - [2.8.3 Dependency Relationships](#283-dependency-relationships)
      - [2.8.4 Visualization Commands](#284-visualization-commands)
      - [2.8.5 Comparison with Beads](#285-comparison-with-beads)
      - [2.8.6 Future Dependency Types](#286-future-dependency-types)
      - [2.8.7 Future: Transitive Blocking Option](#287-future-transitive-blocking-option)
    - [2.9 Managed Docs: Copies, Forks, and Synchronization](#29-managed-docs-copies-forks-and-synchronization)
    - [2.10 Native Comment Records (Dormant Foundation)](#210-native-comment-records-dormant-foundation)
      - [2.10.1 Record and Relationship Model](#2101-record-and-relationship-model)
      - [2.10.2 Storage, Publication, and Repair](#2102-storage-publication-and-repair)
      - [2.10.3 Git, Watch, and Provider Boundaries](#2103-git-watch-and-provider-boundaries)
      - [2.10.4 Compatibility and Activation](#2104-compatibility-and-activation)
  - [3. Git Layer](#3-git-layer)
    - [3.1 Overview](#31-overview)
    - [3.2 Sync Branch Architecture](#32-sync-branch-architecture)
      - [Files Committed on Main Branch](#files-committed-on-main-branch)
      - [Files Gitignored (local only)](#files-gitignored-local-only)
      - [Files Tracked on tbd-sync Branch](#files-tracked-on-tbd-sync-branch)
    - [3.3 Sync Operations](#33-sync-operations)
      - [3.3.1 Reading from Sync Branch](#331-reading-from-sync-branch)
      - [3.3.2 Writing to Sync Branch](#332-writing-to-sync-branch)
      - [3.3.3 Sync Algorithm](#333-sync-algorithm)
    - [3.4 Conflict Detection and Resolution](#34-conflict-detection-and-resolution)
      - [When Conflicts Occur](#when-conflicts-occur)
      - [Detection](#detection)
      - [Resolution Flow](#resolution-flow)
      - [No-Common-Base Reconciliation](#no-common-base-reconciliation)
    - [3.5 Merge Rules](#35-merge-rules)
      - [BaseEntity Merge Rules](#baseentity-merge-rules)
      - [Issue Merge Rules](#issue-merge-rules)
      - [Native-Comment Preservation Boundary](#native-comment-preservation-boundary)
    - [3.6 Attic Structure](#36-attic-structure)
    - [3.7 Read-Only Remote Observation](#37-read-only-remote-observation)
  - [4. CLI Layer](#4-cli-layer)
    - [4.1 Overview](#41-overview)
    - [4.1.1 Initialization Requirements](#411-initialization-requirements)
    - [4.2 Command Structure](#42-command-structure)
    - [4.3 Initialization](#43-initialization)
    - [4.4 Issue Commands](#44-issue-commands)
      - [Create](#create)
      - [List](#list)
      - [Show](#show)
      - [Start](#start)
      - [Update](#update)
      - [Close](#close)
      - [Reopen](#reopen)
      - [Pause and Resume](#pause-and-resume)
      - [Ready](#ready)
      - [Blocked](#blocked)
      - [Stale](#stale)
    - [4.5 Label Commands](#45-label-commands)
    - [4.6 Dependency Commands](#46-dependency-commands)
    - [4.7 Sync Commands](#47-sync-commands)
    - [4.8 Search Commands](#48-search-commands)
      - [Implementation Notes](#implementation-notes)
    - [4.9 Maintenance Commands](#49-maintenance-commands)
      - [Status](#status)
      - [Stats](#stats)
      - [Doctor](#doctor)
      - [Compact (Future)](#compact-future)
      - [Config](#config)
    - [4.10 Global Options](#410-global-options)
    - [4.11 Attic Commands](#411-attic-commands)
    - [4.12 Output Formats](#412-output-formats)
    - [4.13 Docs Commands](#413-docs-commands)
    - [4.14 Change and Watch Commands](#414-change-and-watch-commands)
      - [4.14.1 Baseline Commits](#4141-baseline-commits)
      - [4.14.2 Selectors](#4142-selectors)
      - [4.14.3 Change Report Format](#4143-change-report-format)
      - [4.14.4 Watch Loop](#4144-watch-loop)
    - [4.15 Local Web View](#415-local-web-view)
      - [Concurrency and Snapshot Safety](#concurrency-and-snapshot-safety)
  - [5. Beads Compatibility](#5-beads-compatibility)
    - [5.1 Import Strategy](#51-import-strategy)
      - [5.1.1 One-Step Beads Migration](#511-one-step-beads-migration)
      - [5.1.2 Explicit JSONL and Workspace Import](#512-explicit-jsonl-and-workspace-import)
      - [5.1.3 ID Mapping and Re-Import](#513-id-mapping-and-re-import)
      - [5.1.4 Field and Relationship Conversion](#514-field-and-relationship-conversion)
      - [5.1.5 Migration Workflow](#515-migration-workflow)
    - [5.2 Command Mapping](#52-command-mapping)
    - [5.3 Field Mapping](#53-field-mapping)
    - [5.4 Status Mapping](#54-status-mapping)
    - [5.5 Compatibility Notes](#55-compatibility-notes)
      - [What Works Identically](#what-works-identically)
      - [Key Differences](#key-differences)
    - [5.6 Compatibility Contract](#56-compatibility-contract)
      - [Migration Gotchas](#migration-gotchas)
  - [6. Implementation Notes](#6-implementation-notes)
    - [6.1 Performance Optimization](#61-performance-optimization)
      - [Query Index](#query-index)
      - [File I/O Optimization](#file-io-optimization)
    - [6.2 Testing Strategy](#62-testing-strategy)
    - [6.3 Migration Path](#63-migration-path)
    - [6.4 Installation and Agent Integration](#64-installation-and-agent-integration)
      - [6.4.1 Installation Methods](#641-installation-methods)
      - [6.4.2 Claude Code Integration](#642-claude-code-integration)
      - [6.4.3 The `tbd prime` Command](#643-the-tbd-prime-command)
      - [6.4.4 Other Editor Integrations](#644-other-editor-integrations)
      - [6.4.5 Cloud Environment Bootstrapping](#645-cloud-environment-bootstrapping)
  - [7. Appendices](#7-appendices)
    - [7.1 Design Decisions](#71-design-decisions)
      - [Decision 1: File-per-entity vs JSONL](#decision-1-file-per-entity-vs-jsonl)
      - [Decision 2: No daemon required](#decision-2-no-daemon-required)
      - [Decision 3: Sync branch instead of main](#decision-3-sync-branch-instead-of-main)
      - [Decision 4: Dual ID system (ULID and short base36)](#decision-4-dual-id-system-ulid-and-short-base36)
      - [Decision 5: Only “blocks” dependencies](#decision-5-only-blocks-dependencies)
      - [Decision 6: Markdown and YAML storage](#decision-6-markdown-and-yaml-storage)
      - [Decision 7: Hidden worktree for sync branch](#decision-7-hidden-worktree-for-sync-branch)
    - [7.2 Future Enhancements](#72-future-enhancements)
      - [Additional Dependency Types (High Priority)](#additional-dependency-types-high-priority)
      - [Ripgrep-Based Search (Performance)](#ripgrep-based-search-performance)
      - [Agent Registry](#agent-registry)
      - [Native Comments and Messaging](#native-comments-and-messaging)
      - [External Tracker Bridges](#external-tracker-bridges)
      - [Real-time Coordination](#real-time-coordination)
      - [Workflow Automation](#workflow-automation)
      - [Time Tracking](#time-tracking)
    - [7.3 File Structure Reference](#73-file-structure-reference)
  - [Appendix A: Beads to tbd Feature Mapping](#appendix-a-beads-to-tbd-feature-mapping)
    - [A.1 Executive Summary](#a1-executive-summary)
    - [A.2 CLI Command Mapping](#a2-cli-command-mapping)
      - [A.2.1 Issue Commands (Full Parity)](#a21-issue-commands-full-parity)
      - [A.2.2 Label Commands (Full Parity)](#a22-label-commands-full-parity)
      - [A.2.3 Dependency Commands (Partial - blocks only)](#a23-dependency-commands-partial---blocks-only)
      - [A.2.4 Sync Commands](#a24-sync-commands)
      - [A.2.5 Maintenance Commands (Full Parity)](#a25-maintenance-commands-full-parity)
      - [A.2.6 Global Options](#a26-global-options)
    - [A.3 Data Model Mapping](#a3-data-model-mapping)
      - [A.3.1 Issue Schema](#a31-issue-schema)
      - [A.3.2 Status Values](#a32-status-values)
      - [A.3.3 Issue Types/Kinds](#a33-issue-typeskinds)
      - [A.3.4 Dependency Types](#a34-dependency-types)
    - [A.4 Architecture Comparison](#a4-architecture-comparison)
      - [A.4.1 Storage](#a41-storage)
      - [A.4.2 Sync](#a42-sync)
    - [A.5 LLM Agent Workflow Comparison](#a5-llm-agent-workflow-comparison)
      - [A.5.1 Basic Agent Loop (Full Parity)](#a51-basic-agent-loop-full-parity)
      - [A.5.2 Creating Linked Work (Partial Parity)](#a52-creating-linked-work-partial-parity)
      - [A.5.3 Migration Workflow](#a53-migration-workflow)
    - [A.6 Parity Summary](#a6-parity-summary)
    - [A.7 Deferred Features](#a7-deferred-features)
    - [A.8 Migration Compatibility](#a8-migration-compatibility)
  - [Appendix B: Beads Commands Not Included](#appendix-b-beads-commands-not-included)
    - [B.1 Daemon Commands](#b1-daemon-commands)
    - [B.2 Molecule/Workflow Commands](#b2-moleculeworkflow-commands)
    - [B.3 Agent Coordination Commands](#b3-agent-coordination-commands)
    - [B.4 Advanced Data Operations](#b4-advanced-data-operations)
    - [B.5 Comment Commands](#b5-comment-commands)
    - [B.6 Editor Integration Commands](#b6-editor-integration-commands)
    - [B.7 Additional Dependency Types](#b7-additional-dependency-types)
    - [B.8 State Label Commands](#b8-state-label-commands)
    - [B.9 Other Commands](#b9-other-commands)
    - [B.10 Global Flags Not Supported](#b10-global-flags-not-supported)
    - [B.11 Issue Types/Statuses Not Supported](#b11-issue-typesstatuses-not-supported)
  - [8. Cross-Cutting Decisions and Open Questions](#8-cross-cutting-decisions-and-open-questions)
    - [8.1 Actor System Design](#81-actor-system-design)
    - [8.2 Git Operations](#82-git-operations)
      - [8.2.1 Timestamp and Ordering](#821-timestamp-and-ordering)
    - [8.3 Mapping File Structure](#83-mapping-file-structure)
    - [8.4 ID Length](#84-id-length)
    - [8.5 Future Extension Points](#85-future-extension-points)
    - [8.6 Issue Storage Location](#86-issue-storage-location)
    - [8.7 External Issue Tracker Linking](#87-external-issue-tracker-linking)

* * *

## 1. Introduction

### 1.1 What is tbd?

**tbd combines task management, spec-driven planning, and instant knowledge injection
for AI coding agents.**

tbd ("To Be Done" or “TypeScript Beads”) is a git-native issue tracker that stores
issues as Markdown files with YAML frontmatter on a dedicated sync branch, enabling
conflict-free collaboration without daemons or databases.
It also bundles spec-driven workflows, reusable workflow shortcuts, and a curated
knowledge base of engineering best practices that agents can inject into their context
on demand.

tbd provides **four integrated capabilities**:

1. **Task tracking (beads)**—Git-native issues, bugs, epics, and dependencies that
   persist across sessions.
   This alone is a step change in what agents can do.
2. **Spec-driven planning**—Workflows for writing specs, breaking them into issues, and
   implementing systematically.
3. **Instant knowledge injection**—25+ detailed guideline docs covering TypeScript,
   Python, Convex, monorepo architecture, TDD, and more—injected into the agent’s
   context on demand via shortcuts, guidelines, and templates.
4. **Live views and tracker sync**—A local read-only web view of bead state (§4.15),
   change watching for agents (§4.14), and synchronization with external trackers,
   starting with Linear (§8.7).

The **issue tracking layer** has four core principles:

- **Durable storage in git**—Issues are version-controlled and distributed via standard
  git
- **Works in almost any environment**—No daemon, no SQLite, no file locking issues on
  network drives
- **Simple, self-documenting CLI**—Designed for both AI agents and humans
- **Transparent internal format**—Markdown/YAML files that are debuggable and friendly
  to other tooling

Coordination and visibility build on that durable core: `tbd watch` (§4.14) wakes a
process when selected bead state changes on the remote, `tbd web` (§4.15) serves a live
read-only view, and `tbd integration` (§8.7) synchronizes beads with external trackers
such as Linear.

**Key characteristics:**

- **Drop-in replacement**: Compatible with core
  [Beads](https://github.com/steveyegge/beads) CLI commands and workflows (have agents
  use `tbd` instead of `bd`)

- **Simpler architecture**: No daemon changing your `.beads` directory, no SQLite and
  associated file locking

- **Git-native**: Uses a dedicated sync branch for coordination data

- **Human-readable format**: Markdown and YAML front matter - directly viewable and
  editable in any text editor

- **File-per-entity**: Each issue is a separate `.md` file for fewer merge conflicts

- **Searchable**: Hidden worktree enables search across all issues (manual ripgrep also
  works)

- **Reliable sync**: Git-based conflict detection with field-level LWW merge and attic
  preservation

- **Cross-environment**: Works on local machines, CI, cloud sandboxes, network
  filesystems

- **Live local web view**: `tbd web` serves a loopback-only, read-only board that
  updates as local bead state changes (§4.15)

- **External tracker sync**: Optional per-repository integration mirrors or
  bidirectionally synchronizes beads with Linear; GitHub is planned (§8.7)

**Related Projects:**

- [Beads](https://github.com/steveyegge/beads)—The original git-backed issue tracker tbd
  is designed to replace
- [ticket](https://github.com/wedow/ticket)—Bash-based Markdown+YAML tracker (~1900
  tickets in production)
- [git-bug](https://github.com/git-bug/git-bug)—Issues stored as git objects
- [git-issue](https://github.com/dspinellis/git-issue)—Shell-based with optional GitHub
  sync

### 1.2 When to Use tbd vs Beads

tbd and Beads serve different use cases:

**Use tbd when:**

| Scenario | Why tbd |
| --- | --- |
| Single agent, simple ticket tracking | Simpler, no daemon, fewer failure modes |
| Multi-agent with async handoffs | Git sync is sufficient, advisory claims work |
| Cloud sandbox / restricted environment | No daemon required, works with isolated git |
| Network filesystem (NFS/SMB) | No SQLite, no file locking issues |
| Need to debug sync issues | Markdown files are inspectable, no hidden state |
| Protected main branch | Sync branch architecture keeps main clean |

**Use Beads when:**

| Scenario | Why Beads |
| --- | --- |
| Multi-agent requiring atomic claim enforcement | Daemon-based sync with atomic claims |
| Complex workflow orchestration | Molecules, wisps, formulas, bonding |
| Need ephemeral work tracking | Wisps (never synced, squash to digest) |
| High-performance queries on 10K+ issues | SQLite with indexes is faster than file scan |
| Need automatic “memory decay” | AI-powered compaction of old issues |
| Need interactive edit mode | `bd edit` opens in $EDITOR |

**Key Differences Summary:**

| Aspect | tbd | Beads |
| --- | --- | --- |
| Architecture | 2 locations (files and sync branch) | 4 locations (SQLite, JSONL, sync, main) |
| Daemon | Not required | Required for real-time sync |
| Storage | Markdown and YAML files | SQLite and JSONL |
| Coordination | Advisory claims, polling | Atomic claims, real-time |
| Workflow templates | Not supported | Molecules, wisps, protos |
| Debugging | Inspect files directly | Requires SQLite queries |

**tbd is NOT:**

- A sub-second coordination system: `tbd watch` provides poll-latency wake-ups, not
  atomic claims or push messaging

- A replacement for Beads’ advanced orchestration features (molecules, wisps, formulas)

- A workflow automation engine with templates

### 1.3 Why Replace Beads? (Architecture Comparison)

Beads proved that git-backed issue tracking works well for AI agents and humans, but its
architecture accumulated complexity:

**Beads Pain Points:**

- **4-location data sync**: SQLite → Local JSONL → Sync Branch → Main Branch

- **Daemon conflicts**: Background process fights manual git operations

- **Worktree complexity**: Special git worktree setup breaks normal git workflows

- **JSONL merge conflicts**: Single file creates conflicts on parallel issue creation

- **Debug difficulty**: Mystery state spread across SQLite, JSONL, and git branches

- **Network filesystem issues**: SQLite doesn’t work well on NFS/SMB

**tbd Solutions:**

- **2-location data**: Config on main branch, entities on sync branch

- **No daemon required**: Simple CLI tool, optional background sync

- **Hidden worktree**: Managed worktree for sync branch access (also enables manual
  ripgrep)

- **File-per-entity**: Parallel creation has zero conflicts

- **Transparent state**: Everything is inspectable Markdown files with YAML metadata

- **Network-safe**: Atomic file writes, no database locks

**Related Work:**

tbd builds on lessons from the git-native issue tracking ecosystem:

- **[ticket](https://github.com/wedow/ticket)**: An elegantly simple Beads alternative
  implemented as a single bash script (~~900 lines) with Markdown and YAML frontmatter
  storage. Ticket demonstrates that simplicity and minimal dependencies (bash and
  coreutils) can outperform complex architectures—it manages ~~1,900 tickets in
  production and provides a `migrate-beads` command for smooth transitions.
  The key insight: “You don’t need to index everything with SQLite when you have awk.”
  tbd shares this philosophy while adding TypeScript implementation, stronger conflict
  resolution, and cross-platform reliability.

- **[git-bug](https://github.com/git-bug/git-bug)**: Stores issues as git objects,
  demonstrating git-native tracking without external files

- **[git-issue](https://github.com/dspinellis/git-issue)**: Shell-based issue tracker
  with optional GitHub sync

- **[beans](https://github.com/hmans/beans)**: Another minimalist git-friendly tracker

The common thread: **simplicity, no background services, git for distribution**. tbd
builds on these proven patterns, adding multi-environment sync and conflict resolution.

### 1.4 Design Goals

Agents perform *far* better when they can track tasks reliably and stay organized.
Sometimes they can use external issue trackers (GitHub Issues, Linear, Jira), but as
Beads has shown, there is great benefit to lightweight tracking of tasks via CLI.

tbd addresses specific requirements:

| Requirement | Solution |
| --- | --- |
| Works in cloud sandboxes like Claude Code Cloud | Easy setup, no daemon or SQLite, which is incompatible with some network drives |
| Git commit log noise | Issues stored on separate `tbd-sync` branch |
| Synchronized state across Git branches | Always sync from the `tbd-sync` branch |
| Git merging conflicts | One file per issue eliminates most merge conflicts |
| Agent-friendly | Self-documenting, skill-compatible, simple commands |
| Transparent formats | Issues internally are Markdown files with YAML frontmatter |
| Reliable | Clear specs, golden testing of end-to-end use scenarios |

**Design goals:**

1. **Beads CLI compatibility**: Existing workflows and scripts work with minimal changes
   for the most common beads commands

2. **No data loss**: Conflicts preserve both versions via attic mechanism

3. **Works anywhere**: Just `npm install -g get-tbd` anywhere: local dev, CI, cloud IDEs
   (Claude Code, Codespaces), network filesystems

4. **Simple architecture**: Easy to understand, debug, and maintain

5. **Performance**: <50ms for common operations on 5,000-10,000 issues

6. **Cross-platform**: macOS, Linux, Windows without platform-specific code

7. **Easy migration**: `tbd setup --from-beads` performs repository migration, while
   `tbd import <beads-export.jsonl>` imports a controlled snapshot into initialized tbd

### 1.5 Design Principles

1. **Simplicity first**: Prefer boring, well-understood approaches over clever
   optimization

2. **Files as truth**: Markdown and YAML files on disk are the canonical state

3. **Git for sync**: Standard git commands handle all distribution

4. **No required daemon**: CLI-first, background services optional

5. **Debuggable by design**: Every state change is visible in files and git history

6. **Progressive enhancement**: Core works standalone, bridges/UI are optional layers

### 1.6 Non-Goals

Explicitly deferred to future versions:

- Real-time presence/heartbeats

- Atomic claim enforcement

- GitHub bidirectional sync (external-tracker sync ships with Linear as the first
  provider; §8.7)

- Slack/Discord integration

- General TUI/GUI interfaces beyond the optional, loopback-only, read-only `tbd web`
  view (§4.15)

- Activation of the candidate bead-attached native-comment surface in §2.10, plus any
  direct inbox, presence, or broader agent messaging

- Workflow automation

- Time tracking

- Custom fields

**Rationale**: Ship a small, reliable core first; add complexity only when proven
necessary.

### 1.7 Layer Overview

tbd has three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Layer                                 │
│                        User/agent interface                      │
│   tbd <command> [args] [options]                               │
│   Beads-compatible commands                                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        Git Layer                                 │
│                        Distributed sync                          │
│   tbd-sync branch │ git fetch/push │ merge algorithm          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                        File Layer                                │
│                        Format specification                      │
│   .tbd/config.yml │ .tbd/data-sync/*.md │ Zod schemas              │
└─────────────────────────────────────────────────────────────────┘
```

**File Layer**: Defines Markdown/YAML format, directory structure, ID generation

**Git Layer**: Defines sync using standard git commands, conflict resolution

**CLI Layer**: Beads-compatible command interface

* * *

## 2. File Layer

### 2.1 Overview

The File Layer defines entity schemas and storage format using **Markdown files with
YAML front matter** - the same format used by static site generators (Jekyll, Hugo,
Astro).

**Key properties:**

- **Zod schemas are normative**: TypeScript Zod definitions are the specification

- **Human-readable**: Issues are viewable/editable in any text editor

- **Self-documenting**: Each `.md` file has YAML front matter with `type` field

- **Markdown body**: Description and notes are natural Markdown

- **Canonical serialization**: Deterministic format for content hashing

- **Atomic writes**: Write to temp file, then atomic rename (see below)

#### Markdown and YAML Front Matter Format

Issue files use the standard front matter pattern:

```markdown
---
type: is
id: is-01hx5zzkbkactav9wevgemmvrz
title: Fix authentication timeout
kind: bug
status: in_progress
priority: 1
version: 3
assignee: alice
delegate: claude
labels:
  - backend
  - security
dependencies:
  - target: is-01hx5zzkbkbctav9wevgemmvrz
    type: blocks
parent_id: null
due_date: 2025-01-15T00:00:00Z
deferred_until: null
created_by: alice
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
closed_at: null
close_reason: null
extensions: {}
---

Users are being logged out after exactly 5 minutes of inactivity.

## Steps to Reproduce

1. Log in to the application
2. Wait 5 minutes
3. Try to navigate to another page

## Notes

Found the issue in session.ts line 42. Working on fix.
```

**File structure:**

- `---` delimiters enclose YAML front matter

- Metadata fields in YAML (structured data)

- Body is the description (Markdown)

- `## Notes` section separates working notes from description

> **Note:** The example above uses the same logical top-level field order as the current
> serializer. Fields unknown to this version follow the declared fields.

#### Canonical Serialization

For consistent git diffs and potential future caching, we use deterministic
serialization:

**YAML front matter rules:**

- Known top-level issue keys follow the explicit `ISSUE_FIELD_ORDER` in `schemas.ts`.
  Unknown keys follow them in their existing object-enumeration order.

- Nested object keys preserve insertion order; the serializer does not recursively sort
  them.

- Arrays preserve input order.
  The serializer does not sort labels, dependencies, or other arrays.

- Block style is used for arrays and objects.

- Present `null` values are written as `null`; absent optional or `undefined` fields are
  omitted.

- Values supplied by schema defaults, such as `labels: []` and `dependencies: []`, are
  normally explicit after a parsed issue is serialized.

- Structural separators use LF and the serializer appends one final newline.

**Body rules:**

- Trim leading and trailing whitespace from description and notes.

- Preserve internal blank lines, indentation, and line breaks in those fields.

- Join the front matter and body with LF separators and append one final newline.

**Recommended `.gitattributes` for canonical issue and metadata surfaces:**

```
.tbd/data-sync/issues/** text eol=lf
.tbd/data-sync/mappings/** text eol=lf
.tbd/data-sync/meta.yml text eol=lf
```

Do not apply blanket text normalization to `.tbd/data-sync/**`. Candidate native
comments and their content-addressed conflict evidence require exact bytes.
Before activation, `tbd-44kw` owns the tested non-transforming attributes for
`.tbd/data-sync/comments/**` and `.tbd/data-sync/attic/comment-conflicts/**`, including
autocrlf, clean-filter, and encoding cases.
See the
[native comment architecture](https://github.com/jlevy/tbd/blob/main/docs/project/architecture/current/arch-native-comments.md).

**Required `.tbd/.gitattributes`** (created by `tbd setup`):

Current f08 setup installs only the mapping rule shown below.
It does not yet install native-comment or conflict-evidence non-transforming rules;
those remain `tbd-44kw`.

```gitattributes
# Protect ID mappings from merge deletion (always keep all rows)
# See: https://github.com/jlevy/tbd/issues/99
**/mappings/ids.yml merge=union
```

> **Why `merge=union`?** Git 3-way merge can delete `ids.yml` when merging a feature
> branch back to main, because main has no outbox directory and the merge treats “no
> file” as the correct state.
> The `merge=union` strategy keeps all lines from both sides, which is safe for
> `ids.yml` since it’s an append-only mapping.
> Contested duplicate keys (same short ID mapped to different ULIDs) are resolved
> deterministically at load time: the lexicographically smallest ULID keeps the
> contested short ID, and each displaced ULID receives a replacement derived from its
> own characters (no randomness).
> The corrected mapping is written on next save.
> This file is placed inside `.tbd/` so all tbd settings are self-contained in one
> directory. Git supports `.gitattributes` in subdirectories with paths relative to that
> directory.

> **Why canonical format?** Deterministic serialization ensures:
> 
> 1. Git diffs show only actual content changes (no spurious whitespace/ordering noise)
> 2. Testing is reliable (same input produces same output)
> 3. Future caching/deduplication can use content hashes if needed

#### Atomic File Writes

All file writes MUST be atomic to prevent corruption from crashes or concurrent access:

```typescript
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`;

  // Write to temporary file
  await fs.writeFile(tmpPath, content, 'utf8');

  // Ensure data is on disk
  const fd = await fs.open(tmpPath, 'r');
  await fd.sync();
  await fd.close();

  // Atomic rename (POSIX guarantees atomicity)
  await fs.rename(tmpPath, path);
}
```

**Why atomic writes?**

- Prevents half-written files if process crashes mid-write

- Prevents readers from seeing incomplete content

- Works on most filesystems (POSIX rename is atomic)

- Important on network filesystems

**Cross-platform notes:**

- POSIX local filesystems: `rename()` is atomic and durable after `fsync()`

- Windows: `rename()` is atomic but may fail if target exists (use `MoveFileEx` with
  `MOVEFILE_REPLACE_EXISTING`)

- Network filesystems (NFS, SMB): Best-effort atomicity; may not be fully atomic but
  still prevents partial writes

- Implementations should use a well-tested atomic-write library when available

The atomic-write helper cleans up the temporary file owned by the current operation on
success and failure.
There is no startup age-based temporary-file sweeper.
`tbd doctor` detects stranded `.tmp` files so an operator can inspect and repair them
explicitly.

### 2.2 Directory Structure

The current f08 implementation uses four directory locations:

- **`.tbd/`** on main branch: Configuration (tracked) + installed docs (gitignored)

- **`$GIT_COMMON_DIR/tbd/`** local repo-scoped machinery shared by the main checkout and
  all linked worktrees

- **`$GIT_COMMON_DIR/tbd/data-sync-worktree/`** hidden worktree: Checkout of `tbd-sync`
  branch for search and writes

- **`.tbd/data-sync/`** on `tbd-sync` branch: Synced entities and attic payload

#### On Main Branch (all working branches)

```
.tbd/
│
│ Committed to the repo:
├── config.yml              # Project configuration
├── .gitignore              # Controls what's gitignored below
├── .gitattributes          # Merge strategies (merge=union for ids.yml)
├── workspaces/             # Persistent state (outbox, named workspaces)
│   ├── outbox/             # Sync failure recovery workspace
│   │   ├── issues/
│   │   ├── mappings/
│   │   └── attic/
│   └── {name}/             # User-created workspaces (backups, bulk edits)
│       ├── issues/
│       ├── mappings/
│       └── attic/
│
│ Gitignored (local only):
├── state.yml               # Per-node sync state
├── docs/                   # Installed documentation (regenerated on setup)
│   ├── shortcuts/
│   │   ├── system/         # Core docs (skill.md, shortcut-explanation.md)
│   │   └── standard/       # Workflow shortcuts (new-plan-spec.md, etc.)
│   ├── guidelines/         # Coding rules and best practices
│   └── templates/          # Document templates
└── backups/                # Legacy local backups
```

#### In `$GIT_COMMON_DIR/tbd/` (local, shared by linked worktrees)

```
$GIT_COMMON_DIR/tbd/
├── layout.yml              # Local layout metadata; uses the same f08 format ID
├── data-sync.epoch         # Local active/quiescent writer epoch for snapshot readers
├── locks/
│   └── data-sync.lock/     # mkdir-based repo-scoped lock
├── backups/                # Repair and migration backups
└── data-sync-worktree/     # Checkout of tbd-sync branch
    └── .tbd/
        └── data-sync/
            ├── issues/
            │   ├── is-a1b2c3.md
            │   └── is-f14c3d.md
            └── ...
```

#### On `tbd-sync` Branch

This is the current f08 tree.
It intentionally excludes the candidate native-comment paths in §2.10; current setup
does not create them.

```
.tbd/
└── data-sync/
    ├── issues/                          # Issue entities (Markdown)
    │   ├── .gitkeep                     # Initial scaffold
    │   └── is-01hx5zzkbkactav9wevgemmvrz.md
    ├── mappings/                        # ID mappings
    │   ├── .gitkeep                     # Initial scaffold
    │   ├── .gitattributes               # ids.yml merge=union
    │   └── ids.yml                      # Short ID → ULID mapping, once populated
    ├── attic/                           # Created when conflict evidence exists
    │   ├── is-..._<timestamp>_<field>.yml
    │   └── conflicts/
    │       └── is-...__<timestamp>.md   # Unrelated-history losing issue snapshot
    ├── bridge/                          # Created only for configured integrations
    │   └── <provider>/
    │       ├── links/<bead-id>.yml
    │       ├── intents/<run-id>.yml
    │       └── users/<provider-user-id>.yml
    └── meta.yml                         # Required schema-version scaffold
```

Only `meta.yml`, `issues/.gitkeep`, `mappings/.gitkeep`, and `mappings/.gitattributes`
are guaranteed in a fresh sync-branch scaffold.
The issue, mapping, attic, and bridge examples appear as their features are used.

> **Future: Simple Mode**—For users who don’t need multi-machine sync, tbd could support
> a “simple mode” where `data-sync/` is committed directly to main instead of using a
> worktree. This would be enabled by removing `data-sync` from `.tbd/.gitignore`. Not
> implemented in the current f08 runtime, but the naming structure supports this future
> option.

**Why this structure?**

- Config on main versions with your code

- Synced data on separate branch avoids merge conflicts on working branches

- Local docs and state are gitignored, never synced

- File-per-entity enables parallel operations without conflicts

- **Hidden worktree enables fast search** via ripgrep/grep

### 2.3 Hidden Worktree Model

tbd maintains one **hidden git worktree** at `$GIT_COMMON_DIR/tbd/data-sync-worktree/`
that checks out the `tbd-sync` branch.
The Git common-dir location is shared by the main checkout and linked worktrees, so
Codex or other agents can run from any checkout without creating competing `tbd-sync`
worktrees. This provides:

1. **Fast search**: ripgrep can search all issues without git plumbing commands

2. **Direct file access**: Read issues without `git show` overhead

3. **Isolated from main**: Doesn’t pollute working directory or affect main branch

4. **Automatic updates**: Updated on `tbd sync` operations

5. **Linked-worktree safety**: One shared sync worktree owns `tbd-sync`, and a
   repo-scoped mkdir lock serializes mutations

#### Worktree Setup

`tbd init` creates the shared worktree.
In an initialized clone where it is missing or prunable, the first ordinary command that
opens the data store materializes it under the shared lock:

```bash
# Create hidden worktree (done by tbd internally)
git worktree add "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree" tbd-sync

# Or if tbd-sync doesn't exist yet
git worktree add --orphan -b tbd-sync "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"
```

**Key properties:**

- **Attached to sync branch**: Worktree is checked out to `tbd-sync` branch so commits
  update the branch ref.
  This ensures `git push` operations can detect new commits.
  A detached or wrong-branch checkout is classified as corrupted.
  Ordinary commands reject it and direct the user to `tbd doctor --fix`.

- **Hidden location**: Inside Git’s common directory, not inside any single checkout

- **Safe updates**: `tbd sync` acquires `$GIT_COMMON_DIR/tbd/locks/data-sync.lock/`
  before mutating the worktree, committing, fetching, merging, or pushing.
  The lock carries a unique owner token, heartbeats while live, and is removed only by
  that owner, so stale-lock recovery cannot make an old holder delete its successor.

#### Worktree Gitignore

The `.tbd/.gitignore` must include:

```gitignore
# Installed documentation (regenerated on setup)
docs/

# Hidden worktree for tbd-sync branch
data-sync-worktree/

# Data sync directory (only exists in worktree)
data-sync/

# Local state
state.yml

# Local backups (corrupted worktrees, migrated data)
backups/

# workspaces/ stores state (including outbox) committed to the working branch
!workspaces/
```

> **Note:** `data-sync/` is gitignored to support potential future “simple mode” where
> issues could be stored directly on main without a worktree.
> In normal operation, `data-sync/` only exists inside the worktree checkout.
> 
> **Note:** Production repair and migration backups under the shared common-dir layout
> live at `$GIT_COMMON_DIR/tbd/backups/`, alongside `layout.yml` and the shared
> `data-sync-worktree/`. The legacy `.tbd/backups/` directory on the main branch is
> gitignored and reserved for historical local backups; current `tbd doctor --fix` and
> migration paths write to the common-dir location.
> Both differ from `.tbd/data-sync/attic/` on the sync branch which stores merge
> conflict losers.
> 
> **Note:** `workspaces/` must not be gitignored—it stores outbox data that must be
> committed to the working branch.

#### .tbd/.gitattributes Contents

The `.tbd/.gitattributes` file configures merge strategies for tbd files.
It is placed inside `.tbd/` (not at the repo root) so all tbd settings are
self-contained. Git supports `.gitattributes` in subdirectories with paths relative to
that directory.

```gitattributes
# Protect ID mappings from merge deletion (always keep all rows)
# See: https://github.com/jlevy/tbd/issues/99
**/mappings/ids.yml merge=union
```

> **Why this is needed:** When a feature branch with outbox changes is merged back to
> main (which has no outbox), git’s 3-way merge can delete `ids.yml` entirely—treating
> “no file” on main as the correct state.
> This causes all tbd commands to crash with “No short ID mapping found”.
> The `merge=union` built-in merge driver keeps all lines from both sides, preventing
> row deletion. Duplicate YAML keys (if any) are tolerated by the parser and auto-fixed
> on next save. See [#99](https://github.com/jlevy/tbd/issues/99) for details.

#### Accessing Issues via Worktree

```bash
WORKTREE="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"

# Files are directly accessible
cat "$WORKTREE/.tbd/data-sync/issues/is-a1b2c3.md"

# ripgrep search across all issues
rg "authentication" "$WORKTREE/.tbd/data-sync/issues/"

# List all issues
ls "$WORKTREE/.tbd/data-sync/issues/"
```

#### Worktree Lifecycle

| Operation | Worktree Action |
| --- | --- |
| `tbd init` | Attach an existing local/remote `tbd-sync`, or create and best-effort publish a fresh orphan when the remote branch is confirmed absent |
| Ordinary data command | Auto-materialize a missing or prunable worktree under the shared lock; reject a corrupted worktree with `tbd doctor --fix` guidance |
| `tbd sync --pull` | Fetch and merge through the shared worktree |
| `tbd sync --push` | Commit and push directly from the attached shared worktree |
| `tbd doctor` | Report worktree health; `--fix` initializes missing state and repairs prunable or corrupted state. The current corrupted-worktree backup defect below is a release blocker |
| Repo clone | Worktree created on the first ordinary data command |

**Invariant:** The hidden worktree at `$GIT_COMMON_DIR/tbd/data-sync-worktree/` always
reflects the current state of the `tbd-sync` branch after sync operations.

#### Worktree Initialization Decision Tree

When an ordinary `tbd` data command needs the store, it ensures the worktree is
initialized. The logic depends on the repository state:

```
START: Ordinary tbd data command
    │
    ├─ Does .tbd/ directory exist?
    │   ├─ NO → Run `tbd init` first (error: "Not a tbd repository")
    │   └─ YES ↓
    │
    ├─ What does checkWorktreeHealth() report?
    │   ├─ VALID → Ensure the data-sync scaffold, then proceed
    │   ├─ CORRUPTED → Fail without removing anything; run `tbd doctor --fix`
    │   └─ MISSING or PRUNABLE ↓
    │
    ├─ Acquire the shared data-sync lock; prune stale worktree registration
    │
    ├─ Does tbd-sync exist locally or remotely?
    │   ├─ YES (local) → git worktree add $GIT_COMMON_DIR/tbd/data-sync-worktree tbd-sync
    │   ├─ YES (remote only) → fetch explicitly into origin/tbd-sync
    │   │                      git worktree add -b tbd-sync ... origin/tbd-sync
    │   ├─ REMOTE CHECK FAILED → fail; do not create a divergent orphan
    │   └─ CONFIRMED ABSENT → Create and scaffold a fresh orphan worktree
    │           (Best-effort push when a remote is configured; adopt the winner if
    │            another initializer won the race, or fail loudly if adoption is unsafe)
    │
    └─ Worktree ready, proceed with command
```

**Scenarios:**

| Repository State | Worktree Action |
| --- | --- |
| Fresh `tbd init` | Create and scaffold an orphan worktree; immediately attempt to publish it when a remote is configured |
| Clone with a missing worktree | The first ordinary data command fetches and creates the worktree automatically |
| Registered worktree whose directory was removed | The first ordinary data command prunes and recreates it automatically |
| Existing local worktree corrupted | Ordinary commands fail closed; `tbd doctor --fix` attempts a backup, removes it, and recreates it. See the release blocker below |
| Worktree exists but stale | `tbd sync` updates to latest commit |

#### Worktree Health States

The worktree can be in one of four states, detected by `checkWorktreeHealth()`:

| State | Description | Detection | Recovery |
| --- | --- | --- | --- |
| `valid` | Healthy, ready to use | Directory has a live registration, a valid `.git` link, and an attached `HEAD` on the configured sync branch | None needed |
| `missing` | Directory doesn’t exist and Git has no live registration | Filesystem and worktree-registry checks | Auto-create from the local or remote branch on the next ordinary data command |
| `prunable` | Directory was deleted but Git still tracks it | `git worktree list --porcelain` shows prunable | Auto-prune and recreate on the next ordinary data command |
| `corrupted` | Directory exists but is unregistered, invalid, detached, or on the wrong branch | Filesystem, `.git`, registry, `HEAD`, and branch checks | Fail closed; `tbd doctor --fix` attempts a backup, then removes and recreates the directory. See the release blocker below |

**Release blocker: backup before removal (`tbd-dmkd`).** A corrupted worktree may still
contain uncommitted issue data.
The required behavior is to finish a verified backup in
`$GIT_COMMON_DIR/tbd/backups/corrupted-worktree-backup-<timestamp>/` before removing the
occupant.

The shipped `tbd doctor --fix` implementation attempts that copy, but catches a copy
failure, continues with recursive removal, and still reports the intended backup path.
It therefore does not currently guarantee backup-before-delete or prevent data loss.
`tbd-dmkd` is a P0 release blocker for that guarantee.

**Detection algorithm:** `checkWorktreeHealth()` first inspects the worktree registry so
it can distinguish a missing checkout from a prunable registration.
A directory that exists without a matching registration is corrupted.
For a registered checkout, it validates the `.git` link, resolves `HEAD`, and requires
the configured sync branch; detached or wrong-branch checkouts are corrupted rather than
silently repurposed.

#### Path Terminology and Resolution

**Critical distinction:**

| Term | Path | Purpose |
| --- | --- | --- |
| **Worktree path** | `$GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/` | **Production path**—inside hidden worktree checkout |
| **Direct path** | `.tbd/data-sync/` | **Legacy fallback path**—gitignored on main, should NEVER contain data in production |

**Invariant:** In production, the worktree path is the ONLY correct path for issue data.
The direct path exists ONLY for test fixtures that don’t use git.

**Path resolution semantics:**

```typescript
withDataSyncContext(tbdRoot, { lock }, async (context) => {
  // The context probe validates config, common-dir layout, worktree health,
  // and the data-sync scaffold before exposing context.dataSyncDir.
});

// Inside context preparation, under the shared lock when repair is needed:
if (health.status === 'missing' || health.status === 'prunable') {
  await repairWorktree(tbdRoot, health.status, remote, syncBranch);
} else if (health.status === 'corrupted') {
  throw new Error("Run 'tbd doctor --fix' to repair");
}

const dataSyncDir = await resolveDataSyncDir(tbdRoot, { allowFallback: false });
```

**Rules:**

1. Ordinary commands enter through `withDataSyncContext()`; writers always hold the
   shared lock, while readers take it only when initialization, migration, or repair is
   required.
2. Production path resolution uses `allowFallback: false` after context preparation.
   Only tests and diagnostics may use the direct-path fallback.
3. A missing or prunable worktree is ordinary recoverable state.
   A corrupted worktree requires explicit `tbd doctor --fix` because it may contain
   uncommitted data.
4. If `.tbd/data-sync/issues/` contains data on the main branch, this indicates a bug:
   data was written to the wrong location because the worktree was missing.

#### Worktree Errors

`resolveDataSyncDir(..., {allowFallback: false})` retains a narrow
`WorktreeMissingError` for callers that bypass context preparation.
Ordinary command paths repair missing and prunable states before resolution.
Corruption is reported by the context layer with `tbd doctor --fix` guidance, without a
destructive automatic repair.

### 2.4 Workspaces

Workspaces are directories under `.tbd/workspaces/` that store issue data for sync
failure recovery, backups, and bulk editing workflows.

> **Note:** `.tbd/workspaces/` must not be gitignored—outbox data must be committed to
> the working branch.

#### Workspace Structure

Each workspace mirrors the `data-sync` directory structure:

```
.tbd/workspaces/{name}/
├── issues/           # Issue files (same format as data-sync)
├── mappings/
│   └── ids.yml       # ID mappings (union with worktree)
└── attic/            # Conflicts during workspace operations
```

#### Commands

| Command | Description |
| --- | --- |
| `tbd save --workspace=<name>` | Save issues from worktree to workspace |
| `tbd save --outbox` | Shortcut for `--workspace=outbox --updates-only` |
| `tbd save --dir=<path>` | Save to arbitrary directory |
| `tbd import --workspace=<name>` | Import issues from workspace to worktree |
| `tbd import --outbox` | Shortcut for `--workspace=outbox --clear-on-success` |
| `tbd workspace list` | List all workspaces with issue counts by status |
| `tbd workspace delete <name>` | Delete a workspace |

#### Sync Failure Recovery Workflow

When `tbd sync` fails to push (network errors, permission issues, branch restrictions):

```bash
# 1. Save unsynced changes
tbd save --outbox

# 2. Commit to working branch (which typically succeeds)
git add .tbd/workspaces && git commit -m "tbd: save outbox" && git push

# 3. Later, when sync works again
tbd import --outbox
tbd sync
```

#### Merge Behavior

When saving or importing, issues are merged using `mergeIssues()`:

- **New issues**: Copied directly
- **Existing issues**: Three-way merge with LWW conflict resolution
- **Conflicts**: Lost values saved to attic
- **ID mappings**: Union operation (add new, don’t overwrite existing)

See `tbd shortcut sync-failure-recovery` for detailed workflow documentation.

### 2.5 Entity Collection Pattern

The current f08 repository format has one public entity type: issues.
The codebase also contains an internal native-comment model and preservation-planning
foundation, but no current command or repository setup activates it.
Section 2.10 defines that candidate collection and its rollout boundary.
Agent registries, workflows, and templates remain future entity types.

#### Directory Layout

| Collection | Directory | Extension | ID Prefix | Status |
| --- | --- | --- | --- | --- |
| Issues | `.tbd/data-sync/issues/` | `.md` | `is-` | Active in f08 |
| Native comments | `.tbd/data-sync/comments/<shard>/` | `.md` | `cm-` | Candidate f09; internal and dormant |

#### Adding New Entity Types (Future)

Adding an entity type requires more than a schema and directory:

1. Define its identity, schema, canonical bytes, and storage paths.
2. Specify whether records are mutable and how concurrent Git histories reconcile.
3. Preserve every accepted and invalid record through sync, workspace, outbox, import,
   repair, and unrelated-history paths.
4. Add bounded readers, diagnostics, commands, and tests.
5. Gate older clients before any newly meaningful path can be created.

Git can transfer unknown files without understanding their schemas, but tbd operations
that copy, stage, merge, repair, or clear a data-sync tree must explicitly preserve a
new collection. Section 2.10 shows this requirement for native comments.

### 2.6 ID Generation

tbd uses a **dual ID system** to balance machine requirements (sorting, uniqueness) with
human usability (short, memorable):

| ID Type | Format | Example | Purpose |
| --- | --- | --- | --- |
| **Internal** | `{type}-{ulid}` | `is-01hx5zzkbkactav9wevgemmvrz` | Storage, sorting, dependencies |
| **External** | `{project}-{short}` | `proj-a7k2` | CLI, docs, commits, references |

**Internal IDs** use [ULID](https://github.com/ulid/spec) (Universally Unique
Lexicographically Sortable Identifier):

- **Fixed prefix**: Entity type discriminator (`is-` for issues and `cm-` for candidate
  native comments)
- **ULID body**: 26 lowercase characters (48-bit timestamp + 80-bit randomness)
- **Lexicographic sorting**: IDs sort chronologically by creation time
- **Collision resistance**: A process-local monotonic factory orders IDs minted in the
  same millisecond; 80 random bits make independent-writer collisions negligible

**External IDs** use short alphanumeric codes mapped to internal IDs:

- **Required prefix**: Project-specific (e.g., `proj`, `myapp`, `tk`) via
  `display.id_prefix`
  - Set during `tbd init --prefix=<name>` or automatically from beads import
  - Recommended: 2-8 alphabetic characters (use `--force` for other formats)
  - Hard grammar: 1-20 lowercase characters; starts with a letter; contains letters,
    digits, dots, or underscores; ends with a letter or digit
  - Must not contain dashes (would conflict with ID separator)
- **Short code**: New IDs use base36; imported IDs may also contain dots, underscores,
  or dashes
  - Imported issues: Preserve original short ID (e.g., `100` from `tbd-100`)
  - New issues: Generate random 4-char base36
- **Append-oriented mapping**: Normal writes retain existing assignments, while
  deterministic collision repair can reassign a displaced issue’s public short ID
- **No prefix matching**: Users type the full short ID, always

#### ID Generation Algorithm

```typescript
import { ulid } from 'ulid';

// Generate internal ID (ULID-based)
function generateInternalId(prefix: string = 'is'): string {
  return `${prefix}-${ulid().toLowerCase()}`;
  // e.g., "is-01hx5zzkbkactav9wevgemmvrz"
}

// Generate external short ID (base36)
function generateShortId(): string {
  // 4 base36 chars = 1.7M possibilities, 5 chars = 60M
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)];
  }
  return result; // e.g., "a7k2"
}
```

**Properties:**

- **Time-ordered**: ULIDs encode creation timestamp, enabling chronological sort by ID
- **Process-local monotonicity**: One process generates strictly increasing ULIDs within
  a millisecond; separate processes rely on the random component for collision
  resistance
- **Human-friendly**: Short IDs are easy to type, say, and remember
- **Deterministic sorting**: Alphabetical sort = chronological order

#### ID Mapping

The mapping between external and internal IDs is stored in
`.tbd/data-sync/mappings/ids.yml`:

```yaml
# .tbd/data-sync/mappings/ids.yml
# short_id: ulid (without prefix)
#
# Imported issues preserve their original short IDs:
100: 01hx5zzkbkactav9wevgemmvrz # from tbd-100
101: 01hx5zzkbkbctav9wevgemmvrz # from tbd-101
1823: 01hx5zzkbkcdtav9wevgemmvrz # from tbd-1823
#
# New issues get random 4-char base36 IDs:
a7k2: 01hx5zzkbkdetav9wevgemmvrz
b3m9: 01hx5zzkbkeetav9wevgemmvrz
```

**Mapping properties:**

- **Synced**: File lives on sync branch, shared across all machines
- **Append-oriented entries**: Normal writes keep existing rows.
  Collision recovery can replace the public short ID of a displaced ULID
- **ID preservation**: Imports preserve original short IDs (no separate beads.yml
  needed) when that short ID is available
- **Merge strategy**: Git’s union driver preserves rows, including duplicate YAML keys
  created when independent writers allocate the same short ID
- **Merged collision handling**: At load time the lexicographically smallest ULID keeps
  a contested short ID; each displaced ULID receives a deterministic replacement, which
  is saved on the next write
- **Orphan mapping-row collision handling**: If the desired short ID is present only in
  the mapping file and its issue file is absent, explicit import allocates a new short
  ID for the incoming issue
- **Occupied issue defect**: If a loaded unrelated issue owns the desired short ID, the
  importer currently reuses that issue’s ULID and can overwrite its file.
  This is the `tbd-0oz8` release-safety blocker described in §5.1.3

#### ID Resolution (CLI)

When a user provides an ID:

```typescript
async function resolveId(input: string, storage: Storage): Promise<string> {
  const mapping = await storage.loadIdMapping();
  // Imported short IDs may contain a dash. Exact stored IDs win before the
  // shared display-prefix grammar strips a syntactic prefix.
  const shortId = mapping.has(input) ? input : splitPrefixedDisplayId(input)?.shortId ?? input;
  const ulid = mapping.get(shortId);

  if (!ulid) {
    throw new CLIError(`Issue not found: ${input}`);
  }

  return `is-${ulid}`; // Return full internal ID
}
```

**No prefix matching**: Unlike abbreviated git object names, tbd display IDs are written
in full in documentation, commit messages, and external systems.
Prefix matching would cause ambiguity as more issues are created.
Users always type the full display ID. The internal ULID is stable, but deterministic
collision repair can reassign the rare displaced public short ID as described in §2.6.

#### File Naming

Issue files use the full internal ID:

```
.tbd/data-sync/issues/is-01hx5zzkbkactav9wevgemmvrz.md
```

**Why ULID in filename?**

- Files sort chronologically in directory listings
- Git diffs show changes in creation order
- No lookup needed to determine file path from internal ID

#### Display Format

```typescript
function formatDisplayId(internalId: string, config: Config): string {
  const ulid = internalId.replace(/^is-/, '');
  const shortId = config.idMapping.getShortId(ulid);
  const prefix = config.display.id_prefix; // Required, no default
  return `${prefix}-${shortId}`; // e.g., "proj-a7k2"
}
```

**CLI flow example (imported issue):**

```
User types:     proj-100 (or original beads ID like tbd-100)
Lookup:         100 → 01hx5zzkbkactav9wevgemmvrz
Internal ID:    is-01hx5zzkbkactav9wevgemmvrz
File path:      .tbd/data-sync/issues/is-01hx5zzkbkactav9wevgemmvrz.md
Display back:   proj-100
```

**CLI flow example (new issue):**

```
User types:     proj-a7k2
Lookup:         a7k2 → 01hx5zzkbkdetav9wevgemmvrz
Internal ID:    is-01hx5zzkbkdetav9wevgemmvrz
File path:      .tbd/data-sync/issues/is-01hx5zzkbkdetav9wevgemmvrz.md
Display back:   proj-a7k2
```

#### Type-Safe ID Handling (Branded Types)

To prevent accidentally mixing internal and display IDs at compile time, tbd uses
TypeScript branded types:

```typescript
// Branded type for internal IDs (stored in files)
declare const InternalIssueIdBrand: unique symbol;
export type InternalIssueId = string & { [InternalIssueIdBrand]: never };

// Branded type for display IDs (shown to users)
declare const DisplayIssueIdBrand: unique symbol;
export type DisplayIssueId = string & { [DisplayIssueIdBrand]: never };

// Helper functions for type casting
export function asInternalId(id: string): InternalIssueId;
export function asDisplayId(id: string): DisplayIssueId;
```

**Usage guidelines:**

| Context | Use Type | Example |
| --- | --- | --- |
| `parent_id`, `dependencies`, `child_order_hints` | `InternalIssueId` | `is-01hx5zzkbk...` |
| Storage, file operations | `InternalIssueId` | Reading/writing issue files |
| CLI output, tree views | `DisplayIssueId` | `proj-a7k2` |
| User input (after resolution) | `InternalIssueId` | `resolveToInternalId()` returns this |

**Benefits:**

- **Compile-time safety**: TypeScript errors if you pass wrong ID type to a function
- **Self-documenting**: Function signatures clarify which ID format is expected
- **Refactoring safety**: Changing ID handling shows all affected call sites

### 2.7 Schemas

Schemas are defined in Zod (TypeScript).
Other languages should produce equivalent YAML/Markdown output.

#### 2.7.1 Common Types

```typescript
import { z } from 'zod';

// ISO8601 timestamp
const Timestamp = z.string().datetime();

// Internal Issue ID: is-{ulid} where ULID is 26 lowercase chars
// Example: is-01hx5zzkbkactav9wevgemmvrz
const InternalIssueId = z.string().regex(/^is-[0-9a-z]{26}$/);

// Short ID: 1+ lowercase alphanumeric, dot, underscore, or dash characters
// (used in external/display IDs)
// For imports: preserved from source (e.g., "100" from "tbd-100")
// For new issues: random 4-char base36 (e.g., "a7k2")
const ShortId = z.string().regex(/^[0-9a-z._-]+$/);

// External Issue ID input: accepts {prefix}-{short} or just {short}.
// Prefixes are 1-20 lowercase characters, start with a letter, may contain
// alphanumerics, dots, or underscores, and end with an alphanumeric. Hyphen is
// reserved as the prefix separator. Imported short IDs may contain separators
// but cannot end with a hyphen.
// Example: bd-100, e2e-a7k2, proj.v2-stat-in_progress, 100, a7k2
const ExternalIssueIdInput = z.string().regex(
  /^(?:[a-z](?:[a-z0-9._]{0,18}[a-z0-9])?-)?[0-9a-z._-]*[0-9a-z._]$/,
);

// Edit counter - incremented on every local change
// IMPORTANT: Version is NOT used for conflict detection (Git history is used).
// Version is informational only, used for:
// - Debugging: track how many times an entity was edited
// - Merge bookkeeping: bump max(local, remote) + 1 only for a substantive merge result
// - Display: show edit count to users
const Version = z.number().int().nonnegative();

// Entity type discriminator
const EntityType = z.literal('is');
```

> **Version Field Clarification:** The `version` field is **purely informational**. It
> is incremented on every local change but is NOT used to detect conflicts.
> Conflict detection uses **Git history and ref comparison** (see §3.4), with push
> rejection closing the race in which the remote advances after fetch.
> This avoids the distributed systems problem where version numbers can diverge when two
> nodes edit independently.
> The version is useful for debugging ("how many times was this edited?") and is set to
> `max(local, remote) + 1` only when the merge produces substantive state different from
> the highest-version input.
> Otherwise that input and its version are retained unchanged.

#### 2.7.2 BaseEntity

All entities share common fields:

```typescript
const BaseEntity = z.object({
  type: EntityType, // Always "is" for issues
  id: IssueId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,

  // Extensibility namespace for third-party data
  extensions: z.record(z.string(), z.unknown()).optional(),
});
```

> **Note on `extensions`**: The `extensions` field provides a namespace for third-party
> tools, bridges, and custom integrations to store metadata without modifying core
> schemas. Keys should be namespaced (e.g., `github`, `slack`, `my-tool`). Unknown
> extensions are preserved during sync and merge (pass-through).
> 
> Example (in YAML front matter):
> 
> ```yaml
> extensions:
>   github:
>     issue_number: 123
>     synced_at: 2025-01-07T10:00:00Z
>   my-tool:
>     custom_field: value
> ```

#### 2.7.3 IssueSchema

```typescript
const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const IssueResolution = z.enum(['completed', 'canceled', 'duplicate']);
const IssueHold = z.enum(['blocked', 'paused']);
const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);
const Priority = z.number().int().min(0).max(4);

const Dependency = z.object({
  type: z.literal('blocks'),
  target: IssueId,
});

const IssueDoc = z.object({
  path: z.string().min(1),
  role: z.string().min(1).nullable().optional(),
  title: z.string().min(1).nullable().optional(),
});

const IssueRef = z.object({
  kind: z.string().min(1),
  url: z.string().min(1),
  title: z.string().min(1).nullable().optional(),
  at: Timestamp.nullable().optional(),
});

const IssueDeclaredShape = BaseEntity.extend({
  type: z.literal('is'),

  title: z.string().min(1).max(500),
  description: z.string().max(50000).nullable().optional(),
  notes: z.string().max(50000).nullable().optional(),

  kind: IssueKind.default('task'),
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  // Linkages
  spec_path: z.string().nullable().optional(),
  docs: z.array(IssueDoc).optional(),
  refs: z.array(IssueRef).optional(),

  // Accountability and current actor are separate axes
  assignee: z.string().nullable().optional(),
  delegate: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  parent_id: IssueId.nullable().optional(),
  child_order_hints: z.array(IssueId).nullable().optional(),

  // Scheduling and holds
  due_date: Timestamp.nullable().optional(),
  deferred_until: Timestamp.nullable().optional(),
  hold: IssueHold.nullable().optional(),
  hold_until: Timestamp.nullable().optional(),

  // Provenance and lifecycle
  created_by: z.string().nullable().optional(),
  started_at: Timestamp.nullable().optional(),
  closed_at: Timestamp.nullable().optional(),
  close_reason: z.string().nullable().optional(),
  resolution: IssueResolution.nullable().optional(),
  duplicate_of: IssueId.nullable().optional(),
}).passthrough();

const IssueSchema = IssueDeclaredShape.superRefine((issue, ctx) => {
  // resolution is valid only on closed work
  // duplicate requires duplicate_of, and duplicate_of requires duplicate
  // hold is invalid on closed work
  // hold_until is valid only with hold: paused
});

type Issue = z.infer<typeof IssueSchema>;
```

The source schema’s `superRefine` contains the four stated lifecycle checks and produces
field-specific validation errors.
The abbreviated body above omits only that repetitive error construction.
`.passthrough()` is load-bearing in f08: it preserves fields from a newer compatible
writer. The merge engine applies a documented LWW fallback to those unknown keys rather
than dropping them.

**Design notes:**

- `status`: Matches Beads statuses (open, in_progress, blocked, deferred, closed)

- `kind`: Matches Beads types (bug, feature, task, epic, chore).
  Note: CLI uses `--type` flag for Beads compatibility, which maps to the `kind` field
  internally.

- `priority`: 0 (highest/critical) to 4 (lowest), matching Beads

- `notes`: Working notes field for agents to track progress (Beads parity)

- `assignee` and `delegate`: `assignee` records who is accountable; `delegate` records
  who is currently acting.
  `tbd start` writes `delegate` without changing `assignee`.

- `docs` and `refs`: Supporting repository documents union by `path`; external
  references union by `url`. They are independent of the singular, inherited `spec_path`
  and of provider identity under `extensions`.

- `hold` / `hold_until`, `started_at`, `resolution` / `duplicate_of`: Separate current
  lifecycle position from why nonterminal work is waiting, when work first began, and
  why terminal work ended.
  The schema rejects contradictory combinations.

- `spec_path`: Optional path to related specification/documentation file (relative to
  repo root). Supports gradual path matching for flexible lookups - queries can match by
  filename only, partial path suffix, or exact path.
  Used for spec-first workflows where planning documents are created before
  implementation beads.

  **Path Validation and Normalization:** When setting spec_path via CLI (`--spec`),
  paths are validated and normalized:
  - File must exist at create/update time
  - Paths outside project root are rejected
  - Absolute paths within project are converted to relative
  - Relative paths from subdirectories are resolved to project root
  - Path separators are normalized (backslashes → forward slashes)
  - Leading `./` is removed

  This ensures consistent storage regardless of how the path was specified.

  **Inheritance from Parent:** When creating a child issue with `--parent` and no
  explicit `--spec`, the child automatically inherits the parent’s `spec_path`. When a
  parent’s `spec_path` is updated, the new value propagates to all children whose
  `spec_path` was null or matched the parent’s old value (i.e., was inherited).
  Children with explicitly different `spec_path` values are not affected.
  Re-parenting a child (via `tbd update --parent`) also inherits the new parent’s
  `spec_path` if the child has no existing `spec_path`.

- `child_order_hints`: Optional array of internal IssueIds specifying preferred display
  order for children of this issue.
  Used by `tbd list --pretty` to control child ordering in tree views.

  **Soft hints model:** This is a “hints” approach rather than strict ordering:
  - May contain stale IDs (deleted or re-parented issues) - silently ignored
  - May be incomplete (not all children listed) - unlisted children appear after hinted
    ones
  - No automatic cleanup when children change

  **Auto-population:** When a child is assigned to a parent via `--parent`, the child’s
  internal ID is automatically appended to the parent’s `child_order_hints`.

  **Manual control:** Use `tbd update <id> --child-order <ids>` to set the full ordering
  list. Use `--child-order ""` to clear.

  **Display:** Use `tbd show <id> --show-order` to view current hints.

- `dependencies`: Only “blocks” type for now (affects `ready` command)

- `labels`: Arbitrary string tags

- `due_date` / `deferred_until`: Beads compatibility fields.
  Stored as full ISO8601 datetime.
  CLI accepts flexible input:
  - Full datetime: `2025-02-15T10:00:00Z`

  - Date only: `2025-02-15` (normalized to `2025-02-15T00:00:00Z` UTC)

  - Relative: `+7d` (7 days from now), `+2w` (2 weeks)

**Notes on tombstone status:**

Beads has a `tombstone` status for soft-deleted issues.
In tbd, we handle deletion differently:

- Closed issues remain in `issues/` directory with `status: closed`

- Hard deletion moves the file to `attic/deleted/`

- No `tombstone` status needed

#### 2.7.4 ConfigSchema

Project configuration stored in `.tbd/config.yml`:

```yaml
# .tbd/config.yml
tbd_format: f08
tbd_version: '0.8.1'
tbd_fallback_version: '0.8.1'
tbd_upgrades:
  - version: '0.8.1'
    at: '2026-09-10T00:00:00.000Z'

sync:
  branch: tbd-sync # Branch name for synced data
  remote: origin # Remote repository
  storage: git-common-dir-v1

# Display settings
display:
  id_prefix: proj # Required: project-specific prefix (set during init or import)

# Runtime settings
settings:
  auto_sync: false # Reserved; not applied to issue writes (they stage locally; run `tbd sync`)
  doc_auto_sync_hours: 24
  use_gh_cli: true

# Optional docs_cache and integrations blocks may follow.
```

```typescript
const ConfigSchema = z.object({
  tbd_format: z.string(),
  tbd_version: z.string(),
  tbd_fallback_version: z.string().optional(),
  tbd_upgrades: z.array(UpgradeEntrySchema).default([]),
  sync: z
    .object({
      branch: z.string().default('tbd-sync'),
      remote: z.string().default('origin'),
      storage: SyncStorage.default('git-common-dir-v1'),
    })
    .default({}),
  display: z.object({
    id_prefix: z.string(), // Required: set during init or auto-detected from beads import
  }),
  settings: z
    .object({
      auto_sync: z.boolean().default(false), // reserved; issue writes stage locally
      doc_auto_sync_hours: z.number().default(24),
      use_gh_cli: z.boolean().default(true),
    })
    .default({}),
  docs_cache: DocsCacheSchema.optional(),
  integrations: IntegrationsConfigSchema.optional(),
}).passthrough();
```

> **Forward Compatibility Policy:** As of repository format `f07`, `ConfigSchema` uses
> Zod’s `passthrough()` mode at the top level.
> Current repositories use f08; f07 identifies when this config-preservation guarantee
> first became mandatory.
> The `integrations` block and its provider objects are passthrough too.
> Unknown keys in those locations therefore survive an older f07-or-later client
> rewriting `config.yml`.
> 
> 1. A purely additive top-level config block, or an additive key inside an explicitly
>    passthrough integration/provider object, does not by itself require another format
>    bump once the repository is on f07.
> 2. Bump the format for removals, renames, semantic changes, or additions inside a
>    nested schema that still strips unknown keys whenever an older supported client
>    could lose or misinterpret data.
> 3. Pre-f07 clients still parse in strip mode.
>    The f07 gate makes those clients fail before they can rewrite configuration, with
>    an instruction to upgrade via `npm install -g get-tbd@latest`.
> 
> This preserves future additive configuration while keeping destructive or semantic
> changes behind an explicit, migratable compatibility gate.
> See `tbd-format.ts` for format version history and `config.ts` for the compatibility
> check via `isCompatibleFormat()`.
> 
> For the rules that govern adding a new format (idempotent migration, write order,
> signing-agnostic commits, doctor recovery contract), see the project-local
> [docs/tbd-format-versioning.md](../../../docs/tbd-format-versioning.md) contributor
> guide.

#### 2.7.5 MetaSchema

Shared metadata stored in `.tbd/data-sync/meta.yml` on the sync branch:

```typescript
const MetaSchema = z.object({
  schema_version: z.number().int(),
  created_at: Timestamp,
});
```

**Current scaffold/schema mismatch (`tbd-1cn1`).** `MetaSchema` requires both fields,
but fresh worktree scaffolding currently writes only `schema_version: 1`. The current
runtime does not validate that scaffold through `MetaSchema`, so repositories operate
with the shorter file.
`tbd-1cn1` tracks aligning the scaffold and schema; this document does not promise a
synthesized `created_at` until that defect is fixed.

> **Note**: Machine-specific timing markers do not belong in synced `meta.yml`, where
> routine updates would create a conflict hotspot.
> `.tbd/state.yml` is the gitignored local store, but its current `last_sync_at`
> producer is defective as described below.

#### 2.7.6 LocalStateSchema

Per-node state stored in `.tbd/state.yml` (gitignored, never synced).
Each machine maintains its own local state:

```typescript
const LocalStateSchema = z.object({
  last_sync_at: Timestamp.optional(),
  last_doc_sync_at: Timestamp.optional(),
  welcome_seen: z.boolean().optional(),
  agent_id: z.string().optional(),
  agent_name: z.string().optional(),
});
```

These fields are machine-local session and timing state.
Keeping them out of the sync branch avoids a shared write hotspot.

`last_sync_at` does not currently prove that Git synchronization succeeded.
The search command writes it when its five-minute freshness check fires without fetching
or pulling anything.
`tbd-iwup` tracks replacing that false freshness signal with real observation.

> **Future extensions:** Additional fields like `node_id`, `last_synced_commit` (for
> incremental sync), or separate `last_push`/`last_pull` timestamps may be added as
> needed.

#### 2.7.7 AtticEntrySchema

Preserved conflict losers:

```typescript
const AtticEntrySchema = z.object({
  entity_id: IssueId,
  timestamp: Timestamp,
  field: z.string(),
  lost_value: z.string(),
  winner_source: z.enum(['local', 'remote']),
  loser_source: z.enum(['local', 'remote']),
  context: z.object({
    local_version: Version,
    remote_version: Version,
    local_updated_at: Timestamp,
    remote_updated_at: Timestamp,
  }),
});
```

### 2.8 Relationship Types

tbd supports two distinct types of relationships between issues: **parent-child**
(hierarchical containment) and **dependencies** (blocking relationships).
This section documents the model, compares it to Beads, and explains the design
rationale.

#### 2.8.1 Relationship Model Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TBD RELATIONSHIP MODEL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PARENT-CHILD (Containment)              DEPENDENCIES (Ordering)            │
│  ─────────────────────────               ──────────────────────             │
│  Field: parent_id                        Field: dependencies[]              │
│  Meaning: "Part of" / "Subtask of"       Meaning: "Blocks" / "Related to"   │
│  Affects ready queue: NO                 Affects ready queue: YES (blocks)  │
│                                                                             │
│     ┌─────────┐                             ┌─────────┐                     │
│     │  Epic   │                             │ Task A  │                     │
│     │         │                             │         │                     │
│     └────┬────┘                             └────┬────┘                     │
│          │ parent_id                             │ dependencies:            │
│     ┌────┴────┐                                  │   type: blocks           │
│     │  Task   │ ← Can be READY                   │   target: B              │
│     │         │   (parent doesn't block)    ┌────▼────┐                     │
│     └─────────┘                             │ Task B  │ ← BLOCKED           │
│                                             │         │   (until A closes)  │
│                                             └─────────┘                     │
│                                                                             │
│  Use case: Organize work into epics,     Use case: Enforce execution order, │
│  group related tasks                     track soft relationships           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2.8.2 Parent-Child Relationships

Parent-child relationships use the `parent_id` field for hierarchical organization:

```yaml
# Child issue
id: is-01hx5zzkbkactav9wevgemmvrz
title: Implement OAuth login
parent_id: is-01hx5zzkbkbctav9wevgemmvrz # Points to parent epic
```

**Key properties:**

- **Non-blocking**: A child can be in `ready` state even if its parent is open
- **Organizational**: Used for grouping tasks under epics or features
- **Single parent**: Each issue can have at most one parent
- **Visualized by**: `tbd list --pretty`, `tbd list --parent <id>`
- **Context inheritance**: `tbd show` auto-displays parent context for child issues, so
  child descriptions don’t need to duplicate the parent’s context (suppress with
  `--no-parent`)

**Commands:**

```bash
# Create with parent
tbd create "Implement OAuth" --parent proj-a1b2

# Set parent on existing issue
tbd update proj-c3d4 --parent proj-a1b2

# List children of a parent
tbd list --parent proj-a1b2
```

**Child ordering:**

When displaying children under a parent, tbd uses `child_order_hints` to control display
order. This provides soft ordering hints - the parent suggests a display order for its
children.

```bash
# Reorder children explicitly (replaces all hints)
tbd update proj-a1b2 --child-order proj-c3d4,proj-e5f6,proj-g7h8

# View current ordering
tbd show proj-a1b2 --show-order
```

**Ordering behavior:**

- **Auto-population**: When setting `--parent` on create/update, the child is
  automatically appended to the parent’s `child_order_hints`
- **Manual control**: Use `--child-order` to set explicit ordering
- **Soft hints**: Hints may contain stale IDs (removed children); display logic filters
  for actual children only
- **Fallback**: Children not in hints are sorted by priority, then ID
- **Tree view**: `tbd list --pretty` respects hint ordering within each parent’s
  children

#### 2.8.3 Dependency Relationships

Dependencies use the `dependencies` array for ordering and linking:

```yaml
dependencies:
  - type: blocks
    target: is-01hx5zzkbkbctav9wevgemmvrz
```

**Supported dependency types:**

| Type | Affects Ready? | Use Case |
| --- | --- | --- |
| `blocks` | **Yes** | “This issue must close before target can proceed” |
| `related` | No | Soft link: “See also” references (future) |
| `discovered-from` | No | Provenance: “Found while working on X” (future) |

**Commands:**

```bash
# Add blocking dependency: A blocks B (B can't proceed until A closes)
tbd dep add proj-a1b2 proj-c3d4

# List what an issue blocks / is blocked by
tbd dep list proj-a1b2

# Remove dependency
tbd dep remove proj-a1b2 proj-c3d4
```

#### 2.8.4 Visualization Commands

Each relationship type has dedicated visualization:

| Command | Shows | Data Source |
| --- | --- | --- |
| `tbd list --pretty` | Parent-child hierarchy tree | `parent_id` field |
| `tbd list --parent <id>` | Children of a specific issue | `parent_id` field |
| `tbd blocked` | Issues blocked + their blockers | `dependencies[].type: blocks` |
| `tbd ready` | Open, unheld, undelegated work whose deferral elapsed | Excludes work with a non-closed blocker |
| `tbd dep tree <id>` | Blocking dependency chain | `dependencies[].type: blocks` (future) |
| `tbd list --format dot` | Full graph (Graphviz) | All relationships |

#### 2.8.5 Comparison with Beads

tbd and Beads have different models for parent-child relationships:

| Aspect | tbd | Beads |
| --- | --- | --- |
| Parent-child storage | `parent_id` field | `dependencies[].type: parent-child` |
| Parent-child blocking | **No** (organizational only) | **Transitive** (inherits parent’s blocked state) |
| Dependency types | `blocks` only (more planned) | `blocks`, `parent-child`, `related`, `discovered-from`, + more |

**Understanding Beads’ parent-child behavior:**

In Beads, `parent-child` is listed as affecting ready work:

```go
// Beads: AffectsReadyWork includes parent-child
func (d DependencyType) AffectsReadyWork() bool {
  return d == DepBlocks || d == DepParentChild || ...
}
```

However, this does NOT mean children are blocked until their parent closes.
The actual behavior (from `attic/beads/internal/storage/sqlite/blocked_cache.go`) is
**transitive blocking**:

1. Only `blocks` (and similar types) can DIRECTLY block an issue
2. `parent-child` PROPAGATES blockage: if a parent is blocked, children inherit that
   blockage

So in Beads:

- Creating a task under an open epic does NOT block the task
- If the epic itself becomes blocked (by a `blocks` dependency), children are
  transitively blocked
- If the epic is open (not blocked), children CAN be ready to work on

**tbd’s simpler model:**

tbd separates these concepts entirely:

- **`parent_id`**: Organizational containment (non-blocking, no transitive effects)
- **`blocks`**: Temporal ordering (blocking)

This is simpler because:

```
Epic: "Build Auth System" (open)
├── Task: "Design UI" (open, READY)      ← Can work on this
├── Task: "Implement OAuth" (open, READY) ← Can work on this
└── Task: "Write tests" (blocked by OAuth) ← Must wait for OAuth
```

In tbd, blocking is explicit via `blocks` dependencies only.
There’s no transitive blocking through the parent-child hierarchy.
This makes the blocking model easier to reason about.

#### 2.8.6 Future Dependency Types

Based on real-world Beads usage data (from Beads’ own issue tracker):

| Type | Beads Usage | Priority | Notes |
| --- | --- | --- | --- |
| `blocks` | 47% (156 uses) | ✅ Supported | Core workflow |
| `parent-child` | 42% (140 uses) | ✅ Via `parent_id` | Different model (non-blocking) |
| `discovered-from` | 11% (37 uses) | 🔜 High | Useful for provenance tracking |
| `related` | <1% (2 uses) | ⏳ Low | Rarely used in practice |

Planned additions:

- **`discovered-from`**: Track issue provenance when work reveals new issues
- **`related`**: Soft links for “see also” references

#### 2.8.7 Future: Transitive Blocking Option

**Current design:** `parent_id` is purely organizational with no blocking effects.
Blocking is explicit via `blocks` dependencies only.

**Potential future enhancement:** Add opt-in transitive blocking through parent-child
hierarchy, similar to Beads’ model.

**How it would work:**

```yaml
# .tbd/config.yml
blocking:
  transitive_parent_child: true # default: false
```

When enabled:

- If a parent epic is blocked (by a `blocks` dependency), children inherit that blockage
- Children are NOT blocked just because their parent is open
- Closing the blocker on the parent automatically unblocks all children

**Use case:** Large projects where blocking an epic should cascade to all child tasks,
preventing work on children when the parent is gated by external factors.

**Trade-offs:**

| Approach | Pros | Cons |
| --- | --- | --- |
| Current (explicit only) | Simpler, predictable | Must manually block children |
| Transitive (opt-in) | Automatic cascading | Hidden transitive effects |

**Decision:** Start with explicit-only blocking (simpler).
Add transitive blocking as an opt-in feature if users request it after real-world usage.

* * *

### 2.9 Managed Docs: Copies, Forks, and Synchronization

tbd manages documentation (guidelines, shortcuts, templates) alongside issues.
With forkable docs (format f05, `plan-2026-06-11-forkable-docs.md`), a doc can exist as
up to **four copies plus a manifest**, each with a distinct owner and lifecycle.
This section states that model and the invariants that make every combination of user
actions safe.

#### The copies

| Copy | Location | In git? | Written by | Role |
| --- | --- | --- | --- | --- |
| Bundled | npm package (`dist/docs/`) | n/a (per tbd version) | tbd releases | The upstream for `internal:` docs; immutable per installed version |
| Cache | `.tbd/docs/` | gitignored | doc sync only | Complete, pristine, machine-local mirror of all upstream docs (bundled + URL sources); disposable |
| Fork | `docs/tbd/<kind>/<name>.md` | tracked | `tbd docs fork/update` + the user/agent | The editable copy that tbd serves; optional, per-doc |
| Base | `.tbd/doc-forks/base/<kind>/<name>.md` | tracked | `tbd docs fork/update` | Verbatim upstream snapshot at the fork point; the three-way merge base |
| Manifest | `.tbd/doc-forks/forks.yml` | tracked | `tbd docs fork/unfork/update` | Provenance per fork: source docref, `base_hash` (LF-normalized sha256), `tbd_version` at fork point, `conflicted` flag |

A doc’s identity is **kind and name**; paths follow fixed conventions
(`<kind-dir>/<name>.md`, flat; nested folders are not scanned).

The model follows one principle: **resolve by convention; track only what cannot be
derived; publish the inventory as a generated view.** Lookup is a fixed search path over
conventional locations; no registry that can drift from disk.
The only stored tracking is the fork manifest, which records the one fact that cannot be
recomputed from the files: each fork’s upstream source and base snapshot.
The docmap that doc commands emit is a generated view of this state, never an input to
resolution. (A copy-all-and-gitignore variant of the fork dir was considered and
rejected: gitignored mirrors are invisible on GitHub and in PRs, and edits to them
diverge silently with no team-visible artifact; `tbd docs fork --all` provides the
all-visible posture in tracked form.
See the spec’s Alternatives.)

#### Invariants

1. **Serving precedence**: the fork dir is prepended to every kind’s lookup path, so a
   forked (or hand-authored local) file shadows the cache copy by name.
   With nothing forked, lookup paths reduce to the cache and behavior is byte-identical
   to pre-f05.
2. **Cache completeness**: doc sync always installs *all* upstream docs into the cache,
   including forked ones.
   The cache copy is the pristine reference: the staleness comparator, the “theirs” side
   of every update merge, and the fallback after unfork.
3. **The cache is never authored**: only doc sync writes it, nothing else reads from
   anywhere else for upstream content, and deleting it is always safe (auto-sync
   regenerates it on the next doc access, including on fresh clones).
4. **Tracked files mutate only via explicit `tbd docs` verbs** (fork/unfork/update).
   Setup, `tbd sync`, and background auto-sync refresh the cache and *report* drift but
   never write the fork dir, bases, or manifest.
5. **Tracking is derived, not stored**: every doc state
   (`upstream/forked/customized/stale/conflicted/local/missing/orphaned`) is a pure
   function of (manifest entry present?, file hash, base hash, cache hash, conflicted
   flag, markers present).
   There is no hidden database, so no sequence of git operations (commit, pull, merge,
   revert, partial commits) can desynchronize tbd from the files: collaborators
   recompute identical states from identical content.
6. **The base is the fork point**: advanced only by fork (refresh) and update; with the
   stored snapshot, `customized` (file ≠ base), `stale` (cache ≠ base), and three-way
   merging are exact, offline operations for every collaborator regardless of which tbd
   version created the fork.
7. **The format gate**: forking bumps nothing at runtime, but the f05 `tbd_format` in
   `config.yml` (mirrored into the machine-local common-dir `layout.yml`) makes pre-f05
   clients refuse the repo; they would otherwise serve upstream copies of docs the team
   has customized. Within the f05 era, the manifest’s per-entry `tbd_version` guards the
   remaining skew: `tbd docs update` refuses to touch a doc whose fork point was
   advanced by a newer tbd than the one running, since that client’s bundled “upstream”
   is older than the fork point and updating would silently downgrade the doc.

#### Who writes what (synchronization flows)

| Flow | Reads | Writes | Tracked files touched |
| --- | --- | --- | --- |
| npm upgrade | — | bundle | none |
| Doc sync (`tbd sync --docs`, auto-sync, setup) | bundle + URL sources | cache | none |
| `tbd docs fork` | cache | fork file, base, manifest, fork-dir README | yes (explicit) |
| `tbd docs update` | cache, base, fork file | fork file and/or base, manifest, README | yes (explicit) |
| `tbd docs unfork` | base, fork file | removes fork artifacts, README | yes (explicit) |
| User/agent edits | — | fork dir (any way they like) | yes (theirs) |
| git operations | — | any tracked artifact | yes (theirs) |

Staleness appears exactly when doc sync moves the cache past a fork’s base; awareness
surfaces (`tbd docs status`, the one-line `tbd sync` drift notice) report it, and only
the explicit `tbd docs update` acts on it.

#### Drift and degraded modes

Because of invariant 5, arbitrary user actions in the fork dir resolve to defined
states: edits → `customized`; deletion → `missing` (serving falls back to the cache);
rename → `missing` + `local`; new files → `local` (served, no upstream); deleting the
manifest → everything `local` (serving unaffected); moving into subfolders → not scanned
(documented). Degraded modes fail soft: an unreachable URL source keeps serving the
last-good cache copy; an empty cache self-heals via auto-sync; a deleted base blocks
merging only for that doc (repairable via `update --keep-ours`); the upgrade abort path
is specified in `tbd-docs.md` §Troubleshooting.
The drift matrix with resolutions is user-facing in `tbd-docs.md` §“Forked Docs in Your
Repo”; the state matrix, update decision table, and drift scenarios are pinned by
`fork-manifest`/`fork-update`/`doc-fork` unit tests and the `cli-docs-fork`/
`cli-docs-update` golden tryscripts.

### 2.10 Native Comment Records (Dormant Foundation)

tbd’s selected native-comment design gives every bead a durable conversation without
requiring a Linear issue, GitHub issue, pull request, or hosted mailbox.
Each comment is an independent immutable Markdown document, so two agents can append to
one bead by creating different paths instead of rewriting the bead or a shared log.

This is a candidate repository contract, not a current user feature.
At the f08 boundary, the codebase contains internal record, storage, inventory,
transition-planning, and quarantine modules.
It has no native-comment CLI route, public package export, active runtime caller,
generated scaffold, format migration, Git guard, workspace integration, watch support,
or provider projection.
Current setup and upgrades remain on f08 and do not create a `comments/` directory.

The complete edge-case contract and code map live in the
[native comment architecture](https://github.com/jlevy/tbd/blob/main/docs/project/architecture/current/arch-native-comments.md).
The
[coordination rollout plan](https://github.com/jlevy/tbd/blob/main/docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md)
owns sequencing and release gates.

#### 2.10.1 Record and Relationship Model

A candidate record has this shape:

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

The `cm-` ID names one record forever.
`issue_id` is the immutable internal bead ID, and `reply_to` is an optional comment ID.
A missing reply target is allowed because comments can arrive in either order; readers
must report a known cross-bead reply instead of silently reparenting it.
Authorship is an immutable display snapshot with an optional tbd agent ID and
allowlisted harness/model provenance.
Provider IDs and delivery state do not belong in this record.

The Markdown body must be nonempty, valid Unicode, and at most 65,536 UTF-8 bytes.
The complete encoded record is bounded at 73,728 bytes.
Unknown durable fields fail validation until the format explicitly defines them.
There is no update, edit, delete, or reparent operation in the initial model.

The bead does not store an array of comment IDs.
Readers derive the inverse relation by selecting records whose `issue_id` matches the
bead. This avoids a shared append hotspot and permits a comment to arrive without an
issue-file edit.

#### 2.10.2 Storage, Publication, and Repair

The candidate paths are separate from the current f08 tree:

```text
.tbd/data-sync/
├── comments/
│   └── <sha256-first-byte>/
│       └── cm-<ulid>.md
└── attic/
    └── comment-conflicts/
        ├── _unattributed/
        └── cm-<ulid>/
            ├── <sha256-of-candidate-bytes>.md
            └── observations/
                └── <sha256-of-manifest>.yml
```

The shard is the first byte of SHA-256 over the comment ID, encoded as two lowercase hex
digits. This distributes time-adjacent ULIDs without introducing a registry.
Accepted files must have the exact path, ID, shard, mode, UTF-8, schema, and canonical
bytes required by the format.
Managed Git attributes must disable line-ending, encoding, identity, and filter
transformations on comments and their evidence.

Local publication is create only.
The writer serializes and bounds the complete record, writes and closes a temporary file
on the same filesystem, and hard-links it to the final path.
An identical retry succeeds by comparing exact canonical bytes.
A different occupant is never overwritten; the candidate bytes are preserved under the
content-addressed conflict path before the operation reports an identity conflict.

The internal inventory adapters retain bounded raw entries as well as accepted records.
They can read a filesystem tree, a resolved Git commit, or one Git index stage.
Filesystem and commit inventories are complete trees.
Index stages are sparse views, so transition planning refuses to treat an absent stage
entry as a deletion.
A known but unmaterialized or oversized record remains visible as an incomplete entry.
An overlong canonical UTF-8 path remains visible as an invalid entry, while a non-UTF-8
or unsafe path uses a digest-bearing diagnostic and retains its exact bytes separately.
Entry-count, Git-listing, and aggregate-byte ceilings abort without returning a partial
inventory; filesystem enumeration, metadata, and bounded-read failures do the same.

Immutable transition planning is a pure operation over complete candidate trees.
When a common parent contains an ID, its exact bytes remain authoritative; deletion,
modification, or changed `issue_id` is a violation.
With unrelated histories and no parent record, one unique valid digest is accepted.
If several valid digests claim the ID, the lexicographically smallest SHA-256 digest is
the deterministic winner and every alternative is retained.
Invalid materialized alternatives can be quarantined and repaired when one valid
canonical observation exists.
An invalid parent, an incomplete source, an identity without any valid canonical
observation, or evidence that cannot be preserved blocks automatic repair.

When candidate bytes are materialized, quarantine publication writes and verifies the
raw content before its immutable provenance manifest becomes visible.
A deletion has a manifest without a raw blob; an unmaterialized or over-bound
observation blocks mutation rather than publishing partial evidence.
The manifest records a resolved source revision when available or a stable source
descriptor, safe or base64 path identity, mode, Git object ID, digests, and normalized
problem codes. It excludes wall-clock time, absolute local paths, and parser exception
prose so the same observation has the same path in every clone.

#### 2.10.3 Git, Watch, and Provider Boundaries

Independent comment additions normally merge as disjoint files, but Git transport alone
does not enforce immutability.
Before activation, every broad stage, commit, merge, fast-forward pull, push,
workspace/outbox operation, migration, repair, and unrelated-history rescue must use the
inventory and transition contract.
All complete alternatives and manifests must be published before a canonical path is
restored or replaced, and the staged modes and bytes must match the approved plan before
commit. Current broad `git add -A` and force-scaffold paths may carry manually placed
files by accident; that is not supported native-comment preservation.

Current `tbd changes` and `tbd watch` compare issue snapshots only.
A remote commit that changes only a candidate comment produces an empty issue report;
`tbd watch` advances its baseline and continues waiting.
Phase 2 must add fixed-commit comment-ID discovery to the same report before a writer is
enabled.
Timestamps and ULIDs are ordering aids, not delivery cursors; callers checkpoint
the commit endpoint and discovered identities.
Phase 3 may add one shared bounded remote poller and coalesced publication, with backoff
and rate-limit controls, without requiring a GitHub issue or pull request per message.

Existing Linear comments use the separate embedded `extensions.<provider>.comments`
representation described in §8.7. They remain supported while native comments are
dormant. In Phase 4, a bridge may project native comments only for explicitly linked
beads and store provider aliases, destination lineage, and delivery intents separately.
Provider retention caps must never truncate native prose.

Comment bodies and provider metadata are untrusted input.
Readers and agent runtimes must not execute or adopt Markdown, YAML tags, shell text, or
provider payloads as instructions merely because Git authentication delivered them.
Git transport authenticates access; it does not sign the author snapshot.

#### 2.10.4 Compatibility and Activation

The rollout is incremental, and a component landing does not make its phase usable:

| Phase | Usable result | Current state |
| --- | --- | --- |
| 1. Stabilize existing coordination | Embedded provider comments survive recovery; retries and advisory claims have explicit contracts | In progress |
| 2. Native comments | Any bead has append-only discussion, bounded reads, and complete manual Git exchange | Record/storage and inventory/transition internals implemented; preservation, commands, and activation open |
| 3. Continuous Git coordination | Nearby and cloud workers discover and publish records through one bounded poller | Planned after Phase 2 |
| 4. Human conversation | Native and Linear comments converge on explicitly linked beads | Planned after Phase 2; independent of Phase 3 |
| 5. Portable workers | Opt-in Claude and Codex workers catch up, claim work, act, and recover | Planned after Phase 3 |

The candidate f09 activation sequence is:

1. Complete Git-operation guards, workspace/history recovery, diagnostics, attributes,
   and packed old-client preservation tests.
2. Ship those protections in an f08-compatible release and establish that release as the
   minimum version for every participating writer.
3. Run the format and failure experiment matrix, settle the remaining durable grammar,
   and freeze the required f09 contract.
4. Separate the readable format ceiling from the automatic migration target, fresh-repo
   default, common-directory marker, and generated integration marker.
5. Add an explicit activation command whose reviewed config change is committed and
   distributed before any native comment is created.
6. Recheck the active format while holding the shared writer lock before publishing a
   record.

Git cannot retroactively fence an old writer working from a stale clone.
Activation therefore requires an explicit writer inventory and an honest bound on that
limitation; it is not a distributed lock.

* * *

## 3. Git Layer

### 3.1 Overview

The Git Layer defines synchronization using standard git commands.
Mutating operations use the shared hidden worktree, while read-only observation reads
commit objects and private refs without checking them out.
Git transfers files; tbd validates and reconciles each managed collection according to
that collection’s schema and preservation rules.

**Key properties:**

- **Dedicated hidden worktree**: Mutating sync never checks the coordination branch out
  in the user’s worktree

- **Schema-aware reconciliation**: Issues merge by field; immutable collections require
  exact parent-edge validation and repair evidence

- **Standard git**: All operations use git CLI

- **Dedicated sync branch**: `tbd-sync` branch never pollutes main

- **Git-based conflict detection**: A pre-push fetch and ancestry comparison finds
  published work; push rejection closes the concurrent-publication race

**Critical invariant:** tbd must never modify the user’s checkout, Git index, or staging
area. Ordinary data commands and sync mutate the separate worktree at
`$GIT_COMMON_DIR/tbd/data-sync-worktree/` while holding the shared writer lock.
Observers use private refs and commit-object reads as described in §3.7.

### 3.2 Sync Branch Architecture

```
main branch:                    tbd-sync branch:
├── src/                        └── .tbd/
├── tests/                          └── data-sync/
├── README.md                           ├── issues/
├── .tbd/                               ├── mappings/
│   ├── config.yml      (committed)     ├── attic/
│   ├── .gitignore      (committed)     ├── bridge/       (when configured)
│   ├── .gitattributes  (committed)     └── meta.yml
│   ├── workspaces/     (committed)
│   ├── state.yml       (gitignored)
│   └── docs/           (gitignored)
└── ...

$GIT_COMMON_DIR/tbd/            # Local machinery shared by linked worktrees
├── layout.yml
├── data-sync.epoch
├── locks/data-sync.lock/
├── backups/
└── data-sync-worktree/         # Checkout of tbd-sync
```

**Why separate branches?**

1. **No conflicts on main**: Coordination data never creates merge conflicts in feature
   branches

2. **Simple allow-listing**: Cloud sandboxes can allow push to `tbd-sync` only

3. **Shared across branches**: All feature branches see the same issues

4. **Clean git history**: Issue updates don’t pollute code commit history

#### Files Committed on Main Branch

```
.tbd/config.yml       # Project configuration (YAML)
.tbd/.gitignore       # Controls what's gitignored below
.tbd/.gitattributes   # Merge strategies (merge=union for ids.yml)
.tbd/workspaces/      # Persistent state (outbox, named workspaces)
.tbd/doc-forks/       # Fork manifest + base snapshots (see §2.9; f05+)
docs/tbd/             # Forked docs, outside .tbd/ (see §2.9; only when fork is used)
```

#### Files Gitignored (local only)

```
.tbd/state.yml              # Per-node sync state
.tbd/docs/                  # Installed documentation (regenerated on setup)
.tbd/backups/               # Legacy local backups
.tbd/data-sync-worktree/    # Legacy per-checkout worktree path
.tbd/data-sync/             # Reserved for potential future "simple mode"
$GIT_COMMON_DIR/tbd/        # Shared local sync worktree, locks, backups
```

#### Files Tracked on tbd-sync Branch

```
.tbd/data-sync/issues/     # Issue entities
.tbd/data-sync/attic/      # Conflict archive
.tbd/data-sync/mappings/   # ID mappings
  ids.yml                  # Short ID → ULID mapping (includes preserved import IDs)
.tbd/data-sync/bridge/     # Provider link, intent, and actor-binding state when configured
.tbd/data-sync/meta.yml    # Metadata
```

### 3.3 Sync Operations

Ordinary sync reads and writes the dedicated hidden worktree checked out on the sync
branch. It never switches the user’s worktree to that branch.

#### 3.3.1 Reading from Sync Branch

Issue commands read the resolved data-sync directory under the shared worktree.
Commands that compare fixed commits, including `tbd changes` and `tbd watch`, use
`git ls-tree` and bounded `git cat-file --batch` reads instead (§3.7).

#### 3.3.2 Writing to Sync Branch

All writes acquire the shared data-sync lock and use the hidden worktree’s own index:

```bash
# 1. Preserve pending coordination changes before integrating remote history
git -C "$GIT_COMMON_DIR/tbd/data-sync-worktree" add -A
git -c commit.gpgsign=false -C "$GIT_COMMON_DIR/tbd/data-sync-worktree" \
  commit -m "tbd sync: ..."

# 2. Fetch explicitly into the remote-tracking ref
git fetch origin \
  refs/heads/tbd-sync:refs/remotes/origin/tbd-sync

# 3. Merge the remote-tracking ref into the hidden worktree
git -C "$GIT_COMMON_DIR/tbd/data-sync-worktree" \
  merge origin/tbd-sync -m "tbd sync: merge remote changes"

# 4. Push the sync branch with an explicit source and destination
git push --no-verify origin \
  refs/heads/tbd-sync:refs/heads/tbd-sync
```

The actual flow handles a missing remote, local pending work, non-fast-forward retry,
provider journals, validation, and recovery around these operations.
Machine-generated commits disable ambient signing.
Sync pushes pass `--no-verify` so repository pre-push hooks do not block or mutate the
coordination branch.

**Push Retry Algorithm (V2-005):**

If push is rejected (non-fast-forward), retry with merge:

```
MAX_RETRIES = 3

for attempt in 1..MAX_RETRIES:
  1. git fetch origin refs/heads/tbd-sync:refs/remotes/origin/tbd-sync
  2. Merge origin/tbd-sync into the hidden worktree
  3. Resolve issue, ID-mapping, and provider-bridge conflicts by their schemas
  4. Reject staged conflict markers, validate all resulting bead files, and stage the
     resolved paths; this is not a whole-store validator for dormant comments or every
     provider artifact
  5. Commit the merge in the hidden worktree
  6. git push origin refs/heads/tbd-sync:refs/heads/tbd-sync
  7. If push succeeds: done
  8. If push is rejected: continue to the next attempt

If all attempts fail:
  - Exit with error code 1
  - Output: "Sync failed after 3 attempts. Manual resolution required."
  - Suggest: "Run 'tbd sync --status' to see pending changes."
```

#### 3.3.3 Sync Algorithm

High-level sync flow:

```
SYNC(options):
  0. PREREQUISITE: Acquire $GIT_COMMON_DIR/tbd/locks/data-sync.lock
  1. Verify shared worktree health (see [Worktree Lifecycle](#worktree-lifecycle))
     - If missing/prunable: auto-materialize the shared worktree
     - If corrupted: fail closed and route to doctor --fix
  2. Resolve data path via resolveDataSyncDir() — uses worktree path
  3. Stage and commit pending worktree changes to preserve the local side
  4. Fetch the remote branch explicitly into its remote-tracking ref
  5. Detect unrelated history; merge the remote-tracking ref when it is ahead
  6. Run the enabled provider fold after merge and before publication
  7. Push to remote
  8. If push is rejected (non-fast-forward): fetch explicitly and retry with merge
     (see 3.3.2)
```

**Critical Invariant:** All data operations in steps 1-7 MUST use the resolved
`dataSyncDir` path consistently.
Never read from or write to `.tbd/data-sync/` directly—always go through the shared
worktree at `$GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/`.

**Why most syncs are trivial (no merge needed):**

The file-per-entity design means parallel work rarely conflicts at the git level:

| Scenario | Git behavior | Result |
| --- | --- | --- |
| A creates issue-1, B creates issue-2 | Different files added | Trivial merge |
| A modifies issue-1, B creates issue-2 | Different files | Trivial merge |
| A and B both modify issue-1 | Same file modified | Field-level merge |

Only when two agents modify the **same issue** before syncing does tbd need to perform
field-level merging.
This is rare in practice because:

- Issues are small, focused units of work
- Agents typically work on different issues
- The `ready` command distributes work across agents

### 3.4 Conflict Detection and Resolution

#### When Conflicts Occur

Conflicts (requiring field-level merge) happen when the same issue file is modified in
two places before sync:

- Two environments modify the same issue before syncing

- Same issue modified on two machines offline

#### Detection

Conflict detection uses Git history and standard merge mechanics.
A normal full sync first commits pending local coordination changes, then fetches the
configured remote branch into `refs/remotes/<remote>/<sync-branch>` and compares that
fetched tip with the local sync branch:

```
remote-tracking tip is ahead → merge needed
git push fails with non-fast-forward → remote advanced after fetch; fetch and merge again
```

This pre-push fetch handles already-published remote work without manufacturing a failed
push.
Push rejection remains the race detector when another writer publishes between that
fetch and this writer’s push.

The `version` field is purely informational (edit counter) and is NOT used for conflict
detection. This avoids the distributed systems problem where version numbers diverge
independently.

> **Why Git-based detection?** Git’s ancestry checks, merge state, and push rejection
> are reliable, well-tested infrastructure.
> tbd uses them to identify transport-level concurrency and focuses its own logic on
> schema-aware resolution.

#### Resolution Flow

```
1. Commit pending hidden-worktree changes before any fetch.
2. Fetch refs/heads/<sync-branch> explicitly into
   refs/remotes/<remote>/<sync-branch>.
3. Reject unrelated histories and route them to `tbd doctor --fix` rescue.
4. If the fetched tip is ahead, merge it into the hidden worktree.
5. If Git reports file conflicts:
   a. For each conflicted issue, read ours, theirs, and the merge base from Git objects.
   b. Parse the complete records as YAML+Markdown and apply the §3.5 field rules.
   c. If the substantive result differs from the highest-version input, set version to
      max(local, remote) + 1 and updated_at to merge time; otherwise retain that input.
   d. Write the visible result and save discarded values to the attic.
   e. Reconcile ID mappings and bridge records by their own rules.
6. Reject unresolved markers or invalid resulting beads, then commit the merge.
7. Run the enabled provider fold and push the explicit branch refspec.
8. If push is rejected as non-fast-forward, repeat the explicit fetch and merge, for up
   to three push attempts.
```

> **Note on Attic Entries**: Attic entries are created only when a merge strategy
> **discards** data (e.g., LWW picks one scalar over another, or one text block over
> another). Union-style merges that retain both values (e.g., labels, dependencies) do
> not create attic entries since no data is lost.
> This ensures the attic remains focused on actual data loss, not routine merges.

#### No-Common-Base Reconciliation

Unrelated-history rescue can encounter the same issue ID without a trustworthy Git
ancestor. `mergeIssues(null, local, remote)` distinguishes two cases:

- Equal `created_at` values mean the records descend from the same original creation.
  The lower-version input becomes an approximate base and the ordinary field strategies
  produce the visible result.
- Different `created_at` values mean independent creations claimed one ID. The
  earlier-created complete issue wins as a unit, and the other issue is a `whole_issue`
  conflict.

Because an approximate base cannot prove which fields were independently edited,
unrelated-history rescue also preserves every substantively different input that the
visible result does not retain as a complete Markdown issue under `attic/conflicts/`.
That outer preservation step applies even when the field merge itself reports no
conflict.

### 3.5 Merge Rules

Field-level merge strategies:

| Strategy | Behavior | Used For |
| --- | --- | --- |
| `immutable` | Common one-side-changed handling accepts that side; if both sides differ, retain the base | `type`, `id`, `created_at`, `created_by` |
| `lww` | Later issue `updated_at` wins; local wins an equal timestamp; archive a differing loser | Scalar fields and unknown f08 keys |
| `union` | Local-first deep-equality union, without sorting | `labels`, `dependencies`, `child_order_hints` |
| `union_by_key` | Local-first union by identity key; local wins a same-key collision | `docs` by `path`, `refs` by `url` |
| `max` | Keep the larger input | `version`, `updated_at` during field resolution |
| `min_timestamp` | Keep the earliest present timestamp | `started_at` |
| `namespace_merge` | Merge top-level namespaces independently; accept one-sided edits and deletions, retain an edit over a concurrent deletion, union same-lineage comments, then use LWW for remaining conflicts | `extensions` |

**LWW Tie-Breaker Rule:**

When `updated_at` timestamps are equal, the merge engine chooses the value passed as
local and preserves a differing remote value in the attic.
It does not compare content hashes.
Direction therefore matters for an equal-timestamp conflict; callers must keep their
local/remote roles stable.

#### BaseEntity Merge Rules

All entities share these base field merge rules:

```typescript
const baseEntityMergeRules = {
  type: { strategy: 'immutable' },
  id: { strategy: 'immutable' },
  created_at: { strategy: 'immutable' },
  version: { strategy: 'max' },
  updated_at: { strategy: 'max' },
  extensions: { strategy: 'namespace_merge' },
};
```

#### Issue Merge Rules

```typescript
const issueMergeRules: MergeRules<Issue> = {
  // BaseEntity fields (inherited)
  ...baseEntityMergeRules,

  // Issue-specific fields
  kind: { strategy: 'lww' },
  title: { strategy: 'lww' },
  description: { strategy: 'lww' },
  notes: { strategy: 'lww' },
  status: { strategy: 'lww' },
  priority: { strategy: 'lww' },
  assignee: { strategy: 'lww' },
  delegate: { strategy: 'lww' },
  labels: { strategy: 'union' },
  dependencies: { strategy: 'union' },
  parent_id: { strategy: 'lww' },
  child_order_hints: { strategy: 'union' },
  spec_path: { strategy: 'lww' },
  docs: { strategy: 'union_by_key', key: 'path' },
  refs: { strategy: 'union_by_key', key: 'url' },
  due_date: { strategy: 'lww' },
  deferred_until: { strategy: 'lww' },
  hold: { strategy: 'lww' },
  hold_until: { strategy: 'lww' },
  created_by: { strategy: 'immutable' },
  started_at: { strategy: 'min_timestamp' },
  closed_at: { strategy: 'lww' },
  close_reason: { strategy: 'lww' },
  resolution: { strategy: 'lww' },
  duplicate_of: { strategy: 'lww' },
};
```

Every differing LWW value records its loser in the attic.
Unknown f08 issue keys also use LWW with attic evidence, which preserves data from a
newer compatible writer.
Provider namespaces under `extensions` merge independently; embedded provider comments
then receive the lineage-scoped append-union described in §8.7. If the merged issue is
substantively different from the highest-version input, `version` becomes
`max(local, remote) + 1` and `updated_at` becomes the merge time.
Otherwise the highest-version input is returned unchanged to avoid a gratuitous edit.

**Lifecycle-field interaction:** `status`, `closed_at`, `close_reason`, `resolution`,
and `duplicate_of` each use LWW in the merge engine.
The `close` and `reopen` commands write coherent tuples, and schema validation rejects a
`resolution` on non-closed work or a mismatched `duplicate_of`; the merge layer does not
invent or clear timestamps as a separate repair step.

**Extensions Namespace Merge:**

The `extensions` field uses per-namespace merging to preserve third-party data:

- A namespace changed on one side takes that change, including deletion.
- Agreement carries through unchanged, including when both sides delete the namespace.
- A concurrent edit wins over a deletion regardless of timestamp; the discarded deletion
  is recorded in the attic so the unlink is visible and can be repeated.
- Two present namespaces from the same provider-link lineage union their embedded
  comments by comment identity.
  Their remaining metadata uses the issue-level LWW direction, and any differing losing
  metadata is archived.
- Other both-changed namespace conflicts use issue-level LWW and archive the complete
  losing namespace.

```typescript
// Example: merging extensions
local.extensions = { github: { issue: 123 }, slack: { channel: 'dev' } };
remote.extensions = { github: { pr: 456 }, jira: { key: 'PROJ-1' } };

// Result when remote.updated_at is later: union of namespaces, LWW per conflict
merged.extensions = {
  github: { pr: 456 }, // remote wins (LWW on github namespace)
  slack: { channel: 'dev' }, // preserved from local
  jira: { key: 'PROJ-1' }, // preserved from remote
};
// Note: github.issue lost because remote's github namespace won LWW
// The losing github namespace is preserved in attic
```

#### Native-Comment Preservation Boundary

The candidate native-comment collection in §2.10 does not use issue field-merge rules.
Different IDs are independent additions.
For one ID, an authoritative parent’s exact bytes cannot be deleted, modified, or
reparented; a same-ID add/add divergence in unrelated histories requires a deterministic
winner and complete preservation of every alternative.

The internal f08 inventory and transition modules can classify these cases, but no
current sync, commit, merge, fast-forward, push, workspace, outbox, rescue, migration,
or repair path calls them.
Before activation, each path must publish all required raw and manifest evidence before
it mutates the tree, then verify the staged paths, bytes, and modes against the plan.
Current broad `git add -A` and force-add scaffold steps are therefore preservation work
to complete, not evidence that manually placed native-comment files are supported.

### 3.6 Attic Structure

The attic preserves data lost in conflicts:

```
.tbd/data-sync/attic/
├── is-a1b2_2025-01-07T10-30-00Z_description.yml
└── conflicts/
    └── is-a1b2__2025-01-07T11-45-00Z.md
```

The root YAML files are field-conflict records.
The Markdown files under `attic/conflicts/` are complete losing issue snapshots retained
during unrelated-history rescue.

**Attic entry format:**

```json
{
  "entity_id": "is-a1b2",
  "timestamp": "2025-01-07T10:30:00Z",
  "field": "description",
  "lost_value": "Original description text",
  "winner_source": "remote",
  "loser_source": "local",
  "context": {
    "local_version": 3,
    "remote_version": 3,
    "local_updated_at": "2025-01-07T10:25:00Z",
    "remote_updated_at": "2025-01-07T10:28:00Z"
  }
}
```

### 3.7 Read-Only Remote Observation

Ordinary mutation commands write issue state in the local hidden worktree; `tbd sync` is
the explicit exchange that fetches, merges, and publishes that state.
A narrower Git-layer operation lets a process learn *that remote committed state
changed* without mutating bead data: the observation path behind `tbd changes` and
`tbd watch` (§4.14).

**Invariant:** observation does not mutate functional shared state.
It never takes the data-sync lock, touches the hidden worktree, updates the local sync
branch or its configured remote-tracking ref, or writes `FETCH_HEAD`. `tbd watch` does
create and delete repository-scoped private refs, including stale-ref cleanup; those
refs are visible to Git-aware processes but carry no canonical bead state.
This narrower guarantee makes several watchers safe beside ordinary `tbd sync` in one
checkout.

**Reading committed snapshots.** Both commands read issues straight out of commit
objects, never from a checkout:

```bash
# One snapshot: issue blobs plus the ID mapping, resolved from a commit
git ls-tree -r -z <commit> -- .tbd/data-sync/issues .tbd/data-sync/mappings/ids.yml
git cat-file --batch   # 128 object IDs per invocation
```

Blob reads are batched (128 objects per `cat-file`) so peak memory tracks the batch, not
the repository. Each snapshot is validated on read: file names must match the issue ID
inside, issue files must not be nested, and every issue must have a row in `ids.yml`. An
unparseable snapshot fails the command rather than silently reporting a partial diff.

For every selector except `--ready`, the baseline and tip commits fully determine report
membership, and the same pair yields the same report.
`--ready` also evaluates `deferred_until` at one wall-clock instant shared by both
snapshots. The current caller chooses that instant for each invocation and does not
include it in the report, so the same commit pair can yield different ready-edge
membership after a deferral elapses.
Report ordering and field order remain deterministic in every mode.
`tbd-obw9` tracks pinning or persisting the readiness evaluation instant for exact
replay.

**Current entity boundary.** f08 observation reads issue files and the ID mapping only.
A remote commit that changes only a candidate native comment produces an empty report;
`tbd watch` advances its baseline to that commit and continues waiting.
This is valid for the current issue-only interface, but it is not native-comment
delivery. Before a comment writer is activated, fixed-commit comment-ID discovery must
join the same snapshot and report contract so advancing the baseline cannot skip a
comment.

**Observing the remote.** `tbd watch` learns the remote tip with
`git ls-remote --exit-code <remote> refs/heads/<sync-branch>`, which transfers no
objects.
Only when that tip moves does it fetch, and the fetch is aimed at a private ref:

```bash
git fetch --no-write-fetch-head --no-tags --refmap= \
  <remote> +refs/heads/<sync-branch>:refs/tbd/watch/<pid>-<uuid>
```

Each flag protects one piece of shared state:

| Flag | Protects |
| --- | --- |
| explicit `+refs/heads/<branch>:refs/tbd/watch/...` destination | the local sync branch |
| `--refmap=` | `refs/remotes/<remote>/<branch>`, which a configured remote refspec would otherwise advance beside the explicit one |
| `--no-write-fetch-head` | `FETCH_HEAD`, which other tooling reads |
| `--no-tags` | tag refs |

Private refs live under `refs/tbd/watch/` and are named `<pid>-<uuid>`, so concurrent
watchers in one checkout cannot collide.
A watcher deletes its own ref on exit; a watcher that starts up first reclaims refs
whose owning PID is no longer running, so a killed process leaves no permanent garbage.

**Bounded network calls.** Every network-facing Git process gets a positive wall-time
limit, so a hung transport ends the command instead of blocking an unattended worker
forever. One remote observation plus its fetch and ref resolution share a single budget:
the poll interval, capped at 30 seconds, and further clipped by any remaining
`--timeout` budget.

* * *

## 4. CLI Layer

### 4.1 Overview

The CLI Layer provides a Beads-compatible command interface.

**Key properties:**

- **Implementation-agnostic**: Can be in TypeScript, Rust, Python, etc.

- **Beads-compatible**: Same command names and common options

- **Dual output**: Human-readable by default, JSON for scripting

- **Exit codes**: 0 for success, non-zero for errors

### 4.1.1 Initialization Requirements

`tbd init`, `tbd setup`, and `tbd status` are the primary commands designed to run
before initialization.
`tbd setup --from-beads` performs the one-step Beads migration; `tbd import <file>`
requires an initialized repository and handles an explicit JSONL file or workspace.
Top-level help, version, and documentation discovery have their own non-mutating
behavior outside a repository.

Commands that operate on repository state locate and validate `.tbd/config.yml`,
including its `tbd_format`, before opening the data store.
Their exact error guidance is not a compatibility surface; `tbd status` is the stable
orientation command for choosing between setup, migration, and surgical initialization.

### 4.2 Command Structure

```
tbd <command> [subcommand] [args] [options]
```

**Note**: CLI command is `tbd` (singular) to avoid conflict with shell `cd`.

### 4.3 Initialization

```bash
tbd init --prefix=<name> [options]

Options:
  --prefix=<name>       Required: project prefix for display IDs (2-8 alphabetic recommended)
  --force               Allow non-recommended prefix format
  --sync-branch=<name>  Sync branch name (default: tbd-sync)
  --remote=<name>       Remote name (default: origin)
```

The `--prefix` option is required for `tbd init`. Beads prefix detection belongs to
`tbd setup --from-beads`.

**Prefix validation rules:**

- **Recommended** (no --force needed): 2-8 alphabetic characters (e.g., `tbd`, `proj`,
  `myapp`)
- **Valid with --force**: 1-20 lowercase characters, starting with a letter, ending with
  alphanumeric, middle characters can include dots (`.`) and underscores (`_`)
- **Never allowed**: Dashes (`-`) are not allowed as they break ID syntax (e.g.,
  `tbd-a1b2` would be ambiguous)

**What it does:**

1. Requires a Git repository and resolves its root.

2. Creates `.tbd/` with `config.yml` (including `display.id_prefix`) and `.gitignore`.
   The broader `tbd setup` flow installs or refreshes `.tbd/.gitattributes`.

3. Creates gitignored `.tbd/docs/` directories for shortcuts, guidelines, and templates.

4. Under the shared data-sync lock, attaches an existing local sync branch; otherwise it
   explicitly fetches an existing remote branch into its remote-tracking ref; otherwise,
   after confirming absence, it creates and scaffolds an orphan branch.

5. For a fresh orphan with a configured remote, immediately attempts best-effort
   publication and adopts a competing initializer’s winner when that race is safe to
   reconcile.

The user’s checkout never switches branches because all sync-branch work happens in the
separate hidden worktree.

**Current initialization caveat.** A worktree creation or remote-check failure is logged
only at debug level and `tbd init` still reports repository initialization success.
The local `.tbd/` files exist, but the data store may be unavailable until the
underlying Git problem is fixed and the worktree is materialized.
Also, `--sync-branch` and `--remote` are passed to this initial worktree operation,
while the newly written config currently retains the default `tbd-sync` and `origin`
values.

**Output:**

```
✓ Initialized tbd repository (prefix: proj)

Next steps:
  git add .tbd/ && git commit -m "Initialize tbd"
  tbd setup --auto   # Optional: configure agent integrations
```

### 4.4 Issue Commands

#### Create

```bash
tbd create [<title>] [options]

Options:
  --from-file <path>        Create from YAML+Markdown file (all fields)
  --type <type>             Issue type: bug, feature, task, epic, chore (default: task)
  --priority <0-4>          Priority (0=critical, 4=lowest, default: 2)
  --description <text>      Description ("-" reads stdin)
  --file <path>             Read description from file ("-" reads stdin)
  --assignee <name>         Assignee: who is accountable
  --delegate <name>         Delegate: who is acting
  --due <date>              Due date (ISO8601)
  --defer <date>            Defer until date (ISO8601)
  --parent=<id>             Parent issue ID
  --spec <path>             Link to spec (literal path, or unique filename/suffix
                            resolved like `list --spec`)
  --depends-on <id>         Blocker this issue depends on (repeatable)
  --label <label>           Add label (repeatable)
```

> **Note on `--type` flag:** The CLI flag `--type` sets the issue’s `kind` field, NOT
> the `type` field. The `type` field is the entity discriminator (always `is` for issues)
> and is set automatically.
> This naming choice maintains Beads CLI compatibility where `--type` was used for issue
> classification.

**Examples:**

```bash
tbd create "Fix authentication bug" --type=bug --priority=P1
tbd create "Add OAuth" --type=feature --label=backend --label=security
tbd create "Review OAuth" --assignee=alice --delegate=review-agent
tbd create "Write tests" --parent proj-a1b2
tbd create "API docs" --file design.md

# Create from full YAML+Markdown file
tbd create --from-file new-issue.md
```

**`--from-file` behavior:**

- Reads the YAML frontmatter and Markdown body from file

- Validates against IssueSchema

- Ignores `id` field in file (generates new ID)

- Ignores `version`, `created_at`, `updated_at` (set automatically)

- Title is required in the file’s frontmatter (or use `<title>` argument to override)

**Output:**

```
Created proj-a1b2: Fix authentication bug
```

#### List

```bash
tbd list [options]

Options:
  --status <status>         Filter: open, in_progress, blocked, deferred, closed
  --all                     Include closed issues (default: excludes closed)
  --type <type>             Filter: bug, feature, task, epic
  --priority <0-4>          Filter by priority
  --assignee <name>         Filter by assignee
  --label <label>           Filter by label (repeatable)
  --parent=<id>             List children of parent
  --deferred                Show only deferred issues
  --defer-before <date>     Deferred strictly before this date (beads with no
                            deferred_until are excluded)
  --sort <field>            Sort by: priority, created, updated (default: priority)
                            (created/updated are shorthand for created_at/updated_at)
                            Tiebreaker: internal ULID (chronological creation order)
  --limit <n>               Limit results
  --count                   Output only the count of matching issues
  --long                    Show descriptions
  --pretty                  Tree format showing parent-child hierarchy
  --json                    Output as JSON
```

> **Default filtering:** By default, `tbd list` excludes closed issues to focus on
> active work. Use `--all` to include closed issues, or `--status closed` to show only
> closed issues.

**Sort order:** The primary sort is by the `--sort` field (default: priority ascending;
created/updated: newest first).
The tiebreaker for issues with equal primary values is the internal ULID, which sorts
lexicographically in chronological creation order.
This ensures deterministic, stable ordering—issues created earlier always appear before
issues created later within the same priority level.

**Examples:**

```bash
tbd list                             # Active issues only (excludes closed)
tbd list --all                       # All issues including closed
tbd list --status closed             # Only closed issues
tbd list --status open --priority=P1
tbd list --assignee agent-1 --json
tbd list --deferred
```

**Output (human-readable):**

```
ID          PRI  STATUS           TITLE
proj-a1b2   P1   ◐ in_progress    Fix authentication bug
proj-f14c   P2   ○ open           Add OAuth support
proj-c3d4   P3   ● blocked        Write API tests
```

**Output (--pretty):**

The `--pretty` flag displays issues in a tree format showing parent-child relationships.
Issues with children are shown with their children indented below them using tree
characters.

```
proj-1875  P1  ✓ closed  epic  Phase 24 Epic: Installation and Agent Integration
├── proj-1876  P1  ✓ closed  task  Implement tbd prime command
└── proj-1877  P1  ✓ closed  task  Configure Claude Code setup surface
proj-a1b2  P1  ◐ in_progress  bug  Fix authentication bug
proj-f14c  P2  ○ open  feature  Add OAuth support
├── proj-c3d4  P2  ● blocked  task  Write OAuth tests
└── proj-e5f6  P2  ○ open  task  Update OAuth docs
```

**Pretty format columns (left to right):**

| Column | Color | Notes |
| --- | --- | --- |
| Tree prefix | dim | `├── ` or `└── ` for children, with indentation for deeper levels |
| ID | cyan | Display ID (e.g., `proj-a1b2`) |
| Priority | P0=red, P1=yellow, P2+=default | Always with P prefix |
| Status | per status | Icon and word (e.g., `✓ closed`, `◐ in_progress`) |
| Type | dim | Issue kind (bug, feature, task, epic, chore) |
| Title | default | Issue title |

**Tree structure rules:**

- Issues without a parent appear at root level (no indentation)
- Children are grouped under their parent with tree lines
- `├── ` prefix for middle children
- `└── ` prefix for last child in a group
- Multi-level nesting uses additional indentation (`│ ` or ` `)
- Children sorted by priority within each parent group

**Output (--json):**

```json
[
  {
    "type": "is",
    "id": "is-a1b2",
    "title": "Fix authentication bug",
    "status": "in_progress",
    "priority": 1,
    "kind": "bug",
    "version": 3,
    "created_at": "2025-01-07T10:00:00Z",
    "updated_at": "2025-01-07T14:30:00Z"
  }
]
```

#### Show

```bash
tbd show <ids...> [options]

Options:
  --json                    Output as JSON instead of YAML+Markdown
  --show-order              Display child_order_hints (if any)
  --no-parent               Suppress automatic parent context display
  --max-lines <n>           Truncate output to N lines (per issue in bulk)
  --ignore-missing          Skip unknown IDs instead of failing
```

**Bulk reads (2+ IDs):** each issue renders under a dim `── <id> ──` delimiter in
argument order (duplicates render once), parent context is suppressed, `--max-lines`
applies per issue, and `--json` emits an array (a single ID keeps the object shape).
Unknown IDs fail the whole read listing every bad ID; `--ignore-missing` renders the
found subset, reports skips on stderr, and exits 0: the same validate-all/fail-closed
contract as the bulk mutators, with no lock taken (read-only).
In `--json` mode stdout stays parseable when everything is skipped: the bulk form emits
`[]` and the single-ID form emits `null`.

**Output:**

The `show` command outputs the issue in a storage-compatible format (YAML frontmatter +
Markdown body). This format is both human-readable and machine-parseable, enabling
round-trip editing workflows.
For dependency direction, text output may include YAML comments immediately above the
`dependencies` field:

```yaml
# Blocks: proj-c3d4
# Blocked by: proj-f14c
dependencies:
  - type: blocks
    target: is-c3d4...
```

These comments are ignored by `tbd update --from-file` and exist only to clarify the raw
edge list. In storage, `type: blocks` means the shown issue blocks the target.
For dependency-direction checks, prefer `tbd dep list <id>`, which renders the
human-facing `Blocks:` and `Blocked by:` sections directly.

**Parent context (auto-displayed for child issues):**

When the shown issue has a `parent_id`, the show command displays the requested issue
first, then appends the full parent issue (in the same YAML+Markdown format) below,
capped at `PARENT_CONTEXT_MAX_LINES` (default: 50) from `settings.ts`. This provides
essential context without requiring a separate lookup.

```
---
(child issue shown first)
---

The parent of this bead is:
---
id: is-a1b2c3
kind: epic
title: Build Auth System
status: in_progress
priority: 1
---
Users need OAuth, SAML, and API key authentication methods.
```

This means child issues do NOT need to duplicate the parent’s context in their own
description. When creating children under a parent epic, the parent’s description serves
as shared context that is always visible when viewing any child.

Use `--no-parent` to suppress this behavior (e.g., for scripting or piping).
For `--json` output, the parent issue data is included as a `parent` object.

**Output truncation (`--max-lines`):**

When `--max-lines <n>` is specified, the issue output is truncated to at most `n` lines.
If truncated, a dimmed omission notice is appended:

```
… [15 lines omitted]
```

This option is off by default for the main issue.
The parent context display always uses `PARENT_CONTEXT_MAX_LINES` (50) as its cap.

```markdown
---
type: is
id: is-a1b2c3
version: 3
kind: bug
title: Fix authentication timeout
status: in_progress
priority: 1
assignee: agent-1
labels:
  - backend
  - security
dependencies:
  - target: is-f14c3d
    type: blocks
parent_id: null
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-07T14:30:00Z
created_by: alice
closed_at: null
close_reason: null
due_date: null
deferred_until: null
extensions: {}
---

Users are getting logged out after 5 minutes of inactivity.

## Notes

Working on session token expiry. Found issue in refresh logic.
```

Output is colorized when stdout is a TTY (see `--color` global option in §4.10).

**Round-trip editing workflow:**

```bash
# Export, edit, re-import
tbd show proj-a1b2 > issue.md
# ... edit issue.md ...
tbd update proj-a1b2 --from-file issue.md
```

> **Note:** The `notes` field appears as a `## Notes` section in the Markdown body,
> separated from the main description.
> Notes are intended for agent/developer working notes, while the description is the
> issue’s canonical description.

#### Start

```bash
tbd start <ids...> [--as <name>]
tbd whoami [--as <name>] [--ensure-id]
```

For each accepted claim, `start` sets `status: in_progress`, records the resolved
friendly identity in `delegate`, initializes `started_at` once, clears `hold` and
`hold_until`, and leaves `assignee` unchanged.
It skips closed beads, a different nonempty delegate on an already in-progress bead, and
an identical visible claim.
It holds the local data lock across a multi-ID invocation, but the batch is not an
all-or-nothing transaction.

The guard is advisory and local.
It does not test blockers or future deferral, and stale clones can both claim before
exchanging state. Pull and re-read first, then sync an accepted claim promptly.
Raw `update --status=in_progress`, `update --delegate`, and `create --delegate` remain
administrative writes and bypass this guard.

#### Update

```bash
tbd update <ids...> [options]

Options:
  --from-file <path>        Update all fields from YAML+Markdown file (single ID)
  --title <text>            Set title (single ID)
  --status <status>         Set status (single ID)
  --type <type>             Set type
  --priority <0-4>          Set priority
  --assignee <name>         Set assignee: who is accountable
  --delegate <name>         Set delegate: who is acting
  --hold <state>            Set hold: blocked, paused, or none
  --description <text>      Set description ("-" reads stdin; single ID)
  --notes <text>            Set working notes ("-" reads stdin; single ID)
  --notes-file <path>       Set notes from file ("-" reads stdin; single ID)
  --due <date>              Set due date
  --defer <date>            Set deferred until date
  --add-label <label>       Add label
  --remove-label <label>    Remove label
  --parent=<id>             Set parent (single ID)
  --spec <path>             Set or clear spec path (single ID)
  --child-order <ids>       Set child ordering hints (comma-separated; single ID)
  --ignore-missing          Skip unknown IDs instead of failing (bulk)
```

With two or more IDs, only shared fields apply (`--type`, `--priority`, `--assignee`,
`--delegate`, `--hold`, `--add-label`, `--remove-label`, `--due`, `--defer`); per-ID and
lifecycle flags are rejected.
Use `tbd start` for guarded claiming and `tbd close`/`tbd reopen` for terminal lifecycle
changes.

**Examples:**

```bash
tbd update proj-a1b2 --status=in_progress  # Direct status edit; not a guarded claim
tbd update proj-a1b2 --title "New issue title"
tbd update proj-a1b2 --add-label urgent --priority=P0
tbd update proj-a1b2 --defer 2025-02-01

# Set child display ordering for a parent issue
tbd update proj-a1b2 --child-order proj-c3d4,proj-e5f6,proj-g7h8

# Round-trip editing: export, modify, re-import
tbd show proj-a1b2 > issue.md
# ... edit issue.md ...
tbd update proj-a1b2 --from-file issue.md
```

**`--from-file` behavior:**

- Reads the YAML frontmatter and Markdown body from file

- Validates against IssueSchema

- Updates all mutable fields (immutable fields `id`, `type`, `created_at`, `created_by`
  are preserved from existing issue)

- Automatically increments `version` and sets `updated_at`

- Reports clear validation errors if schema is invalid

#### Close

```bash
tbd close <ids...> [options]

Options:
  --reason <text>           Close reason ("-" reads stdin)
  --reason-file <path>      Read close reason from a file ("-" reads stdin)
  --as <resolution>         completed, canceled, or duplicate
  --duplicate-of <id>       Required with --as duplicate
  --ignore-missing          Skip unknown IDs instead of failing (bulk)
```

**Examples:**

```bash
tbd close proj-a1b2
tbd close proj-a1b2 --reason "Fixed in commit abc123"
tbd close proj-a1b2 proj-c3d4 proj-e5f6 --reason "Sprint complete"  # bulk, one lock
```

#### Reopen

```bash
tbd reopen <ids...> [options]

Options:
  --reason <text>           Reopen reason ("-" reads stdin)
  --reason-file <path>      Read reopen reason from a file ("-" reads stdin)
  --ignore-missing          Skip unknown IDs instead of failing (bulk)
```

Reopen clears `closed_at`, `close_reason`, `resolution`, and `duplicate_of` and returns
the bead to `status: open`; `started_at` remains historical.

#### Pause and Resume

```bash
tbd pause <ids...> [--until <when>] [--reason <text>] [--ignore-missing]
tbd resume <ids...> [--reason <text>] [--ignore-missing]
```

Pause records `hold: paused` and optional `hold_until` without erasing `status` or
`started_at`; resume clears the hold.
Both skip closed work.
A passing `hold_until` does not clear the stored hold automatically, so an explicit
resume remains necessary.

#### Ready

List issues ready to work on:

```bash
tbd ready [options]

Options:
  --type <type>             Filter by type
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Algorithm:**

- `status` is `open`

- No `delegate` is acting on it; `assignee` records accountability and does not remove a
  bead from the ready set

- No `hold` is set

- `deferred_until` is absent or has elapsed

- Every bead with a `blocks` dependency targeting it is closed

> **Performance note:** No query index is implemented.
> `tbd ready` currently loads and scans all issues, builds the blocking-target set in
> memory, filters by the predicate above, sorts the result, and applies the limit.

#### Blocked

List blocked issues:

```bash
tbd blocked [options]

Options:
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Output:**

```
ISSUE       TITLE                    BLOCKED BY
proj-c3d4     Write tests              proj-f14c (Add OAuth)
proj-e5f6     Deploy to prod           proj-a1b2, proj-c3d4
```

#### Stale

List issues not updated recently:

```bash
tbd stale [options]

Options:
  --days <n>                Days since last update (default: 7)
  --status <status>         Filter by status (default: open, in_progress)
  --limit <n>               Limit results
  --json                    Output as JSON
```

**Examples:**

```bash
tbd stale                    # Issues not updated in 7 days
tbd stale --days 14          # Issues not updated in 14 days
tbd stale --status blocked   # Blocked issues that are stale
```

**Output:**

```
ISSUE       DAYS  STATUS       TITLE
proj-a1b2     12    in_progress  Fix authentication bug
proj-f14c     9     open         Add OAuth support
```

### 4.5 Label Commands

```bash
# Add label to issue
tbd label add <id> <label>

# Remove label from issue
tbd label remove <id> <label>

# List all labels in use
tbd label list
```

**Examples:**

```bash
tbd label add proj-a1b2 urgent
tbd label remove proj-a1b2 low-priority
tbd label list
```

### 4.6 Dependency Commands

Dependencies use the semantics **“A depends on B”** (equivalent to **“B blocks A”**).
This matches Beads convention.

```bash
# Add dependencies: issue depends on each depends-on (each depends-on blocks issue).
# All IDs are validated before anything is written; one call wires several blockers.
tbd dep add <issue> <depends-on...>

# Remove dependencies
tbd dep remove <issue> <depends-on...>

# List dependencies for an issue
tbd dep list <id>

# Blockers can also be declared at creation:
tbd create "title" --depends-on <id> [--depends-on <id2>]
```

**Argument semantics:**

- `<issue>`: The issue that depends on something (the dependent/blocked issue)
- `<depends-on>`: The issue that must be completed first (the prerequisite/blocker)

**Examples:**

```bash
# "Write tests" depends on "Add OAuth" (can't write tests until OAuth is done)
tbd dep add proj-c3d4 proj-f14c
# Output: ✓ proj-c3d4 now depends on proj-f14c

# List what blocks/is blocked by an issue
tbd dep list proj-c3d4
# Output:
# Blocked by: proj-f14c
```

**Data model:** Dependencies are stored on the blocker issue with
`{type: 'blocks', target: blocked-issue-id}`. This enables efficient lookup of “what
does this issue block?”
from its own dependencies array.

**Note**: Currently only supports `blocks` dependency type.
Future: `related`, `discovered-from`.

### 4.7 Sync Commands

```bash
# Full repository sync
tbd sync

# Narrow to one or more surfaces
tbd sync --issues
tbd sync --docs
tbd sync --integrations

# Directional issue sync
tbd sync --pull
tbd sync --push

# Show sync status
tbd sync --status

# Compatibility flags
tbd sync --force
tbd sync --fix

# Recovery controls
tbd sync --no-auto-save
tbd sync --no-outbox
```

With no surface or direction selector, `tbd sync` runs docs, issues, and enabled
external trackers. Docs run first.
The issue phase then:

1. Commits pending local worktree changes before any fetch.
2. Fetches `refs/heads/<sync-branch>` explicitly into its configured remote-tracking
   ref.
3. Rejects unrelated histories or merges the fetched ref into the attached local branch.
4. Runs the configured provider fold after the Git merge and before publication.
5. Commits provider and merge results and pushes the local sync branch.

Surface selectors narrow the run.
`--issues`, `--docs`, and `--integrations` can be combined, but a direction flag cannot
be combined with `--docs` because docs have no remote direction.

Direction flags always select the Git issue surface.
`tbd sync --pull` fetches and merges the Git issue branch without running a tracker.
`tbd sync --push` commits and pushes the Git issue branch without running a tracker.
Naming both a direction and the integration surface is deliberate:
`tbd sync --pull --integrations` also performs inbound tracker reconciliation, while
`tbd sync --push --integrations` performs outbound tracker projection before committing
and pushing. The provider-specific outbound command is `tbd integration sync --push`.

`--status` reports docs and Git issue status and does not run tracker I/O.

**Inert compatibility flags.** `--fix` is accepted, but ordinary data-context setup
already auto-repairs missing and prunable worktrees; corrupted worktrees still require
`tbd doctor --fix`. `--force` is also registered and passed into the full-sync options,
but no current sync path reads it.
It does not overwrite or otherwise change conflict resolution.
`tbd-s18s` tracks either implementing or removing this inert flag.

**Worktree Health Requirement:**

Before performing an issue sync, `tbd sync` enters the same shared data context as other
data commands:

```typescript
async run(options: SyncOptions): Promise<void> {
  await withDataSyncContext(tbdRoot, { lock: true }, async (context) => {
    // Missing and prunable worktrees were auto-materialized under this lock.
    // Corruption failed before this callback with `tbd doctor --fix` guidance.
    await syncIssues(context.dataSyncDir, options);
  });
}
```

The shared context repairs missing and prunable worktrees for ordinary commands.
It never removes a corrupted worktree; only explicit `tbd doctor --fix` attempts that
repair, subject to the `tbd-dmkd` P0 backup defect in §2.3.

**Path Consistency Invariant:** All sync operations MUST use the resolved `dataSyncDir`
path consistently.
Never mix `resolveDataSyncDir()` results with hardcoded `WORKTREE_DIR`
or `DATA_SYNC_DIR` constants.

**Output (sync that auto-materializes a missing worktree):**

```
• tbd-sync worktree was missing; auto-materialized it (fresh clone, or the worktree was removed).
```

**Output (sync with a corrupted worktree):**

```
Error: Shared data-sync worktree is corrupted. Run 'tbd doctor --fix' to repair.
```

### 4.8 Search Commands

tbd searches the issues visible in the local hidden worktree.
The worktree also supports manual `rg` or `grep` queries when file-level search is
useful.

```bash
# Search issue content
tbd search <pattern> [options]

Options:
  --field <field>           Search one field: title, description, notes, labels, or id
  --status <status>         Filter by status
  --case-sensitive          Case-sensitive search (default: case-insensitive)
  --limit <n>               Limit results
  --no-refresh              Skip the current freshness bookkeeping

# --json is a global option and may appear before or after the command.
```

**Examples:**

```bash
# Basic search
tbd search "authentication"

# Search in specific field
tbd search "timeout" --field description

# Search open issues only
tbd search "TODO" --status open

# Limit results
tbd search "error" --limit 10
```

**Output (default):**

```
Found 2 results:

proj-a1b2 ○ Fix authentication timeout
  [description] ...users experiencing authentication timeout after 5 minutes...

proj-f14c ○ Add OAuth support
  [notes] ...need to handle timeout during OAuth callback...
```

**Output (--json):**

```json
[
  {
    "id": "proj-a1b2",
    "priority": 2,
    "status": "open",
    "kind": "bug",
    "title": "Fix authentication timeout",
    "matchField": "description",
    "match": "...users experiencing authentication timeout after 5 minutes..."
  }
]
```

#### Implementation Notes

Search is currently implemented as an **in-memory scan**:

1. Load every issue from the local hidden worktree.
2. Apply the optional status filter.
3. Search the selected field, or `title`, `description`, `notes`, `labels`, then display
   `id`, stopping at the first matching field for each issue.
4. Apply the result limit and format the resulting issue-level matches.

There are no current type, label-selection, line-context, files-only, or count options.

**False freshness defect (`tbd-iwup`).** Unless `--no-refresh` is present, the command
checks machine-local `last_sync_at`. When that value is missing or older than five
minutes, it prints `Refreshing worktree...` and advances the timestamp, but performs no
Git fetch, pull, or other remote observation.
No successful sync path currently writes this marker.
Search therefore reads only the local hidden worktree and may return stale results even
after claiming to refresh.
`--no-refresh` suppresses this bookkeeping; it does not change the underlying Git state.
`tbd-iwup` tracks the runtime fix.

> **Future Enhancement:** For improved performance on large repositories (10K+ issues),
> search could be optimized to use ripgrep (`rg`) against the worktree files directly.
> See §7.2 Future Enhancements for details.

```bash
# Search local state without freshness bookkeeping
tbd search "pattern" --no-refresh
```

### 4.9 Maintenance Commands

#### Status

The `status` command is the “orientation” command—like `git status`, it works regardless
of initialization state and helps users understand where they are.

> **Note:** Unlike Beads where `bd status` is just an alias for `bd stats`, `tbd status`
> is a distinct command that provides system orientation, not issue statistics.
> Use `tbd stats` for issue counts.

```bash
tbd status
tbd --json status          # --json is global and may also follow the command
```

**Behavior when NOT initialized:**

```
$ tbd status
Not a tbd repository.

Detected:
  ✓ Git repository (main branch)
  ✓ Beads repository (.beads/ with 142 issues)
  ✗ tbd not initialized

To get started:
  tbd setup --auto          # Migrate from Beads (recommended)
  tbd init --prefix=X       # Surgical init only
```

Without a detected `.beads/` directory, the first suggestion is
`tbd setup --auto --prefix=<name>`.

**Behavior when initialized:**

```
$ tbd status
tbd v0.8.1
Repository: /path/to/repo
  ✓ Initialized (.tbd/)
  ✓ Git repository (main)
  ✓ Git 2.42.0

Sync branch: tbd-sync
Remote: origin
ID prefix: proj-

INTEGRATIONS
  ✓ Portable Agent Skill (./.agents/skills/tbd/SKILL.md)
  ✓ Claude Code hooks (./.claude/settings.json)
  ✓ AGENTS.md (./AGENTS.md)
  ✓ Codex hooks (./.codex/hooks.json)

Worktree: /path/to/repo/.git/tbd/data-sync-worktree (healthy)

Use 'tbd stats' for issue statistics, 'tbd doctor' for health checks.
```

The exact human output adds a Beads coexistence warning when relevant, a docs-drift line
when managed forks exist, and a `WORKSPACES` section when workspaces exist.
It does not calculate sync divergence, last-sync time, or issue counts; use
`tbd sync --status` and `tbd stats` for those separate views.

**Output (--json) when initialized:**

```json
{
  "initialized": true,
  "tbd_version": "0.8.1",
  "working_directory": "/path/to/repo",
  "git_repository": true,
  "git_branch": "main",
  "git_version": "2.42.0",
  "git_version_supported": true,
  "beads_detected": false,
  "beads_issue_count": null,
  "sync_branch": "tbd-sync",
  "remote": "origin",
  "display_prefix": "proj",
  "worktree_path": "/path/to/repo/.git/tbd/data-sync-worktree",
  "worktree_healthy": true,
  "worktree_status": "valid",
  "workspaces": [],
  "docs_drift": null,
  "integrations": {
    "portable_skill": true,
    "portable_skill_path": "./.agents/skills/tbd/SKILL.md",
    "claude_code": true,
    "claude_code_path": "./.claude/settings.json",
    "codex": true,
    "codex_path": "./AGENTS.md",
    "codex_hooks": true,
    "codex_hooks_path": "./.codex/hooks.json"
  }
}
```

The uninitialized JSON form uses the same object shape.
It sets `initialized` to `false`, reports Git, Beads, version, working-directory, and
integration detection, and emits `null` or empty values for repository-only fields.
It has no `suggestion`, cursor, sync-status, or issue-count summary beyond
`beads_issue_count`.

#### Stats

```bash
tbd stats
```

**Output:**

```
Issues: 127
  Open: 43
  In Progress: 12
  Blocked: 8
  Deferred: 5
  Closed: 59

By Type:
  bug: 34
  feature: 52
  task: 38
  epic: 3

By Priority:
  0 (critical): 3
  1: 15
  2: 45
  3: 42
  4: 22
```

#### Doctor

```bash
tbd doctor [options]

Options:
  --fix                     Auto-fix issues
  --json                    Output as JSON
```

**Checks performed:**

The doctor command performs comprehensive health checks organized into categories:

**1. Worktree Health Check**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Worktree missing | ok (`not created yet`) | yes, with `--fix`; otherwise the next data command initializes it | Directory and live registration are absent |
| Worktree prunable | error | yes | `git worktree list` shows prunable |
| Worktree corrupted | error | yes, only through explicit `doctor --fix` | Unregistered occupant, missing or invalid `.git`, detached `HEAD`, or wrong branch |

An ordinary data command also repairs a missing or prunable worktree under the shared
lock. Doctor keeps the prunable state visible when run without `--fix`, while a missing
worktree is a valid not-yet-initialized state.

**2. Sync Branch Health Check**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Local branch missing | error | yes | `refs/heads/tbd-sync` doesn’t exist |
| Remote branch missing | warning | no | `refs/remotes/origin/tbd-sync` doesn’t exist |
| Local/remote diverged | warning | no | `git merge-base` != either HEAD |

**3. Sync State Consistency Check**

Only runs if worktree is healthy:

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Worktree HEAD != local branch | error | yes | Different commit SHAs |
| Local ahead of remote | info | no | `git rev-list` count > 0 |
| Local behind remote | info | no | `git rev-list` count > 0 |

**4. Data Location Check**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Issues in wrong location | error | yes | Files exist in `.tbd/data-sync/issues/` on main |
| Local data exists but remote empty | error | no | Worktree has issues, remote tbd-sync has none |

**5. Schema and Reference Checks**

| Check | Severity | Auto-fixable | Detection |
| --- | --- | --- | --- |
| Schema version incompatible | error | no | `meta.yml` version > supported |
| Orphaned dependencies | warning | yes | Dependency target doesn’t exist |
| Duplicate IDs | error | yes | Multiple files with same short ID |
| Invalid references | warning | yes | `parent_id` points to missing issue |

**Example output:**

```
Checking tbd health...

✗ ERROR: Worktree is prunable
  Fix: Run `tbd doctor --fix` to repair

✗ ERROR: Found 951 issues in wrong location (.tbd/data-sync/)
  Fix: Run `tbd doctor --fix` to migrate to worktree

⚠ WARNING: Remote branch 'origin/tbd-sync' does not exist
  Fix: Run `tbd sync` to push local branch to remote

3 error(s), 1 warning(s), 0 info(s)

Run `tbd doctor --fix` to auto-fix 2 issue(s)
```

**`--fix` behavior:**

The `--fix` flag performs repairs in this order:

1. If worktree corrupted:
   - Attempt to copy it to
     `$GIT_COMMON_DIR/tbd/backups/corrupted-worktree-backup-YYYYMMDD-HHMMSS/`
   - Remove the corrupted worktree directory
2. If worktree prunable: `git worktree prune`
3. If worktree missing (or was just removed):
   - If local tbd-sync exists:
     `git worktree add $GIT_COMMON_DIR/tbd/data-sync-worktree tbd-sync`
   - Else if remote exists: fetch `refs/heads/tbd-sync:refs/remotes/<remote>/tbd-sync`,
     then create the local branch and worktree from that remote-tracking ref
   - Else: `git worktree add --orphan tbd-sync ...`
4. If data in wrong location (`.tbd/data-sync/`):
   - Backup to `$GIT_COMMON_DIR/tbd/backups/tbd-data-sync-backup-YYYYMMDD-HHMMSS/`
   - Copy to worktree
   - Commit in worktree
5. Rebuild ID mappings if corrupted
6. Remove orphaned dependency references

> **Note:** Migration and repair backups are stored under `$GIT_COMMON_DIR/tbd/backups/`
> (alongside the shared sync worktree, outside the working tree and never committed).
> Older clients may still have data in `.tbd/backups/`, which is kept gitignored for
> legacy compatibility but is no longer the active write location.
> Users can manually inspect backups in either location to recover any data that wasn’t
> committed before the worktree became corrupted.
> The current copy failure is swallowed before deletion and the intended path is still
> reported. This is the `tbd-dmkd` P0 release blocker described under Worktree Lifecycle;
> do not rely on the backup until that defect is fixed.

#### Compact (Future)

```bash
tbd compact [options]

Options:
  --dry-run                 Show what would be compacted
  --keep-days <n>           Keep closed issues for n days (default: 90)
```

**Note**: All closed issues are kept.
Compaction is a future enhancement.

#### Config

```bash
tbd config show                    # Show all configuration
tbd config get <key>               # Get a configuration value
tbd config set <key> <value>       # Set a configuration value
```

**Examples:**

```bash
tbd config show
tbd config get display.id_prefix
tbd config set sync.remote upstream
tbd config set display.id_prefix cd
```

### 4.10 Global Options

The root command registers these global options:

```bash
--dry-run                   Show what would be done without making changes
--verbose                   Enable verbose output
--quiet                     Suppress non-essential output
--json                      Output as JSON
--color <when>              Colorize output: auto, always, never (default: auto)
--debug                     Show internal IDs alongside public IDs for debugging
```

The root also provides built-in `--help` and `--version`. There are no global `--db`,
`--dir`, or `--actor` options.
`--dir` is local to workspace import/save operations.

**Exit Codes:**

Exit codes are repo-wide and defined in one module, so shell and agent recipes can
branch on them without reading command source:

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Operational error, including unexpected errors and failed health checks |
| 2 | Usage error: an invalid flag, argument, or selector |
| 3 | No matching change: `tbd changes` found none, or `tbd watch --timeout` elapsed (§4.14) |
| 130 | Interrupted by SIGINT (128 + 2) |

Code 3 is the only “nothing happened” signal, and it is distinct from both failure modes
on purpose: a recipe can retry exit 3 forever while still failing fast on exit 2.

**Color Output:**

The `--color` option controls ANSI color output consistently across all commands:

- `auto` (default): Enable colors when stdout is a TTY, disable when piped/redirected

- `always`: Force colors (useful for `less -R` or capturing colored output)

- `never`: Disable colors entirely

This follows the same convention as `git`, `ls`, `grep`, and other Unix tools.

**Actor identity:** Claim-oriented commands resolve the acting name from their command
specific `--as` option, `TBD_AGENT`, machine-local session identity, then a derived
`<harness>@<host>` fallback.
This identity populates `delegate` for guarded ownership operations such as `tbd start`;
it is not a global flag, does not automatically fill `created_by`, and is not attached
to sync commits. Section 8.1 defines the current claim contract.

**Agent/Automation Flags:**

These options enable automation in CI/CD pipelines and by AI agents:

- `--dry-run`: Shows what changes would be made without actually making them.
  Essential for verifying agent-planned operations before execution.

- `--verbose`: Enables detailed debug output to stderr.
  Useful for troubleshooting.

- `--quiet`: Suppresses informational messages.
  Only errors and JSON data are output.
  Combine with `--json` for pure machine-readable output.

Example agent workflow:

```bash
# CI pipeline: create issue with JSON output
CI=1 tbd create "Deploy failed" --type bug --priority=2 --json

# Agent: preview an administrative field change
tbd update proj-abc1 --priority=1 --dry-run --json

# Agent: use the guarded ownership command to claim work
tbd start proj-abc1 --as build-agent

# Batch script: close multiple issues
tbd close proj-abc1 proj-abc2 proj-abc3 --quiet
```

### 4.11 Attic Commands

The attic preserves data lost in merge conflicts.
These commands enable inspection and recovery.

**Entry ID Format:**

Attic entries are identified by a composite ID derived from the entity, timestamp, and
field:

```
{entity-id}/{timestamp}_{field}

Examples:
  is-01hx5zzkbkactav9wevgemmvrz/2025-01-07T10-30-00Z_description
  is-01hx5zzkbkbctav9wevgemmvrz/2025-01-08T09-00-00Z_title
  is-01hx5zzkbkactav9wevgemmvrz/2025-01-07T11-45-00Z_full    # Full entity conflict (rare)
```

- **entity-id**: The issue ID (e.g., `is-a1b2c3`)

- **timestamp**: ISO8601 timestamp with colons replaced by hyphens (filesystem-safe)

- **field**: The field name that was overwritten, or `full` for complete entity
  conflicts

This format ensures unique, sortable entry IDs that can be easily parsed and allow
filtering by entity or time range.

```bash
# List attic entries
tbd attic list [options]

Options:
  --id <id>                 Filter by issue ID
  --field <field>           Filter by field name
  --since <date>            Entries since date
  --limit <n>               Limit results
  --json                    JSON output
```

**Output:**

```
TIMESTAMP                  ISSUE      FIELD        WINNER
2025-01-07T10:30:00Z      proj-a1b2    description  remote
2025-01-07T11:45:00Z      proj-a1b2    notes        local
2025-01-08T09:00:00Z      proj-f14c    title        remote
```

```bash
# Show attic entry details
tbd attic show <id> <timestamp> [options]

Options:
  --json                    JSON output
```

**Output:**

```
Attic Entry: 2025-01-07T10-30-00Z_description

Issue: proj-a1b2 (Fix authentication bug)
Field: description
Timestamp: 2025-01-07T10:30:00Z

Winner: remote (version 4)
Loser: local (version 3)

Lost value:
  Original description text that was overwritten...

Context:
  Local updated_at: 2025-01-07T10:25:00Z
  Remote updated_at: 2025-01-07T10:28:00Z
```

```bash
# Restore value from attic
tbd attic restore <id> <timestamp> [options]

Options:
  --dry-run                 Show what would be restored
```

**Example:**

```bash
# Preview restoration
tbd attic restore proj-a1b2 2025-01-07T10-30-00Z --dry-run

# Apply restoration (creates new version with restored value)
tbd attic restore proj-a1b2 2025-01-07T10-30-00Z
```

> **Note:** Restore creates a new version of the issue with the attic value applied to
> the specified field.
> The original winning value is preserved in a new attic entry, maintaining the “no data
> loss” invariant.

### 4.12 Output Formats

**Human-readable** (default):

- Aligned columns

- Relative timestamps ("2 hours ago")

- Color coding (if terminal supports)

**JSON** (`--json`):

- Complete entity objects

- Absolute ISO8601 timestamps

- Parseable by scripts

- `tbd changes` and `tbd watch` instead emit a versioned change report (§4.14.3)

* * *

### 4.13 Docs Commands

Operations on managed docs (see §2.9 for the data model) live under the noun-scoped
`tbd docs` group, alongside the existing per-kind readers (`tbd guidelines`,
`tbd shortcut`, `tbd template`, which serve forked copies transparently via lookup
precedence):

```bash
tbd docs fork [names...] [--kind] [--all] [--force] [--dry-run]   # copy into docs/tbd/
tbd docs unfork [names...] [--all] [--force]   # back to upstream; refuses to drop edits
tbd docs status [--json]                       # per-doc states + missing/local hints
tbd docs update [names...] [--merge|--keep-ours] [--dry-run]      # reconcile with upstream
tbd docs diff <name> [--base|--upstream]       # net fork / your changes / incoming
tbd docs list [--kind] [--json]                # cross-kind list with state markers
```

tbd has three deliberately separate update surfaces; they differ in scope, risk, and
failure mode, and doc updates are the only one that can merge and mutate tracked files:

| Command | Scope | Touches | Modifies tracked files? |
| --- | --- | --- | --- |
| `tbd sync` | project data (issues) | sync worktree + `tbd-sync` branch; refreshes the doc cache and *reports* fork drift | never |
| `tbd setup --auto` | installation + integrations | skills, hooks, settings, `AGENTS.md`; invokes a docs-cache sync | only generated integration files |
| `tbd docs update` | forked docs | fork dir + bases + manifest (offline, against the cache) | **yes, the only doc command that does** |

Update semantics (the full decision table is unit-tested row by row): an unmodified
stale fork is replaced; a customized stale fork gets a `git merge-file` three-way merge
that applies automatically when clean; conflicts are skipped by default and listed with
the two explicit strategies: `--merge` (combine, standard conflict markers, sets the
`conflicted` flag until markers are resolved) and `--keep-ours` (keep the local content,
advance the fork point).
Forked files are git-tracked, so every applied update is reviewable in `git diff` and
revertible; git is the undo.

### 4.14 Change and Watch Commands

Two commands expose the observation path of §3.7. They share one selector grammar and
one report format. Neither mutates bead data or canonical sync refs; `tbd watch`
temporarily manages the private refs described there.

```bash
tbd changes --since <commit> [selectors] [--json]     # one-shot local commit diff
tbd watch <selector> [--since <commit>] [--json] \    # block until a matching change
  [--interval <seconds>] [--timeout <seconds>]
```

`tbd changes` answers “what moved since this commit?”
against the local sync branch.
`tbd watch` answers “tell me when something moves” against the remote sync branch.
At f08, “moves” means an issue record changes.
The commands do not select or report candidate native comments; §3.7 describes why a
comment-only commit is treated as unrelated movement and what must change before
activation.

Watch reports one change and exits rather than streaming.
That keeps the no-daemon property (§7.1, Decision 2), makes a wake composable with
ordinary process control (a shell loop, a background task, a spawned agent), and gives
the caller an explicit resume point instead of an open connection to babysit.
Raw `tbd watch` persists no cursor.
Without `--since`, a restarted invocation uses the then-current remote tip as its
baseline and can skip a report the caller lost.
At-least-once processing requires the caller to persist the prior baseline and report,
advance the checkpoint only after successful handling, and make actions idempotent.
The shipped `watch-beads` shortcut demonstrates that protocol.

#### 4.14.1 Baseline Commits

`--since <commit>` takes an ordinary Git commit-ish, resolved in the caller’s repository
with `git rev-parse --verify <commit>^{commit}`. Any spelling Git accepts works: a full
or abbreviated SHA, `tbd-sync~3`, or a tag.
It is not an issue ID, a timestamp, or a tbd-internal sequence number.

The baseline must lie on the sync branch’s history.
Both commands check `git merge-base --is-ancestor <since> <tip>` and fail when it does
not hold, so a commit from a working branch such as `main` is rejected.

The tip differs by command:

| Command | Tip | Freshness |
| --- | --- | --- |
| `tbd changes` | `refs/heads/<sync.branch>` | local sync branch as of the last `tbd sync`; no fetch, and unsynced edits in the hidden worktree are invisible |
| `tbd watch` | remote tip fetched into a private ref | current remote state at the moment of the wake |

In practice a baseline comes from a previous report: every report carries the full
resolved `since` and `tip` commit IDs it used, and passing that `tip` back as `--since`
closes the gap between invocations.
For `--ready`, that commit checkpoint does not reproduce the earlier selection after
wall-clock time advances because the report does not yet persist its readiness
evaluation instant.
Callers that require at-least-once processing must persist and finish
handling the emitted report before advancing its checkpoint.
Without a previous report, any sync-branch commit works, for example
`git rev-parse tbd-sync`.

A baseline is durable but not eternal.
If sync recovery rewrites the sync branch, a saved baseline stops being an ancestor of
the new tip; the command fails with that reason and the caller starts from a new
baseline.

#### 4.14.2 Selectors

| Selector | Kind | Meaning |
| --- | --- | --- |
| `--bead <ids...>` | static | one or more named beads |
| `--label <label>` | dynamic | beads carrying the label (repeatable, ANDed) |
| `--spec <path>` | dynamic | beads tracking a spec (filename or suffix match) |
| `--status <status>` | dynamic | beads in one status |
| `--ready` | dynamic, edge-triggered | beads newly entering the ready set |
| `--all` | dynamic | every bead |

`--all` cannot be combined with anything, and `--bead` cannot be combined with the
dynamic filters. `tbd changes` defaults to `--all`; `tbd watch` requires an explicit
selector, since an unqualified watch is almost never the intent.

Dynamic filters reuse the same predicates as `tbd list` and `tbd ready`, so a watch
cannot drift from the list it mirrors.
Matching rules:

- **Static.** IDs resolve against the snapshot and an unknown ID is an error, so a typo
  fails immediately instead of waiting forever.
  A watch without `--since` validates its IDs against the local sync branch at startup;
  with `--since` it validates against the union of both endpoints, which allows watching
  a bead that was deleted after the baseline.

- **Filters.** A bead is reported when it matches *before or after*, so entering and
  leaving the set both wake.

- **`--ready`.** A bead is reported only when it matches after and did not match before.
  Ready means open, without a delegate or hold, past any `deferred_until`, and free of
  non-closed blockers, the same predicate `tbd ready` uses (§4.4). `assignee` records
  accountability and does not affect readiness.
  Both endpoint snapshots use one evaluation instant, which prevents a deferral from
  expiring between the two predicate calls.
  That instant is selected anew for each command invocation, so fixed commits alone do
  not currently reproduce ready-edge membership across retries.
  This edge trigger does not return beads already ready at the baseline, and the passage
  of `deferred_until` alone creates no Git commit to observe.
  A general worker therefore scans `tbd ready` at startup, after every pull, and
  periodically; `tbd watch --ready` supplies remote-change wake-ups between those scans.

#### 4.14.3 Change Report Format

Both commands emit the same document.
`--json` prints it verbatim; human output renders it.

```json
{
  "since": "3f2a…",
  "tip": "9c81…",
  "changes": [
    {
      "id": "proj-a7k2",
      "internal_id": "is-01hx5zzkbkactav9wevgemmvrz",
      "title": "API returns 500 on malformed input",
      "change": "updated",
      "fields": [{ "field": "status", "before": "open", "after": "in_progress" }]
    }
  ]
}
```

- Stability follows the same contract as every other `--json` surface (§5.6): fields are
  added, never removed or repurposed, so a consumer ignores what it does not recognize.
  The report is command output rather than repository state, so `tbd_format` (§2.7.4)
  does not describe it and there is no separate report version to check.

- Output order is deterministic: changes sort by internal ID, and fields follow one
  fixed order. The field-order record is compile-time exhaustive, so adding a substantive
  `Issue` field is a type error until its report position is chosen.
  Membership is commit-deterministic except for the invocation-time readiness boundary
  described above.

- `change` is `created`, `updated`, or `deleted`. `fields` covers every substantive
  issue field; `id`, `type`, `version`, and `updated_at` are excluded as bookkeeping.

- `description` and `notes` changes additionally carry `hunks`, a line diff with three
  lines of context. Past a fixed edit-distance cutoff the hunks are replaced by
  `hunks_omitted: "complexity_limit"`; `before` and `after` remain complete, so a
  pathological rewrite costs detail rather than unbounded work.

#### 4.14.4 Watch Loop

1. Reclaim private refs left by dead watchers, then validate a static selection.
2. Read the remote tip with `ls-remote`. The baseline is `--since` when given, otherwise
   this first observed tip.
3. With `--since`, compare immediately, so a change that landed before startup is
   reported instead of missed.
4. Poll: sleep the interval (default 30 seconds, minimum 10), read the remote tip again,
   and continue when it is unchanged.
   When it moved, fetch into the private ref and build a report.
   An empty report means unrelated movement: advance the baseline to that tip and keep
   waiting. A non-empty report prints and exits 0.
5. `--timeout` exits 3, but only after one remote observation at or after the boundary,
   so a change landing exactly on the deadline is not dropped.
6. An established watch rides out consecutive failed polls and aborts on the fifth, so a
   brief outage does not kill an unattended worker.
   Startup failures are immediate, and a failure at the timeout boundary is an
   operational error rather than a silent timeout, since the two are not the same claim.

### 4.15 Local Web View

`tbd web` is an optional, foreground view of the local bead graph for people who need to
scan a large hierarchy visually.
It is a CLI-layer presentation over the same file, query, and statistics implementations
as the terminal commands; it does not introduce another repository model,
synchronization contract, or persistent service.

The interaction boundary is deliberate.
In an agent session, the human asks to see the beads and the agent starts
`tbd web --open`, reports the ready URL, and owns the long-running process.
Browser controls select and arrange data but never mutate it.
The human asks the agent for changes; the agent uses the same ordinary `tbd` mutation
commands it would use without a browser, and the live viewer reflects the resulting
local state. The server is therefore a presentation surface, not an editor or an
alternate agent API.

```bash
tbd web [path] [--port <n>] [--open]
```

The optional path is a repository or any subdirectory within it and is resolved from the
caller’s current directory to a canonical repository root before startup.
Omitting it preserves the normal current-directory discovery contract.
An initialized repository with no beads is a valid empty snapshot.
Missing/non-directory paths are usage errors; existing paths without tbd metadata flow
through the shared `requireInit` error path so `web` does not invent a different
repository contract.

The server binds only `127.0.0.1`. With no explicit port it searches the bounded range
7777–7786; `--port` pins one port, and `--open` launches a browser only after an HTTP
readiness probe succeeds.
The command stays in the foreground and exits when interrupted; no daemon or background
state remains.

Board queries run against one in-memory snapshot and call the shared `selectIssues` and
`describeQuery` functions.
Responses include the equivalent CLI invocation and carry light rows only; descriptions
and notes are fetched per bead when expanded.
Ready retains one definition on every surface: open, without a delegate or hold, past
any `deferred_until`, and without a non-closed blocker.
`assignee` does not affect it.
The checkbox selects that exact `tbd ready` set.
Rows expose the derived state as quiet unboxed text after their real labels; it is
useful scan information, but is neither a lifecycle status nor a user label and must not
be styled as either.
The response carries conditional Status, Type, and Priority facets plus at most 32 label
facets per response.
An empty label search returns the highest-ranked choices; a search queries the complete
label vocabulary before applying the response cap, so every label remains reachable.
While the search field owns focus, its live draft remains authoritative across observer
and request renders until the debounce publishes it.
Home and End retain native caret movement there; the same keys navigate to the first and
last choices only when focus is elsewhere in the menu.
Every tally applies search and all other active dimensions; unselected zero-count values
are omitted.
Label candidates additionally apply every selected label, retaining selected
values for removal and preserving the CLI’s repeated-label AND semantics.
The client clamps collapsed titles at four lines, renders sans relative update ages with
exact literal tooltips, and exposes every data column as an ordered sort key.
The default is Pretty with Updated descending then Priority ascending.
The newest clicked key is primary, only the prior primary remains as a tie-breaker, and
sorting never clears Pretty.
In Pretty, the stack orders only outermost visible parent groups; Updated compares the
maximum timestamp across each entire visible subtree for every parent kind, while
children retain `child_order_hints` order and its deterministic fallback.
The browser deliberately uses a simpler visual grammar than terminal tree output: every
non-root row has exactly one `└──` elbow at its hierarchy indentation, with spaces for
ancestor levels and no tee or vertical-bar variants.
Flat mode applies the stack globally.
Reset restores the default sort stack without changing Pretty.
Because browser ordering is not an exact CLI filter, the response supplies a concise
ordering caveat beside the equivalent command.
Pretty never reinserts a bead excluded by Status, labels, search, or another filter; a
matching descendant whose parent is absent becomes a root, exactly as in
`tbd list --pretty`.

Expanded updated beads show field deltas with an 80-character middle-ellipsis preview
per scalar side. Copy preserves the bounded full values, before is muted historical
context, and after uses normal text.
Created beads omit null-to-current-value deltas as redundant with the expanded body.
The client delegates row expansion to one table-body listener and ignores clicks that
finish a non-collapsed text selection.
Each render restores keyboard focus by stable bead ID and control role, or by label
value inside the chooser.
A failed board refresh keeps the last successful rows visible and changes the persistent
observer indicator to an error state until a successful response clears it.
Render completion also dismisses any tooltip whose anchor was replaced.
These component and semantic rules are maintained in the co-located design-system
inventory in `src/web/styles.css`. Status-panel field names use standard-size sans
chrome and literal values use standard-size monospace; neither side shrinks merely
because the panel is narrow.
Liveness is strictly local.
A recursive Node `fs.watch` over the hidden data-sync worktree maps to native
operating-system notifications on supported local filesystems.
Events are trailing-debounced and trigger one serialized snapshot reload.
A one-second, constant-size reconciliation marker covers the issue directory, mapping
directory, project config, workspace metadata, and local sync-branch ref.
It reloads only when metadata changes, so an unchanged tick never scans or parses the
issue graph. If native watching is unavailable, the marker is the fallback; if marker
reads fail, native events continue.
The UI reports the active mode and enters an error state only when neither path works or
a reload fails.

`tbd web` never calls the remote-watch or sync implementation and never fetches, merges,
or pushes.
Remote exchange remains the explicit `tbd sync` contract used everywhere else.
When that command changes the shared hidden worktree, the same local observer redraws
the page immediately.
This keeps CLI and browser semantics identical and makes offline use predictable.

#### Concurrency and Snapshot Safety

`tbd web` has no worker threads: one Node.js event loop serializes its in-process
mutations. That fact alone is not a safety argument.
Other `tbd` processes can mutate the shared worktree while the viewer is suspended at
any `await`, and filesystem, timer, HTTP, and promise callbacks can arrive in any order.
The required safety property is:

> Every HTTP response and SSE state describes one complete accepted local snapshot.
> A response may briefly be the complete state before or after a write, but never a
> mixture assembled during that write.
> After a standard writer completes its protocol and writes stop, every connected client
> with at least one functioning observation path converges to the newest accepted
> snapshot.

The design establishes that property with these owners and serialization points:

| State | Owner | Serialization rule |
| --- | --- | --- |
| Shared data-sync files | Standard `tbd` writers | Repository writer mutex plus persistent write epoch |
| Accepted server snapshot | `BoardState` | FIFO candidate reads and one synchronous publication step |
| Reload scheduling | `LocalObserver` | One active reload plus one coalesced pending request |
| SSE clients/history | `SseHub` | Synchronous mutation with a bounded client set, per-client queue, and replay ring |
| Browser state | One client store | Monotonic observer versions, one board loop, and cancellable detail generations |

The proof is compact: every supported writer is mutually exclusive and brackets all
shared mutations with one persistent unique epoch; a reader publishes only after seeing
the same quiescent epoch, absent mutex, stable context, and stable marker on both sides
of a strictly validated private candidate.
That final fence is the read linearization point.
Publication has no `await`, observer triggers collapse to one active plus one pending
reload, and server/client versions reject late transport results.
Consequently callbacks may be duplicated, dropped, or reordered, but they can only delay
convergence or cause redundant work: they cannot publish a torn snapshot, roll state
backward, or create concurrent writers.
All waits flow writer lock to mapping lock, never through the viewer or a client, so the
wait graph has no cycle; every queue, retry, and client set is bounded.

**Cross-process snapshot fence.** The shared writer mutex prevents two standard writers
from overlapping. It does not by itself protect a non-locking reader: a complete writer
could acquire and release the transient lock between two reader checks.
Therefore the central shared-lock wrapper also maintains an atomically replaced
persistent epoch in the Git common-dir tbd state.
On lock acquisition it writes `active:<unique-id>` before the critical section; while
still holding the lock it writes `quiescent:<same-unique-id>` after the critical
section, then releases the lock.
Before contending, a writer prepares a complete, non-empty owner-generation directory
containing a unique token, the host, and the process id.
The established atomic `mkdir` remains the sole lock election.
Its winner renames the prepared generation to `lock/owner` before entering the critical
section. This uses the same portable same-filesystem directory-rename primitive already
required for release and stale recovery, not hard links or a second lock mechanism.
Because an installed owner generation is non-empty, a delayed installer cannot replace a
successor’s generation on macOS, Linux, or Windows.
Owner-record open or write failure therefore occurs before the canonical directory
exists; a failed install removes only an empty provisional directory.
Immediately after winning `mkdir`, the contender records the provisional directory’s
filesystem identity (`dev`, `ino`). If owner installation reports failure, it first
checks for ambiguous success by comparing the installed owner token, then verifies that
its token-private prepared generation still exists and compares the canonical identity.
If the canonical reservation vanished or changed, stale recovery or another contender
made concrete progress; the contender does no cleanup and retries.
If the same reservation remains, it attempts only `rmdir` cleanup and surfaces an
unexpected error unchanged.
A last-instant path replacement can therefore make another empty contender retry, but
`rmdir` cannot remove its non-empty installed owner generation.
This state-based classification covers macOS reporting `EINVAL` when an empty parent is
removed during `rename`, without treating a persistent same-generation `EINVAL` or
permission failure as contention.
Directory identity is only a retry/liveness discriminator: an unavailable or
conservatively equal identity can make acquisition fail, but the installed owner token
and non-empty generation still enforce mutual exclusion.
No filesystem handle or mutex is held across these checks.
The shared-data wrapper recognizes permission failures at the canonical lock,
token-private preparation, and nested owner-install paths, while permission errors from
the caller’s critical section pass through unchanged.
The doctor writability check exercises this same complete lifecycle at a unique probe
path rather than testing only the canonical `mkdir`. A crash in the remaining brief
`mkdir`-to-install window leaves no active critical section.
The empty reservation is recoverable after the stale threshold by `rmdir`, which also
preserves the historical mkdir-only recovery contract; a fresh ownerless or non-empty
unrecognized generation fails closed.
A best-effort heartbeat remains well below the stale threshold, but time alone is not
permission to evict a recognized owner.
A stale recognized same-host lock is recoverable only after the OS says its process no
longer exists; an alive, permission-ambiguous, remote-host, or non-empty unrecognized
owner fails closed and is left in place.
This matters after machine sleep or a long event-loop suspension: delayed heartbeats may
reduce liveness, but cannot turn two live writers into concurrent owners.
Heartbeat timestamp or read failure disables that advisory optimization for the current
generation; it does not poison the lease.
Commit and release re-read the unique owner record directly, while same-host process
liveness continues to prevent eviction.

Recovery renames a dead lock to a non-empty quarantine path derived from its unique
owner token and deliberately retains that tombstone.
If several waiters observed the same dead generation, only the first rename can succeed;
a delayed waiter cannot rename a successor into the already-occupied quarantine path.
This removes the canonical-path ABA race without a timing assumption.
Legacy ownerless locks remain outside the strengthened token/PID proof.
They retain the historical behavior: only a stale directory that is still empty can be
removed; a non-empty unrecognized generation requires explicit operator recovery.
Ownership is checked around quiescent publication and again at release, so loss is
surfaced and a displaced holder cannot publish success or delete its successor.
Normal release first renames the verified generation out of the canonical path and only
then removes its owner record, so a transient cleanup failure leaves a harmless sidecar
rather than an ownerless lock that blocks every later writer.
The reader’s independent lock check additionally prevents it from accepting a transient
epoch while a recognized owner is active.
This is a seqlock-style fence, not a polling signal.
A crashed writer leaves an active epoch, so readers remain on their last accepted
snapshot until a later locked preparation or writer establishes a new quiescent epoch.
Updating the central lock wrapper covers create, update, import, and `tbd sync` without
giving the web command a second mutation implementation.

Before the listener or observer exists, startup acquires that wrapper once to
initialize, migrate, or repair the layout and to establish a quiescent epoch.
It owns no HTTP, watcher, timer, or SSE resource while it can wait for the writer lock.
The long-running viewer never acquires or waits for that lock, so it cannot delay a CLI
writer or join a cross-process lock cycle.

**Optimistic read transaction.** `BoardState.reload` serializes reloads FIFO and stages
all work in private variables.
It reads a first epoch and requires it to be quiescent, confirms the mutex is absent,
loads context and all issue files, and strictly validates the candidate: directory-read,
parse, filename/ID, mapping, and context errors reject the entire candidate rather than
silently omitting rows.
It then reads the epoch and mutex again.
Publication is allowed only when the second epoch is the identical quiescent value and
the mutex is still absent.
Configuration is atomically replaced; loading and comparing context on both sides of the
candidate prevents a configuration or mapping change from being combined with paths
interpreted under another context.
The constant-size reconciliation marker remains useful for missed-event detection and as
an additional instability check.
It combines filesystem metadata with the bounded epoch token, so a fast complete writer
is still visible on filesystems with coarse timestamps; the epoch equality check, not
timestamps, is the transaction proof.

The final successful fence check is the read transaction’s linearization point.
A writer that overlaps any candidate read leaves the lock active, an active epoch, or a
different final epoch.
A writer that starts afterward can make the accepted snapshot old, but cannot make it
torn. `BoardState` then computes movement and replaces context, indexes, rows, and
summary state in one synchronous segment containing no `await`. Request handlers also
copy the accepted board and its observer state without an intervening `await`;
JavaScript run-to-completion therefore exposes either the complete old snapshot or the
complete new one. Rejected candidates do not mutate served state or advance the
observer’s reconciliation marker.
They leave one bounded retry.
Initial load applies the same rule for at most ten seconds and fails instead of serving
an empty or mixed board.

The fence proof covers current standard `tbd` writers.
Atomic single-file configuration replacement is independently safe, and diagnostic
Git/workspace fields may be from an earlier or later instant without changing bead-graph
consistency.
A process or older binary that bypasses the shared writer wrapper is outside
the guarantee; supporting it would require that writer to adopt the same epoch protocol.
The epoch detects overlapping mutation; it does not add rollback to a CLI command.
After a command returns an error, storage-valid files it deliberately completed are
stable local state, while malformed or missing candidate data fails closed.
A process suspended longer than the lock’s stale threshold remains the owner while its
same-host pid is alive; the protocol chooses safety over automatically recovering a hung
process. PID reuse or an owner on another host can therefore delay progress, but cannot
create concurrent writers.
Automatic recovery assumes the owner and waiter share the supported local worktree’s OS
PID namespace. A different host identity fails closed; deployments that deliberately
share one worktree across PID namespaces are outside automatic recovery and require
operator verification.
If a process exits while its epoch is active, a later writer may quarantine that dead
generation after the stale threshold and establish a new quiescent epoch.
Ambiguous or legacy lock state intentionally fails closed and requires the operator to
verify that no writer remains before removing it.

**Observation and publication.** Filesystem events are wake-up hints, not an ordered
change log. Native events use a 250 ms trailing debounce; a one-second constant-size
metadata check repairs missed or coalesced events.
While a reload is active, arbitrarily many triggers collapse into one pending request,
which runs immediately afterward.
There is no event-count promise queue.
Movement is derived only from the two accepted `id:version` and display-ID snapshots, so
duplicate, missing, and reordered events are harmless.
Several completed writes inside one debounce window intentionally produce one aggregate
transition from the last accepted state to the newest state.

**Transport and browser ordering.** Publication is state convergence, not exactly-once
event delivery. `stateVersion` increases for every publication, `dataVersion` only for
accepted graph movement, and a fresh `observerId` starts a new ordering epoch after
restart. SSE close/error handlers and client membership are installed before the first
frame. Reconnect replay is a bounded chronological suffix ending in current state; a
slow, closed, or over-budget client is removed without blocking any other client.

The browser opens SSE before its initial board request.
It rejects duplicate or older versions from the same observer, accepts a restarted
observer’s lower counters, and lets a canonical board response replace a bounded SSE
summary at the same version.
One coalescing refresh loop aborts superseded board requests.
Detail requests are capped at eight and carry both a graph generation and a per-request
token; collapse, graph motion, or shutdown aborts them, and a late success or failure
cannot populate the current cache.
Thus transport duplication or response reordering can cause an extra fetch, but cannot
roll back adopted state or create duplicate rows.

**Shutdown and progress.** Shutdown stores one idempotent promise, marks the observer
stopped before closing the watcher, cancels debounce/retry/reconciliation timers, and
clears the pending slot.
Completion callbacks check `stopped` after every `await`, so in-flight reads cannot
publish late.
The server unsubscribes first, allows the one active reload a bounded grace
period, then closes SSE clients and HTTP connections; work that outlives the grace
period is harmless because publication is fenced off.
Every queue and buffer has an explicit bound, and retries are timer-driven rather than
busy loops; the connection cap also bounds aggregate fan-out work.
Since the live viewer takes no writer lock, writers wait for no viewer resource, SSE
fan-out waits for no client, and shutdown waits for no writer, the wait graph is acyclic
and has no deadlock path.
Within writer processes the only nested data lock order is repository lock, then the
append-only mapping-file lock; no standard path acquires them in reverse order.

These cases are the compact proof obligation and the required adversarial test matrix:

| Interleaving | Required result |
| --- | --- |
| Writer is active, or starts/finishes during a candidate read | Epoch/lock validation rejects the candidate; old accepted state remains served |
| Live lock crosses stale windows, including machine sleep | PID liveness prevents eviction; the second writer waits or times out and no overlap occurs |
| Owner-record preparation or installation fails | Preparation fails before canonical acquisition; installation cleanup removes only an empty provisional reservation and never overwrites a successor |
| Empty reservation is removed while owner rename is in flight, including macOS `EINVAL` | Changed directory identity proves generation movement; the private owner source remains intact, no cleanup is attempted against the observed replacement, and acquisition retries. The same error against the same generation is surfaced instead of spun |
| Hard links are unsupported | The established mkdir election plus same-filesystem directory rename still acquires; no hard-link syscall is used |
| Stale ownerless lock is unexpectedly non-empty | Empty-only recovery makes no progress and the contender waits on its bounded polling cadence; it neither removes unknown data nor spins |
| Prepared owner generation disappears during install | Empty-only cleanup preserves any successor, then acquisition fails immediately because retry cannot make progress without its token-private source |
| Owner preparation or installation is not writable | The shared writer reports the actionable shared-lock error, doctor reproduces the complete lifecycle, and an unrelated critical-section permission error is not relabeled |
| Dead-generation quarantine is already occupied | No canonical generation moves and the contender waits on its bounded polling cadence; retained data and mutual exclusion remain intact |
| Heartbeat metadata update fails while ownership remains valid | The direct owner fence still quiesces and releases the generation; no active epoch or canonical lock is stranded |
| Several waiters retain one stale observation while a successor acquires | One owner-token quarantine wins; its retained tombstone makes every delayed rename fail without touching the successor |
| Candidate issue, mapping, or epoch data is unreadable, corrupt, or oversized | The entire candidate fails closed; no empty or partial substitute is published |
| Native and reconciliation callbacks overlap or repeat | One active plus one pending reload; final accepted state is published once as an aggregate transition |
| SSE attach/close races with publication, or connection capacity is exhausted | Handlers exist before frames; current state is included; only that client is dropped or rejected |
| Board/detail response completes after newer state or controls | Abort plus observer/version/generation checks discard it |
| Shutdown occurs at every `await` boundary | No post-stop publication, no retained timer/watcher/client, and bounded server close |

After a standard writer quiesces, native notification normally starts convergence after
250 ms; if that hint is lost, the next one-second reconciliation check does.
Reload time is additional and scales with the local issue count.
The contract deliberately does not promise one animation per filesystem event or remote
liveness: only explicit `tbd sync` changes remote state, and its locally committed
result follows this same path.

The client opens its event stream before its first board fetch, coalesces refreshes, and
bounds concurrent detail requests.
Each observer process has a fresh instance id and a monotonic state version, so the
client rejects stale metadata even when the bead graph version is unchanged, accepts the
canonical board state at the same version after a bounded event frame, and accepts a
restarted observer’s lower counters.
A delayed duplicate event at an already-adopted version cannot replace that canonical
state. Board responses carry at most 10,000 light rows and retain the full match count
when truncated. Pretty never bypasses filters by serializing ancestors as extra context.
The browser renders those rows in 5,000-row pages, exposes sticky and end-of-page
navigation, and allows bulk detail expansion only when 100 rows or fewer are visible on
the page. This threshold is empirical rather than round-number preference: a production
Chromium stress page measured 93,323 elements and 1.71–2.55 seconds at 5,000 rows,
versus 186,380 elements and 2.81–5.50 seconds at 10,000. The former is a usable
last-resort page; the latter adds substantial layout and garbage-collection variance.
At most 100 details remain expanded, the body cache retains 200 entries, and a mass
deletion animates at most 100 ghost rows.
Changed and removed row ids remain complete in the canonical board state for the latest
graph movement; a bounded event frame is only the notification that causes the client to
fetch that state.
Field-level before/after detail is diagnostic and separately bounded to
100 changed beads and 256 KiB, with oversized values summarized rather than retained in
the board state. These are separate resource bounds: the response ceiling supports
unusually large projects, while the render, expansion, cache, and motion ceilings keep
DOM layout, memory, and detail-request work responsive.

Version 1 is intentionally read-only: the HTTP router has no mutation endpoint.
It accepts only `GET`, validates loopback Host and same-origin Origin headers, serves a
self-contained page under a restrictive Content Security Policy, caps event frames and
replay buffers, and applies an explicit queued-byte ceiling per client before dropping a
slow connection. An ended stream or write-time close race drops only that client rather
than escaping a publish or heartbeat into the process.
It closes streams during bounded signal shutdown.
A remotely reachable or writable interface remains a separate design with its own
authentication, concurrency, and security review.

* * *

## 5. Beads Compatibility

### 5.1 Import Strategy

Current tbd has two import entry points with different responsibilities:

- `tbd setup --from-beads` initializes a repository, imports the current Beads JSONL
  file, disables the Beads directory, and installs selected agent surfaces.
- `tbd import <file>` imports an explicit JSONL file into an already initialized
  repository. The same command also imports tbd workspaces and the outbox.

Neither path scans Git branches or merges several Beads snapshots.
If the working copy and a Beads sync branch differ, reconcile them with Beads or export
the intended snapshot before migration.

#### 5.1.1 One-Step Beads Migration

```bash
tbd setup --from-beads [options]

Options:
  --prefix <name>       Override the prefix read from Beads
  --force               Allow a non-recommended but valid prefix
  --no-gh-cli           Disable the GitHub CLI setup hook
  --surfaces <list>     portable,agents-md,claude,codex,all (default: all)
```

`--from-beads` implies noninteractive `--auto` mode and requires a `.beads/` directory
at the Git root. The migration:

1. Reads the Beads prefix, unless `--prefix` supplies one.
2. Initializes `.tbd/` and the hidden sync worktree.
3. Imports only the working-tree `.beads/issues.jsonl`, when present.
4. Moves `.beads/` to `.beads-disabled/`.
5. Synchronizes managed docs and installs every selected agent surface.

Use `--surfaces=claude` for only Claude Code hooks, `--surfaces=agents-md` for only
`AGENTS.md`, or combine comma-separated names.
`codex` selects Codex hooks; `portable` selects the portable Agent Skill.
Omitting `--surfaces`, or selecting `all`, installs all four.

**Migration data-safety defect (`tbd-lgtd`).** The current setup handler catches an
exception from the JSONL import, prints a warning, and proceeds to disable `.beads/`. A
missing JSONL file is also skipped before that move.
Within the importer, individual issue-write failures are counted before the write and
are only reported in verbose mode, so setup can also continue without an outer
exception. The shipped flow is therefore not fail-closed and must not be described as a
verified safe cutover.
`tbd-lgtd` tracks requiring a complete import before disabling Beads.

#### 5.1.2 Explicit JSONL and Workspace Import

```bash
# Initialized repository: import a Beads-compatible JSONL snapshot
tbd import <file> [--merge] [--verbose]

# Compare an existing import with a Beads directory
tbd import --validate [--beads-dir <path>] [--verbose]

# Import saved tbd state
tbd import --workspace=<name> [--clear-on-success]
tbd import --dir=<path> [--clear-on-success]
tbd import --outbox
```

`--dry-run` and `--json` are global options.
There is no `--format`, `--from-beads`, `--branch`, `--include-tombstones`, or
`--skip-tombstones` option on `tbd import`.

The file importer parses nonempty JSONL lines, skips malformed rows, and accepts rows
that have both `id` and `title`. It detects the most common display prefix among the
first ten accepted rows and may update `display.id_prefix` before writing issues.

#### 5.1.3 ID Mapping and Re-Import

Every imported issue receives an internal `is-{ulid}` identity.
When available, the short portion of the Beads ID is retained in
`.tbd/data-sync/mappings/ids.yml`, and provenance is stored on the issue:

```yaml
extensions:
  beads:
    original_id: tbd-100
    imported_at: 2026-09-10T10:00:00.000Z
```

On a later import, `extensions.beads.original_id` is the primary identity match.
Without `--merge`, a source row whose `updated_at` is not newer than the existing issue
is skipped; a newer row is converted again and replaces the imported fields while
advancing the issue version.
`--merge` forces that replacement regardless of timestamp.
This is not the field-wise Git merge algorithm and it does not archive per-field losers.

An occupied mapping row with no loaded issue causes the importer to allocate a new
internal and short ID. A different, unsafe case exists when an unrelated loaded issue
already owns the desired short ID: the current code reuses that issue internal ID and
can overwrite its file rather than allocate a replacement.
`tbd-0oz8` tracks this destructive import-collision defect as a release-safety blocker.

Normal sync-merge collisions follow the separate deterministic repair in §2.6: the
smallest ULID keeps the contested short ID and displaced ULIDs receive derived
replacements.

#### 5.1.4 Field and Relationship Conversion

The importer maps recognized statuses and kinds through the tables in §§5.3–5.4. An
unknown status becomes `open`, an unknown kind becomes `task`, and an invalid priority
becomes 2. Beads `tombstone` maps directly to `closed`; no tombstone selection flags or
automatic deletion label exist.

The first pass allocates identities for all accepted rows.
The second pass translates `blocks` dependency targets and `parent` through that map.
Missing targets are omitted.
Although `blocked_by` is recognized while reading, the current converter does not add
its inverse edge, so that relationship is dropped.

#### 5.1.5 Migration Workflow

For the supported one-step cutover:

```bash
# First make the working-tree .beads/issues.jsonl the intended source snapshot.
bd sync

# Preview all setup effects, including selected surfaces.
tbd --dry-run setup --from-beads --surfaces=all

# Migrate, then verify the result before relying on .beads-disabled/.
tbd setup --from-beads --surfaces=all
tbd stats
tbd import --validate --beads-dir=.beads-disabled --verbose
tbd sync
```

Because of `tbd-lgtd`, retain an independent Beads backup and inspect validation output
until the setup cutover is fail-closed.
For a controlled explicit snapshot, initialize with `tbd init --prefix=<name>` and run
`tbd import <file>`; explicit file import does not disable Beads.

### 5.2 Command Mapping

| Beads Command | tbd Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `tbd init --prefix=<name>` | ✅ Partial | Different Git storage and setup flow |
| `bd create` | `tbd create` | ✅ Partial | Core fields; use tbd help for current options |
| `bd list` | `tbd list` | ✅ Partial | Core queries; filters differ |
| `bd show` | `tbd show` | ✅ Partial | Equivalent lookup; output differs |
| `bd update` | `tbd update` | ✅ Partial | Core fields plus tbd ownership fields; flags differ |
| `bd close` | `tbd close` | ✅ Full | With `--reason` |
| `bd ready` | `tbd ready` | ✅ Partial | tbd also evaluates delegate, hold, deferral, and blockers |
| `bd blocked` | `tbd blocked` | ✅ Full | Shows blocking issues |
| `bd label add` | `tbd label add` | ✅ Full | Identical |
| `bd label remove` | `tbd label remove` | ✅ Full | Identical |
| `bd label list` | `tbd label list` | ✅ Full | Lists all labels |
| `bd dep add` | `tbd dep add` | ✅ Full | Only “blocks” type |
| `bd dep tree` | `tbd dep tree` | 🔄 Future | Visualize dependencies |
| `bd sync` | `tbd sync` | ✅ Partial | Dedicated branch, docs, and optional provider fold |
| `bd stats` | `tbd stats` | ✅ Full | Same statistics |
| `bd doctor` | `tbd doctor` | ✅ Full | Different checks |
| `bd info` | `tbd status` | ⚡ Enhanced | Renamed; works pre-init, shows integrations |
| `bd status` | `tbd stats` | ⚡ Different | Beads aliases status=stats; tbd separates them |
| `bd config` | `tbd config` | ✅ Full | YAML not SQLite |
| `bd compact` | `tbd compact` | 🔄 Future | Deferred |
| `bd prime` | `tbd prime` | ⚡ Partial | No --mcp/--full flags; always outputs full context |
| `bd diagnose` | `tbd doctor` | ✅ Partial | Subset of diagnostics |
| Beads migration | `tbd setup --from-beads` | ✅ Partial | One working-tree JSONL source; see `tbd-lgtd` |
| `bd import` | `tbd import <file>` | ✅ Partial | Explicit Beads-compatible JSONL into initialized tbd |
| `bd export` | — | 🔄 Future | No current tbd export command |

**Legend:**

- ✅ Full: Complete compatibility

- ✅ Partial: Core functionality, some options differ

- 🔄 Future: Planned for later phase

- ❌ Not planned: Intentionally excluded

### 5.3 Field Mapping

| Beads Field | tbd Field | Notes |
| --- | --- | --- |
| `id` | `id` | New format: `is-xxxx` vs `bd-xxxx` |
| `title` | `title` | Identical |
| `description` | `description` | Identical |
| `type` | `kind` | Renamed for clarity (`type` = entity discriminator) |
| `status` | `status` | See status mapping below |
| `priority` | `priority` | Identical (0-4) |
| `assignee` | `assignee` | Identical |
| `labels` | `labels` | Identical |
| `dependencies` | `dependencies` | Only “blocks” type currently |
| `created_at` | `created_at` | Identical |
| `updated_at` | `updated_at` | Identical |
| `closed_at` | `closed_at` | Identical |
| `due` | `due_date` | Renamed |
| `defer` | `deferred_until` | Renamed |
| `parent` | `parent_id` | Renamed |
| *(implicit)* | `version` | New: conflict resolution |
| *(implicit)* | `type` | New: entity discriminator ("is") |

### 5.4 Status Mapping

| Beads Status | tbd Status | Migration Behavior |
| --- | --- | --- |
| `open` | `open` | Direct mapping |
| `in_progress` | `in_progress` | Direct mapping |
| `blocked` | `blocked` | Direct mapping |
| `deferred` | `deferred` | Direct mapping |
| `closed` | `closed` | Direct mapping |
| `done` | `closed` | Direct mapping |
| `tombstone` | `closed` | Direct mapping |

The current importer does not skip tombstones, add a tombstone label, or move them to
the attic. It converts them to ordinary closed issues.

### 5.5 Compatibility Notes

#### What Works Identically

- Issue creation and updates

- Label management

- Dependency tracking (`blocks` type)

- Priority and status workflows

- Filtering and queries

- `ready` command logic

#### Key Differences

**Storage format:**

- Beads: Single `issues.jsonl` file

- tbd: File-per-issue in `.tbd/data-sync/issues/`

**Database:**

- Beads: SQLite cache

- tbd: Direct scans of file-per-issue YAML and Markdown records; the index in §6.1 is a
  candidate optimization

**Daemon:**

- Beads: Required background daemon

- tbd: No daemon (optional background sync planned)

**Git integration:**

- Beads: Complex worktree setup

- tbd: Simple sync branch

**Conflict handling:**

- Beads: JSONL merge conflicts

- tbd: Field-level merge with attic

**ID format:**

- Beads: `bd-xxxx` (4-6 hex chars, random)

- tbd: Dual ID system
  - Internal: `is-{ulid}` (26 chars, time-sortable)
  - External: `{prefix}-{short}` (4-5 base36 chars, e.g., `bd-a7k2`)
  - Display prefix configurable via `display.id_prefix` config

### 5.6 Compatibility Contract

This section defines the stability guarantees for scripts and tooling that depend on tbd
CLI output.

**Stable (will not change without major version bump):**

- JSON output schema from `--json` flag (additive changes only)

- Exit codes: 0 = success, 1 = error, 2 = usage error, 3 = no matching change, 130 =
  SIGINT (§4.10)

- Change report schema from `tbd changes` and `tbd watch` (§4.14.3), under the same
  additive-only rule as other JSON output

- Command names and primary flags identified as current in this spec

- External ID format: `{prefix}-{short}` (for example, `proj-a7k2`); new short IDs begin
  as base36 and imports may preserve a wider legacy grammar

- Internal ID format: `is-{26 char ulid}` (e.g., `is-01hx5zzkbkactav9wevgemmvrz`)

**Not guaranteed stable:**

- Human-readable output formatting (column widths, colors, wording)

- Error message text

- Timing of sync operations

- Candidate internal cache formats, including the future index in §6.1

**Beads compatibility aliases:**

These behaviors support familiar Beads workflows without claiming flag-for-flag
compatibility:

- `--type <kind>` on issue commands maps to the issue `kind` field

- Display prefix (e.g., `proj-`) set via `display.id_prefix` during init or import

#### Migration Gotchas

1. **IDs are preserved when available**: Beads `tbd-100` normally keeps short ID `100`.
   - Internal ID is ULID-based: `is-01hx5zzkbk...`
   - Short ID is preserved: `100`
   - Set `display.id_prefix: tbd` to keep exact same display format
   - A collision can change the display ID; see the deterministic merge repair and the
     `tbd-0oz8` import blocker

2. **No daemon**: Background sync must be manual or cron-based

3. **No auto-flush**: Beads auto-syncs on write
   - tbd publishes issues on `tbd sync` (per-command auto-sync is not currently enabled)

4. **Tombstone issues**: Current import converts them to `closed`

* * *

## 6. Implementation Notes

### 6.1 Performance Optimization

#### Query Index

> **Note:** This optional caching layer is not currently implemented.
> The current implementation scans issue files directly on each query.

**Optional caching layer** (potential future feature):

```typescript
// JSON-serializable index structure
interface Index {
  // Main issue lookup (object, not Map)
  issues: { [id: string]: IssueSummary };

  // Secondary indexes (arrays, not Sets)
  by_status: { [status: string]: string[] };
  by_assignee: { [assignee: string]: string[] };
  by_label: { [label: string]: string[] };

  // Freshness tracking
  last_updated: string; // ISO8601 timestamp
  baseline_commit: string; // Git commit hash this index was built from
}
```

> **Note:** Index uses plain objects and arrays (JSON-serializable), not Map/Set.
> Arrays are kept sorted for deterministic serialization.

**Checksum strategy:**

The index freshness is determined by comparing `baseline_commit` to the current
`tbd-sync` branch HEAD:

```bash
# Check if index is fresh
CURRENT=$(git rev-parse tbd-sync)
if [ "$CURRENT" == "$INDEX_BASELINE_COMMIT" ]; then
  # Index is fresh, use it
else
  # Index is stale, rebuild or incrementally update
  git diff --name-only $INDEX_BASELINE_COMMIT..$CURRENT
fi
```

**Rebuild strategy:**

1. Check if index exists and baseline_commit matches current sync branch HEAD

2. If stale, incrementally update by processing only changed files (via git diff)

3. If no index or baseline missing, full rebuild from all issue files

4. Store index in a local file (gitignored, never synced)

**Performance targets:**

- Cold start (no index): <500ms for 5,000 issues

- Warm start (index hit): <50ms for common queries

- Index rebuild: <1s for 10,000 issues

- Incremental update: <100ms for typical sync (10-50 changed files)

If this candidate ships, common queries could use the index and diff-based updates.
Current `tbd list` and `tbd ready` scan issue files directly, while `tbd sync --status`
asks Git for worktree and ref state.

#### File I/O Optimization

- Batch reads when possible

- Atomic writes: temp file + rename

- Lazy loading candidate: parse issue YAML and Markdown records only when needed

- Streaming for large operations

### 6.2 Testing Strategy

**Unit tests:**

- Schema validation (Zod)

- Merge algorithm

- ID generation

- Timestamp handling

**Integration tests:**

- CLI command parsing

- File I/O

- Git operations

- Sync algorithm

**End-to-end tests:**

- Full workflows (create → update → sync → close)

- Multi-machine sync scenarios

- Conflict resolution

- Beads import

**Platform tests:**

- macOS, Linux, Windows

- Network filesystems (NFS, SMB)

- Cloud environments (simulated)

### 6.3 Migration Path

The supported Beads migration is the setup flow from §5.1:

```bash
# 1. Make the working-tree JSONL the intended source snapshot.
bd sync

# 2. Preview the migration and selected agent surfaces.
tbd --dry-run setup --from-beads --surfaces=all

# 3. Initialize, import .beads/issues.jsonl, move .beads to
#    .beads-disabled, and install the selected surfaces.
tbd setup --from-beads --surfaces=all

# 4. Verify before relying on the disabled source, then publish tbd data.
tbd stats
tbd import --validate --beads-dir=.beads-disabled --verbose
tbd sync
```

There is no separate `setup beads --disable` preview or confirmation command.
Setup renames the entire `.beads/` directory to `.beads-disabled/`; it does not move the
other paths listed by older drafts of this design.
Because `tbd-lgtd` allows that rename after an incomplete import, preserve an
independent backup until the runtime fix ships.

### 6.4 Installation and Agent Integration

tbd is distributed as an npm package (`get-tbd`), enabling simple installation across
all environments including cloud sandboxes.

#### 6.4.1 Installation Methods

| Method | Command | Best For |
| --- | --- | --- |
| **npm** (primary) | `npm install -g get-tbd` | Most users, cloud environments |
| **npx** (no install) | `npx get-tbd <command>` | One-off usage, testing |
| **From source** | `pnpm install && pnpm build` | Contributors |

**npm is the recommended approach** because:

- Works in all environments (local, CI, Claude Code Cloud)
- Cross-platform (macOS, Linux, Windows)
- Version management via package.json
- No compilation required

#### 6.4.2 Claude Code Integration

Claude Code hooks are always installed to the **project-local** `.claude/` directory,
adjacent to `.git/` and `.tbd/` at the git repository root.
There is no global/user-level installation—this avoids confusion and ensures hooks work
in any environment (local dev, Claude Code Cloud, etc.).

**A. JSON Settings Hooks** (installed to `.claude/settings.json` at project root)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "bash .claude/scripts/tbd-session.sh" }]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "bash .claude/scripts/tbd-session.sh --brief" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/tbd-closing-reminder.sh"
          }
        ]
      }
    ]
  }
}
```

- **SessionStart**: Ensures tbd is installed, then runs `tbd prime` for workflow context
- **PreCompact**: Runs `tbd prime --brief` before context compaction
- **PostToolUse**: Reminds about `tbd sync` after `git push`

All hook commands use project-relative paths (e.g.,
`bash .claude/scripts/tbd-session.sh`) so they work regardless of where tbd was
installed globally.

**B. Session Script** (installed to `.claude/scripts/tbd-session.sh`)

The session script handles tbd CLI installation (if missing) and runs `tbd prime`. It is
committed to the repo so cloud environments bootstrap automatically.
It contains no tbd release literal: it uses an installed CLI when that CLI can read the
repository’s `tbd_format`, otherwise it invokes the strictly validated exact
`tbd_fallback_version` stored once in `.tbd/config.yml`. Compatible package upgrades
therefore update the central pin without rewriting the script.

**Setup command:**

```bash
tbd setup --auto --prefix=myapp   # Fresh project: initialize + configure hooks
tbd setup --auto                  # Existing project: update hooks and skill files
tbd setup --auto --surfaces=claude # Install or refresh only Claude Code hooks
```

Setup requires a git repository.
Running `tbd setup` outside a git repo produces an error.
When run from a subdirectory, setup resolves to the git root so `.tbd/` and `.claude/`
are always placed adjacent to `.git/`.

#### 6.4.3 The `tbd prime` Command

The `tbd prime` command outputs workflow context for AI agents.
It’s designed to be called by hooks at session start and before context compaction to
ensure agents remember the tbd workflow.

```bash
tbd prime [options]

Options:
  --export        Output default content (ignores PRIME.md override)
```

**Behavior:**

- **Silent exit** (code 0, no stderr) if not in a tbd project
- **Custom override**: Users can place `.tbd/PRIME.md` to fully customize output

**Output** (~1-2k tokens): the session-close protocol, core bead-tracking rules, the
essential command reference (including the bulk multi-ID forms of `close`/`reopen`/
`update` and the never-shell-loop rule), and common workflows.
The content is composed from one source — the skill baseline
(`shortcuts/system/skill-baseline.md`, see `tbd-prime.md` for the rendered form) — so
this document does not duplicate it; regenerate rather than hand-edit.

**Custom Override:**

Users can place a `.tbd/PRIME.md` file to fully customize the output.
When this file exists, `tbd prime` outputs its contents instead of the default.
Use `--export` to see the default content for customization:

```bash
# Export default content to customize
tbd prime --export > .tbd/PRIME.md
# Edit .tbd/PRIME.md to add project-specific instructions
```

**Key design principle:** Global hooks + project-aware logic.
The hooks run on every session, but `tbd prime` only outputs context when `.tbd/`
exists. This creates a “just works” experience without breaking non-tbd projects.

#### 6.4.4 Other Editor Integrations

**Cursor IDE and AGENTS.md-compatible tools:**

Cursor (v1.6+) and other AGENTS.md-compatible tools read the `AGENTS.md` file
automatically. Run `tbd setup --auto --surfaces=agents-md` to create or update
`AGENTS.md` with tbd instructions.
Use `--surfaces=codex` for Codex hooks; these are separate selectable surfaces.

**Generic (any editor):**

For editors without specific integration, add to your project’s `AGENTS.md`:

```markdown
## Issue Tracking

This project uses tbd for issue tracking:

- Find work: `tbd ready`
- Create issues: `tbd create "title" --type=task`
- Claim work: `tbd start <id>`
- Complete: `tbd close <id>`
- Sync: `tbd sync`
```

#### 6.4.5 Cloud Environment Bootstrapping

For fresh cloud environments (Claude Code Cloud, GitHub Codespaces, etc.), commit the
bootstrap script to your repository:

```bash
# .claude/hooks/session-start.sh
#!/bin/bash
command -v tbd &>/dev/null || npm install -g get-tbd --quiet
[ -d ".tbd" ] && tbd prime
```

Make it executable:

```bash
chmod +x .claude/hooks/session-start.sh
git add .claude/hooks/session-start.sh
git commit -m "Add tbd bootstrap for cloud environments"
```

**Why npm over direct binary download?**

| Criterion | npm | Direct Download |
| --- | --- | --- |
| Lines of code | 2 | 25+ |
| Dependencies | npm (always present) | curl, tar |
| Version management | Automatic | Manual |
| Error handling | Built-in | Must implement |
| Cross-platform | Automatic | Must detect OS/arch |

Direct binary download is faster (~~3s vs ~~5-10s) but adds complexity.
Use npm unless you have specific requirements.

* * *

## 7. Appendices

### 7.1 Design Decisions

#### Decision 1: File-per-entity vs JSONL

**Choice**: File-per-entity

**Rationale**:

- Parallel creation has zero conflicts (vs JSONL merge conflicts)

- Git diffs are readable

- Atomic updates per issue

- Scales better (no need to read entire file for one issue)

**Tradeoffs**:

- More inodes (not a problem on modern filesystems)

- Slightly more disk space (negligible)

#### Decision 2: No daemon required

**Choice**: Optional daemon, not required

**Rationale**:

- Simpler architecture

- Fewer failure modes

- Works in restricted environments (CI, cloud sandboxes)

- Manual sync is predictable

**Tradeoffs**:

- No automatic background sync

- Users must run `tbd sync` manually or via cron

#### Decision 3: Sync branch instead of main

**Choice**: Dedicated `tbd-sync` branch

**Rationale**:

- No merge conflicts on feature branches

- Clean separation of concerns

- Easy to allow-list in sandboxed environments

- Issues shared across all code branches

**Tradeoffs**:

- Slightly more complex git setup

- Users must understand two branches

#### Decision 4: Dual ID system (ULID and short base36)

**Choice**: Internal IDs use ULID (`is-{ulid}`), external IDs use short base36
(`{prefix}-{short}`)

**Rationale**:

- **Time-ordered sorting**: ULIDs sort chronologically, useful for debugging and
  listings
- **Collision resistance**: A process-local monotonic factory plus 80 random bits makes
  duplicate internal IDs negligible without a distributed allocator
- **Cross-project merging**: Multiple projects can merge their issues without internal
  ID collisions (external IDs may need different prefixes)
- **Human-friendly**: Short base36 IDs (4-5 chars) are easy to type and remember
- **Short references**: External IDs are convenient for docs, commits, and external
  systems; deterministic collision repair can reassign a displaced short ID
- **Beads compatibility**: Configurable display prefix (`bd-`) for migration

**Tradeoffs**:

- Two ID formats to understand (internal vs external)
- Mapping file adds small complexity
- Longer internal IDs in file paths

**Mitigations**:

- Users only interact with short external IDs
- Mapping file syncs automatically
- ULID sorting benefits outweigh longer paths

#### Decision 5: Only “blocks” dependencies

**Choice**: Support only `blocks` dependency type

**Rationale**:

- Simpler implementation

- Matches Beads’ primary use case (`ready` command)

- Can add more types later without breaking changes

**Tradeoffs**:

- Can’t express “related” or “discovered-from” relationships yet

#### Decision 6: Markdown and YAML storage

**Choice**: Markdown + YAML front matter for issue storage

**Context**: [ticket](https://github.com/wedow/ticket), TrackDown, and other tools
successfully use Markdown + YAML frontmatter.
We adopt this approach.

**Prior art**:

- ticket (~1400 GitHub stars): YAML front matter + Markdown body

- TrackDown: Markdown files with structured headers

- Hugo/Jekyll: Mature tooling for YAML front matter parsing

- git-issue: Pure text format for issue tracking

**Rationale for Markdown + YAML**:

- **Human-readable**: Issues readable/editable without special tools

- **IDE integration**: Native Markdown support in all editors

- **Search integration**: ripgrep/grep work directly on issue files

- **AI-friendly**: Agents can search without parsing bloat

- **Long-form descriptions**: Rich formatting (headings, lists, code blocks)

- **Familiar format**: Developers already know Markdown + YAML

**Structured Data Handling**:

- YAML front matter contains all schema fields (structured data)

- Markdown body contains `description` and optional `## Notes` section

- Canonical serialization ensures deterministic hashing

- Schema validation via Zod after parsing

**Tradeoffs**:

- Parsing slightly more complex than JSON

- Requires YAML + Markdown parsers (vs JSON only)

- Multi-line fields need careful YAML escaping

**Mitigations**:

- Use gray-matter for front-matter delimiters and the `yaml` package for all YAML
  parsing and serialization, behind one wrapper that rejects non-YAML language markers
  before gray-matter can select its built-in JavaScript evaluator

- Canonical serialization rules ensure consistency

- Attic entries use pure YAML (no Markdown body needed)

#### Decision 7: Hidden worktree for sync branch

**Choice**: Use a hidden git worktree for sync branch access

**Context**: tbd stores issues on a sync branch (`tbd-sync`) that’s separate from the
user’s working branch.
We need a way to access and search sync branch content without affecting the user’s
checkout.

**Alternatives Considered**:

1. **Isolated index (`GIT_INDEX_FILE`)**: Use git plumbing with isolated index
   - Pro: Minimal disk usage, no extra checkout

   - Con: Files not accessible to ripgrep/grep for searching

2. **Sparse checkout**: Checkout only `.tbd/data-sync/` directory
   - Pro: Files accessible, minimal overhead

   - Con: Pollutes user’s working directory, shows in `git status`

3. **Hidden worktree**: Separate checkout at `$GIT_COMMON_DIR/tbd/data-sync-worktree/`
   - Pro: Files accessible for search, isolated from user’s work

   - Con: Additional disk space for second checkout

**Rationale for Hidden Worktree**:

- **Search integration**: ripgrep/grep work directly on issue files

- **User isolation**: Hidden in Git’s common directory, doesn’t pollute any checkout

- **Git-native**: Uses standard `git worktree` mechanics

- **Clean status**: Lives under `.git`, doesn’t appear in user’s `git status`

**Implementation Notes**:

- Worktree created at `$GIT_COMMON_DIR/tbd/data-sync-worktree/`

- Worktree directory added to `.tbd/.gitignore`

- `tbd init` creates the worktree; the first ordinary data command also materializes a
  missing or prunable worktree in an initialized clone

- Worktree kept in sync via `tbd sync` commands

- **No silent direct-path fallback**: Ordinary commands auto-materialize missing and
  prunable worktrees under the shared lock; corrupted worktrees fail with
  `tbd doctor --fix` guidance (see
  [Path Terminology and Resolution](#path-terminology-and-resolution))

**Tradeoffs**:

- Additional disk space (~2x issue storage)

- Worktree must be kept in sync

- Edge case: stale worktree if not synced recently

- Edge case: worktree can become “prunable” if directory deleted outside of git

**Mitigations**:

- `tbd search` reads the local worktree.
  Its current freshness message does not fetch; `tbd-iwup` tracks that defect

- Ordinary data commands heal missing and prunable worktrees at the point of use

- `tbd doctor --fix` attempts to back up and repair corrupted worktrees.
  The backup-before-delete failure in `tbd-dmkd` is a P0 release blocker

- The direct `.tbd/data-sync/` fallback remains limited to tests and diagnostics

- Space overhead is minimal (issues are small files)

- Clear error messages route destructive repair through `tbd doctor --fix`

### 7.2 Future Enhancements

#### Additional Dependency Types (High Priority)

Currently only `blocks` dependencies are supported.
Future versions should add:

**`related`**: Link related issues without blocking semantics

- Use case: “See also” references, grouping related work

- No effect on `ready` command

**`discovered-from`**: Track issue provenance

- Use case: When working on issue A, agent discovers issue B

- Pattern: `tbd create "Found bug" --deps discovered-from:<parent-id>`

- Common in Beads workflows for linking discovered work to parent issues

**Implementation**: Extend `Dependency.type` enum, update CLI `--deps` parsing.
No changes to sync algorithm needed.

#### Ripgrep-Based Search (Performance)

Currently search loads all issues into memory and filters with JavaScript string
matching. For large repositories (10K+ issues), this could be optimized:

**Approach:**

1. If `rg` (ripgrep) is available, use it for initial pattern matching
2. Fall back to `grep -r` if ripgrep unavailable
3. Emit warning on first fallback: “ripgrep not found, using grep (slower)”

**Benefits:**

- Faster initial pattern matching (ripgrep is highly optimized)
- Lower memory usage (don’t load all issues upfront)
- Context lines support (`-C` flag)
- External commands visible in `--verbose` mode for debugging

**Implementation:**

```bash
rg -i -C 2 --type md "pattern" "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/"
```

Post-process results to:

- Map file paths to issue IDs
- Apply field filters (title, description, notes)
- Apply status/type/label filters by reading matched files

#### Agent Registry

**Entities**: `agents/` collection on sync branch

**Use cases**:

- Track which agents are working on what

- Agent capabilities and metadata

- Heartbeats and presence (ephemeral)

#### Native Comments and Messaging

The selected candidate is the immutable `comments/` collection with `cm-` IDs described
in §2.10. Its record/storage and inventory/transition foundations are internal and
dormant in f08; the Git guards, recovery paths, format activation, and public commands
remain future work.

The initial product surface is shared, bead-attached discussion with optional reply
references. Arbitrary direct messages, addressed inboxes, read receipts, presence, and
private mailboxes are separate capabilities that require their own identity, delivery,
and retention contracts.

#### External Tracker Bridges

Linear is the current external-tracker implementation (§8.7). It runs during explicit
CLI sync, uses durable write-ahead intents for provider writes, and stores bounded
provider comments inside the linked bead’s provider namespace.
It has no webhook or background process.
GitHub issues are the next planned adapter; pull requests remain read-only associations.

Future native-comment projection is limited to explicitly linked beads.
It must keep mutable provider aliases, destination lineage, and delivery state outside
the immutable native record, apply provider rate limits, and cut over idempotently from
the current embedded representation.

#### Real-time Coordination

Poll-based coordination already exists: `tbd watch` (§4.14) wakes a process when
selected committed bead state changes on the remote, at remote-poll latency and with no
daemon. What it does not provide:

**Components**:

- Presence service (which agents are live right now)

- Atomic claim leases, so two agents cannot claim one bead

- Push delivery rather than polling

**Use cases**:

- Sub-second coordination

- Multiple agents on same codebase

- Distributed teams

#### Workflow Automation

**Entities**: `workflows/` collection

**Use cases**:

- Multi-step procedures

- State machines

- Triggers and actions

#### Time Tracking

**Fields**: `time_estimate`, `time_spent`

**Use cases**:

- Effort estimation

- Sprint planning

- Agent performance metrics

### 7.3 File Structure Reference

**Current f08 storage layout:**

This tree intentionally omits the candidate `comments/` and `attic/comment-conflicts/`
paths shown in §2.10. Current setup does not create or protect those paths.
Entries marked “when used” are absent from a fresh `tbd init` scaffold.

**Checkout on the main branch:**

```text
.tbd/
├── config.yml                   # Committed project config
├── .gitignore                   # Committed ignore rules
├── .gitattributes               # Committed by setup; protects workspace mappings
├── workspaces/                  # Committed outbox and named state, when used
├── state.yml                    # Gitignored local state, when used
├── docs/                        # Gitignored installed documentation
├── backups/                     # Gitignored legacy local backups, when used
├── data-sync-worktree/          # Gitignored legacy path; current clients do not create it
└── data-sync/                   # Gitignored reserved simple-mode path
```

**Git common directory, shared by every linked worktree:**

```text
$GIT_COMMON_DIR/tbd/
├── layout.yml                   # Local layout metadata
├── data-sync.epoch              # Writer epoch, after the first data operation
├── locks/
│   └── data-sync.lock/          # Transient mkdir lock while a writer is active
├── backups/                     # Repair and migration backups, when needed
└── data-sync-worktree/          # Active hidden checkout of tbd-sync
```

**Tracked on the `tbd-sync` branch:**

```text
.tbd/data-sync/
├── issues/
│   ├── .gitkeep                 # Fresh scaffold
│   └── is-01hx5zzkbkactav9wevgemmvrz.md
├── mappings/
│   ├── .gitkeep                 # Fresh scaffold
│   ├── .gitattributes           # ids.yml merge=union
│   └── ids.yml                  # Short ID → ULID mapping, when used
├── attic/                       # Conflict evidence, when needed
│   ├── is-01hx5zzkbkactav9wevgemmvrz_2025-01-07T10-30-00Z_description.yml
│   └── conflicts/
│       └── is-01hx5zzkbkactav9wevgemmvrz__2025-01-07T11-45-00Z.md
├── bridge/                      # External-tracker state, when configured
│   └── <provider>/
│       ├── links/<bead-id>.yml
│       ├── intents/<run-id>.yml
│       └── users/<provider-user-id>.yml
└── meta.yml                     # Fresh scaffold; data schema version
```

**File counts (example with 1,000 issues):**

| Location | Files | Size |
| --- | --- | --- |
| `.tbd/` | 4 | <1 KB |
| `.tbd/docs/` | ~30 | ~100 KB |
| `.tbd/data-sync/issues/` | 1,000 | ~2 MB |
| `.tbd/data-sync/attic/` | 10-50 | <100 KB |

* * *

## Appendix A: Beads to tbd Feature Mapping

This appendix provides a comprehensive mapping between Beads and tbd for migration
planning and compatibility reference.

### A.1 Executive Summary

tbd provides CLI-level compatibility with Beads for core issue tracking while
simplifying the architecture:

| Aspect | Beads | tbd |
| --- | --- | --- |
| Data locations | 4 (SQLite, local JSONL, sync branch, main) | 2 (files on sync branch, config on main) |
| Storage | SQLite + JSONL | Markdown + YAML (file-per-entity) |
| Daemon | Required (recommended) | Not required |
| Agent coordination | External daemon | Issue-only `tbd watch` wake-ups; atomic claims deferred |
| Comments | Embedded in issue | Linked-provider comments supported; native records internal and dormant |
| Conflict resolution | 3-way merge | Git-based detection + field-level LWW + attic |

**Core finding:** All essential Beads issue-tracking workflows have direct CLI
equivalents in tbd. Advanced features (atomic claims, workflow templates, real-time
messaging) are explicitly deferred.

### A.2 CLI Command Mapping

#### A.2.1 Issue Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd create "Title"` | `tbd create "Title"` | ✅ Full | Identical |
| `bd create "Title" --type type` | `tbd create "Title" --type type` | ✅ Full | Same flag |
| `bd create "Title" --priority N` | `tbd create "Title" --priority N` | ✅ Full | Priority 0-4 |
| `bd create "Title" --description "desc"` | `tbd create "Title" --description "desc"` | ✅ Full | Description |
| `bd create "Title" --file file.md` | `tbd create "Title" --file file.md` | ✅ Full | Body from file |
| `bd create "Title" --label label` | `tbd create "Title" --label label` | ✅ Full | Repeatable |
| `bd create "Title" --assignee X` | `tbd create "Title" --assignee X` | ✅ Full | Identical |
| `bd create "Title" --parent=<id>` | `tbd create "Title" --parent=<id>` | ✅ Full | Hierarchical |
| `bd create "Title" --due <date>` | `tbd create "Title" --due <date>` | ✅ Full | Due date |
| `bd create "Title" --defer <date>` | `tbd create "Title" --defer <date>` | ✅ Full | Defer until |
| `bd list` | `tbd list` | ✅ Full | Identical |
| `bd list --status X` | `tbd list --status X` | ✅ Full | Identical |
| `bd list --type X` | `tbd list --type X` | ✅ Full | Identical |
| `bd list --priority N` | `tbd list --priority N` | ✅ Full | Identical |
| `bd list --assignee X` | `tbd list --assignee X` | ✅ Full | Identical |
| `bd list --label X` | `tbd list --label X` | ✅ Full | Repeatable |
| `bd list --parent=<id>` | `tbd list --parent=<id>` | ✅ Full | List children |
| `bd list --deferred` | `tbd list --deferred` | ✅ Full | Deferred issues |
| `bd list --sort X` | `tbd list --sort X` | ✅ Full | priority/created/updated |
| `bd list --limit N` | `tbd list --limit N` | ✅ Full | Identical |
| `bd list --json` | `tbd list --json` | ✅ Full | JSON output |
| `bd show <id>` | `tbd show <id>` | ✅ Full | Identical |
| `bd update <id> --status X` | `tbd update <id> --status X` | ✅ Full | Identical |
| `bd update <id> --priority N` | `tbd update <id> --priority N` | ✅ Full | Identical |
| `bd update <id> --assignee X` | `tbd update <id> --assignee X` | ✅ Full | Identical |
| `bd update <id> --description X` | `tbd update <id> --description X` | ✅ Full | Identical |
| `bd update <id> --type X` | `tbd update <id> --type X` | ✅ Full | Identical |
| `bd update <id> --due <date>` | `tbd update <id> --due <date>` | ✅ Full | Identical |
| `bd update <id> --defer <date>` | `tbd update <id> --defer <date>` | ✅ Full | Identical |
| `bd update <id> --parent=<id>` | `tbd update <id> --parent=<id>` | ✅ Full | Identical |
| `bd close <id>` | `tbd close <id>` | ✅ Full | Identical |
| `bd close <id> --reason "X"` | `tbd close <id> --reason "X"` | ✅ Full | With reason |
| `bd reopen <id>` | `tbd reopen <id>` | ✅ Full | Identical |
| `bd ready` | `tbd ready` | ✅ Full | Identical algorithm |
| `bd blocked` | `tbd blocked` | ✅ Full | Shows blockers |

#### A.2.2 Label Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd label add <id> <label>` | `tbd label add <id> <label>` | ✅ Full | Identical |
| `bd label remove <id> <label>` | `tbd label remove <id> <label>` | ✅ Full | Identical |
| `bd label list` | `tbd label list` | ✅ Full | All labels in use |

Also available via update: `tbd update <id> --add-label X` and `--remove-label X`

#### A.2.3 Dependency Commands (Partial - blocks only)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd dep add <a> <b>` | `tbd dep add <id> <target>` | ✅ Full | Default: blocks |
| `bd dep add <a> <b> --type blocks` | `tbd dep add <id> <target> --type blocks` | ✅ Full | Identical |
| `bd dep add <a> <b> --type related` | *(not yet)* | ⏳ Future | Only blocks |
| `bd dep add <a> <b> --type discovered-from` | *(not yet)* | ⏳ Future | Only blocks |
| `bd dep remove <a> <b>` | `tbd dep remove <id> <target>` | ✅ Full | Identical |
| `bd dep tree <id>` | `tbd dep tree <id>` | 🔄 Future | Visualize deps |

**Note:** Currently supports only `blocks` dependency type.
This is sufficient for the `ready` command algorithm.
`related` and `discovered-from` are planned for the future.

#### A.2.4 Sync Commands

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd sync` | `tbd sync` | ✅ Partial | Commit local, fetch/merge, fold enabled trackers, then push; docs also sync |
| `bd sync --pull` | `tbd sync --pull` | ✅ Partial | Git issue pull only unless `--integrations` is explicit |
| `bd sync --push` | `tbd sync --push` | ✅ Partial | Git issue push only unless `--integrations` is explicit |
| *(no equivalent)* | `tbd sync --status` | ✅ New | Show pending changes |

#### A.2.5 Maintenance Commands (Full Parity)

| Beads Command | tbd Command | Status | Notes |
| --- | --- | --- | --- |
| `bd init` | `tbd init --prefix=<name>` | ✅ Partial | Dedicated hidden worktree and sync branch |
| `bd info` | `tbd status` | ⚡ Enhanced | Renamed; works pre-init, shows integrations |
| `bd status` | `tbd stats` | ⚡ Different | Beads aliases status=stats; tbd separates them |
| *(no equivalent)* | `tbd status` | ✅ New | Works pre-init, detects beads, shows integrations |
| `bd doctor` | `tbd doctor` | ✅ Full | Health checks |
| `bd doctor --fix` | `tbd doctor --fix` | ⚠️ Current defect | `tbd-dmkd` blocks backup-before-delete safety |
| `bd stats` | `tbd stats` | ✅ Full | Issue statistics |
| Beads migration | `tbd setup --from-beads` | ⚠️ Current defect | One-source setup flow; see `tbd-lgtd` |
| `bd import` | `tbd import <file>` | ✅ Partial | Explicit Beads-compatible JSONL import |
| `bd export` | *(not yet)* | ⏳ Future | Files are the format |
| `bd config` | `tbd config` | ✅ Full | YAML config |
| `bd compact` | *(not yet)* | ⏳ Future | Memory decay |

#### A.2.6 Global Options

| Beads Option | tbd Option | Status | Notes |
| --- | --- | --- | --- |
| `--json` | `--json` | ✅ Full | JSON output |
| `--help` | `--help` | ✅ Full | Help text |
| `--version` | `--version` | ✅ Full | Version info |
| `--db <path>` | *(not supported)* | ❌ Dropped | No global repository-path override |
| `--no-sync` | *(n/a)* | ❌ Dropped | Removed; issue writes always stage locally (run `tbd sync` to publish) |
| `--actor <name>` | *(not supported globally)* | ❌ Dropped | Claim commands use command-specific `--as` and `TBD_AGENT` |
| *(n/a)* | `--dry-run` | ✅ tbd | Preview changes |
| *(n/a)* | `--verbose` | ✅ tbd | Debug output |
| *(n/a)* | `--quiet` | ✅ tbd | Minimal output |
| *(n/a)* | `--color <when>` | ✅ tbd | Color control |
| *(n/a)* | `--debug` | ✅ tbd | Show internal IDs beside public IDs |

### A.3 Data Model Mapping

#### A.3.1 Issue Schema

| Beads Field | tbd Field | Status | Notes |
| --- | --- | --- | --- |
| `id` | `id` | ✅ | `bd-xxxx` → display prefix configurable |
| `title` | `title` | ✅ | Identical |
| `description` | `description` | ✅ | Identical |
| `notes` | `notes` | ✅ | Working notes field |
| `issue_type` | `kind` | ✅ | Renamed for clarity |
| `status` | `status` | ✅ | Full parity (see below) |
| `priority` | `priority` | ✅ | 0-4, identical |
| `assignee` | `assignee` | ✅ | Identical |
| `labels` | `labels` | ✅ | Identical |
| `dependencies` | `dependencies` | ✅ | Only `blocks` currently |
| `parent_id` | `parent_id` | ✅ | Identical |
| *(n/a)* | `spec_path` | ✅ | New: links to spec docs |
| `created_at` | `created_at` | ✅ | Identical |
| `updated_at` | `updated_at` | ✅ | Identical |
| `created_by` | `created_by` | ✅ | Identical |
| `closed_at` | `closed_at` | ✅ | Identical |
| `close_reason` | `close_reason` | ✅ | Identical |
| `due` | `due_date` | ✅ | Renamed |
| `defer` | `deferred_until` | ✅ | Renamed |
| *(implicit)* | `version` | ✅ | New: conflict resolution |
| *(implicit)* | `type` | ✅ | New: entity discriminator ("is") |
| `comments` | Candidate `cm-` records | ⏳ | Internal foundation only; no public command or activated format |

#### A.3.2 Status Values

| Beads Status | tbd Status | Migration |
| --- | --- | --- |
| `open` | `open` | ✅ Direct |
| `in_progress` | `in_progress` | ✅ Direct |
| `blocked` | `blocked` | ✅ Direct |
| `deferred` | `deferred` | ✅ Direct |
| `closed` | `closed` | ✅ Direct |
| `done` | `closed` | ✅ Direct |
| `tombstone` | `closed` | ✅ Direct |
| `pinned` | `open` | ⚠️ Unknown status fallback; no automatic label |
| `hooked` | `open` | ⚠️ Unknown status fallback; no automatic label |

#### A.3.3 Issue Types/Kinds

| Beads Type | tbd Kind | Status |
| --- | --- | --- |
| `bug` | `bug` | ✅ |
| `feature` | `feature` | ✅ |
| `task` | `task` | ✅ |
| `epic` | `epic` | ✅ |
| `chore` | `chore` | ✅ |
| `message` | *(no issue kind)* | ⏳ Direct messaging deferred; bead comments use candidate `cm-` records |
| `agent` | *(future)* | ⏳ Separate entity |

#### A.3.4 Dependency Types

> **See also:** [§2.8 Relationship Types](#28-relationship-types) for detailed
> documentation of tbd’s relationship model, including rationale for differences from
> Beads.

| Beads Type | tbd Type | Status | Notes |
| --- | --- | --- | --- |
| `blocks` | `blocks` | ✅ Supported | Identical semantics |
| `related` | `related` | ⏳ Future | Non-blocking soft links |
| `discovered-from` | `discovered-from` | ⏳ Future | Provenance tracking |
| `parent-child` | `parent_id` field | ✅ Different model | See below |

**Parent-child model difference:**

- **Beads**: `parent-child` enables **transitive blocking**—if a parent is blocked (by a
  `blocks` dependency), children inherit that blockage.
  Children are NOT blocked just because their parent is open.
  (See `attic/beads/internal/storage/sqlite/blocked_cache.go` for implementation
  details.)
- **tbd**: `parent_id` is a separate field for **organizational hierarchy only** (no
  blocking effects, no transitive propagation)

This is intentional—tbd’s simpler model avoids hidden transitive effects while still
allowing organizational hierarchy.
See [§2.8.7](#287-future-transitive-blocking-option) for discussion of adding opt-in
transitive blocking in the future.

### A.4 Architecture Comparison

#### A.4.1 Storage

| Aspect | Beads | tbd |
| --- | --- | --- |
| Primary store | SQLite | Markdown + YAML files |
| Sync format | JSONL | Markdown + YAML (same as primary) |
| File structure | Single `issues.jsonl` | File per entity |
| Location | `.beads/` on main | `.tbd/data-sync/` on sync branch |
| Config | SQLite + various | `.tbd/config.yml` on main |

#### A.4.2 Sync

| Aspect | Beads | tbd |
| --- | --- | --- |
| Mechanism | SQLite ↔ JSONL ↔ git | Files ↔ git |
| Branch | Main or sync branch | Sync branch only |
| Conflict detection | 3-way (base, local, remote) | Git ancestry plus push rejection |
| Conflict resolution | LWW + union | LWW + union (same strategies) |
| Conflict preservation | Partial | Full (attic) |
| Daemon required | Yes (recommended) | No |

### A.5 LLM Agent Workflow Comparison

#### A.5.1 Basic Agent Loop (Full Parity)

**Beads:**

```bash
bd ready --json              # Find work
bd update <id> --status=in_progress  # Claim (advisory)
# ... work ...
bd close <id> --reason "Done"  # Complete
bd sync                       # Sync
```

**tbd:**

```bash
tbd ready --json            # Find work
tbd start <id>              # Guarded local advisory claim
# ... work ...
tbd close <id> --reason "Done"  # Complete
tbd sync                    # Sync
```

**Assessment:** The loop shape is compatible, but tbd’s claim verb additionally records
`delegate` and rejects a different visible in-progress delegate under the local data
lock. It remains advisory across independent stale clones and becomes visible there only
after `tbd sync`.

#### A.5.2 Creating Linked Work (Partial Parity)

**Beads:**

```bash
bd create "Found bug" --type=bug --priority=P1 --deps discovered-from:<id> --json
```

**tbd:**

```bash
# Only blocks dependency supported currently
tbd create "Found bug" --type=bug --priority=P1 --parent=<id> --json
# Or wait for future version for discovered-from
```

**Assessment:** ⚠️ `discovered-from` dependency not yet available.
Use `--parent` or wait for a future version.

#### A.5.3 Migration Workflow

```bash
# In the Beads repo, reconcile the working-tree JSONL first.
bd sync
tbd setup --from-beads --surfaces=all
tbd import --validate --beads-dir=.beads-disabled --verbose
tbd sync
```

For an explicit exported snapshot, initialize with `tbd init --prefix=<name>`, import
the file with `tbd import <file>`, and set a different prefix with
`tbd config set display.id_prefix bd` when needed.

### A.6 Parity Summary

| Category | Parity | Notes |
| --- | --- | --- |
| Issue CRUD | ✅ Full | All core operations |
| Labels | ✅ Full | Add, remove, list |
| Dependencies | ⚠️ Partial | Only `blocks` type |
| Sync | ✅ Full | Pull, push, status |
| Maintenance | ✅ Full | Init, doctor, stats, config |
| Import | ⚠️ Partial | Working-tree setup migration or explicit JSONL; no multi-source scan; see `tbd-lgtd` and `tbd-0oz8` |

### A.7 Deferred Features

| Category | Priority | Notes |
| --- | --- | --- |
| Agent registry | High | Built-in coordination |
| Native comments | High | Record/storage and inventory/transition internals exist; Git preservation, activation, and commands remain deferred |
| `related` deps | Medium | Additional dep type |
| `discovered-from` deps | Medium | Additional dep type |
| Daemon | Medium | Optional background sync |
| GitHub bridge | Low | External integration |
| Templates | Low | Reusable workflows |

### A.8 Migration Compatibility

- **CLI:** 95%+ compatible for core workflows

- **Data:** Import from the working-tree Beads JSONL during setup, or from one explicit
  JSONL file; no current main-plus-sync multi-source import

- **Display:** Configurable ID prefix (`bd-xxxx` vs `cd-xxxx`)

- **Behavior:** Advisory claims, manual sync (no daemon)

**Overall assessment:** tbd provides sufficient feature parity for LLM agents to migrate
from Beads for basic issue tracking.
The simpler architecture (no SQLite, no daemon, file-per-entity) addresses the key pain
points from real-world Beads use.

* * *

## Appendix B: Beads Commands Not Included

This appendix provides a comprehensive list of Beads commands and features that are
explicitly **not** included in tbd.

### B.1 Daemon Commands

These commands are not applicable since tbd has no daemon:

| Beads Command | Why Not Included |
| --- | --- |
| `bd daemon start` | No daemon architecture |
| `bd daemon stop` | No daemon architecture |
| `bd daemon status` | No daemon architecture |
| `bd daemons list` | No daemon architecture |
| `bd daemons health` | No daemon architecture |
| `bd daemons killall` | No daemon architecture |
| `bd daemons logs` | No daemon architecture |
| `bd daemons restart` | No daemon architecture |

### B.2 Molecule/Workflow Commands

Workflow orchestration features are deferred to future:

| Beads Command | Why Not Included |
| --- | --- |
| `bd mol pour` | Template instantiation - future |
| `bd mol wisp` | Ephemeral work tracking - future |
| `bd mol bond` | Workflow composition - future |
| `bd mol squash` | Compress to digest - future |
| `bd mol burn` | Discard wisp - future |
| `bd mol wisp list` | Wisp management - future |
| `bd mol wisp gc` | Garbage collection - future |
| `bd mol distill` | Extract template - future |
| `bd mol show` | Template inspection - future |
| `bd formula list` | Template listing - future |

### B.3 Agent Coordination Commands

Real-time agent coordination is deferred:

| Beads Command | Why Not Included |
| --- | --- |
| `bd agent register` | Agent registry - future |
| `bd agent heartbeat` | Presence tracking - future |
| `bd agent claim` | Atomic claims - future |

### B.4 Advanced Data Operations

| Beads Command | Why Not Included |
| --- | --- |
| `bd compact` | Memory decay - future |
| `bd compact --auto` | AI-powered compaction - future |
| `bd admin cleanup` | Bulk deletion - future |
| `bd duplicates` | Duplicate detection - not planned |
| `bd merge` | Merge duplicates - not planned |
| `bd rename-prefix` | ID prefix rename - low priority |

### B.5 Comment Commands

The selected candidate uses immutable `cm-` records in a separate `comments/` collection
(§2.10). Its internal foundation does not expose a current user command or activate a
repository format.

| Beads Command | Why Not Included |
| --- | --- |
| `bd comment add` | Native writer and format activation remain future |
| `bd comment list` | Bounded native reader remains future |
| `bd comments show` | Bounded native reader remains future |

### B.6 Editor Integration Commands

| Beads Command | tbd Equivalent | Status |
| --- | --- | --- |
| `bd setup claude` | `tbd setup --auto --surfaces=claude` | ✅ Implemented |
| `bd setup cursor` | `tbd setup --auto --surfaces=agents-md` | ✅ Via AGENTS.md |
| `bd setup aider` | *(not implemented)* | Not planned |
| `bd setup factory` | `tbd setup --auto --surfaces=codex` | ✅ Codex hooks |
| `bd edit` | *(not implemented)* | Not planned (use `tbd show` + editor) |

### B.7 Additional Dependency Types

> **See also:** [§2.8 Relationship Types](#28-relationship-types) for tbd’s complete
> relationship model.

Currently only `blocks` is supported.
Based on real-world Beads usage data:

| Beads Type | Usage | tbd Status | Rationale |
| --- | --- | --- | --- |
| `blocks` | 47% | ✅ Supported | Core workflow dependency |
| `parent-child` | 42% | ✅ Via `parent_id` | Different model (non-blocking) |
| `discovered-from` | 11% | 🔜 Planned | Useful for provenance tracking |
| `related` | <1% | ⏳ Future | Rarely used in practice |
| `waits-for` | — | ⏳ Future | Fanout gates (advanced) |
| `conditional-blocks` | — | ⏳ Future | Error handling (advanced) |

**Note:** In Beads, `parent-child` enables transitive blocking (if parent is blocked,
children inherit that blockage), while tbd’s `parent_id` is purely organizational with
no blocking effects.
See [§2.8.5](#285-comparison-with-beads) for details.

### B.8 State Label Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd state` | Label-as-cache pattern - not planned |
| `bd set-state` | Label-as-cache pattern - not planned |

### B.9 Other Commands

| Beads Command | Why Not Included |
| --- | --- |
| `bd audit` | Audit trail command - use git log |
| `bd activity` | Activity feed - not planned |
| `bd context` | Context management - not planned |
| `bd migrate` | SQLite migration - not applicable |
| `bd export` | Files are the format - future (JSONL export) |
| `bd cook` | Internal command - not applicable |

### B.10 Global Flags Not Supported

| Beads Flag | Why Not Included |
| --- | --- |
| `--no-daemon` | No daemon to disable |
| `--no-auto-flush` | No auto-flush mechanism |
| `--no-auto-import` | Different sync model |
| `--sandbox` | tbd is always “sandbox safe” |
| `--allow-stale` | Different staleness model |

### B.11 Issue Types/Statuses Not Supported

| Beads Value | Why Not Included |
| --- | --- |
| `issue_type: message` | Direct messaging is future; bead comments use a separate candidate record |
| `issue_type: agent` | Agent registry is future |
| `issue_type: role` | Advanced orchestration |
| `issue_type: convoy` | Advanced orchestration |
| `issue_type: molecule` | Workflow templates |
| `issue_type: gate` | Async gates |
| `issue_type: merge-request` | External integration |
| `status: pinned` | Unknown import status falls back to `open`; no automatic label |
| `status: hooked` | Unknown import status falls back to `open`; no automatic label |

* * *

## 8. Cross-Cutting Decisions and Open Questions

This section records cross-cutting decisions, current behavior, and remaining design
questions. Each subsection labels what has shipped and what remains open.

### 8.1 Actor System Design

**Status:** Advisory claim identity is implemented; durable actor history and a
cross-replica claim protocol remain open.

**Implemented:**

- The schema separates `assignee` (accountability) from `delegate` (the current actor)
  and records the first `started_at` timestamp.
- `tbd start <ids...> [--as <name>]` resolves an agent identity, takes the repository
  data lock, refuses to steal a different delegate’s visible in-progress claim, sets
  `status: in_progress`, records `delegate`, records `started_at` once, and clears a
  stale hold. Repeating the same actor’s claim is a reported no-op.
- `tbd whoami` explains the resolved identity.
  `tbd whoami --ensure-id` mints one machine-local `agid-<ulid>` for the working
  directory; setup hooks call it on session start when available.
- Friendly-name resolution is explicit `--as`, then `TBD_AGENT`, then machine-local
  session state, then a non-person-identifying `<harness>@<host>` fallback.
  Harness and model detection are best effort.
- `tbd ready` tests `delegate`, not `assignee`, so recording a responsible human does
  not hide every bead from agents seeking work.
  Linear can project `delegate` only through an explicit agent mapping.

**Current limits:**

- The claim guard is atomic only within one repository’s current local snapshot.
  Two stale clones can both claim before either sees the other; ordinary sync merge
  rules choose a visible result and archive a loser, but do not provide distributed
  mutual exclusion.
- Issue records carry the friendly `delegate` value, not the machine-local agent ULID.
  There is no shared agent registry, lease, heartbeat, or automatic stale-claim expiry.
- `created_by` remains optional and is not populated automatically.
  Git retains file history, but tbd does not yet record the actor for every mutation or
  attribute sync commits to that actor.

**Open decisions:**

1. Whether high-contention work needs a remote compare-and-set claim, a bounded lease,
   or remains advisory with revalidation after every pull.
2. Whether claims should persist stable agent IDs beside display names, and how a
   portable registry handles renames and privacy.
3. Whether `created_by`, mutation authorship, and sync-commit authorship should share an
   identity record or remain distinct provenance layers.
4. Which explicit release and stale-claim recovery operations portable workers need.

### 8.2 Git Operations

**V2-004: Remote vs local branch reference ambiguity—resolved**

Mutating sync fetches the configured branch with an explicit destination refspec:

```bash
git fetch <remote> \
  refs/heads/<sync-branch>:refs/remotes/<remote>/<sync-branch>
```

Ahead/behind checks and merges then read `refs/remotes/<remote>/<sync-branch>`. The
local `refs/heads/<sync-branch>` advances only through the hidden worktree’s committed
merge; sync never assumes that a destination-less fetch updated the tracking ref.

Read-only observation deliberately uses a separate rule.
`tbd watch` fetches into a private `refs/tbd/watch/...` ref and reads that, leaving both
the local branch and its configured remote-tracking ref untouched (§3.7).

#### 8.2.1 Timestamp and Ordering

**V2-012: Clock skew assumptions**

LWW merge relies on `updated_at` timestamps.
Clock skew between machines can cause counterintuitive winners.
The attic preserves losers, but UX may suffer if the “wrong” version consistently wins.

**Options:**

1. Add a note acknowledging the limitation, rely on attic for recovery

2. Implement Hybrid Logical Clocks (HLC) in the future

3. Add optional “prefer remote” or “prefer local” config override

### 8.3 Mapping File Structure

**V2-016: Single mapping file as potential conflict hotspot**

**RESOLVED**: The unified `.tbd/data-sync/mappings/ids.yml` file handles all short ID
mappings (both imported and newly created).
Git union merge preserves both sides, but independent writers can allocate the same
short ID to different ULIDs and leave duplicate YAML keys.
On load, the lexicographically smallest ULID keeps the contested short ID and displaced
ULIDs receive deterministic derived replacements.
The corrected mapping is persisted on the next save.

Imports are idempotent only after a prior imported issue can be matched by its persisted
`extensions.beads.original_id`. Independent first imports generate different ULIDs and
can collide on their preserved short IDs.
Explicit import also has the destructive occupied-ID defect tracked by `tbd-0oz8`
(§5.1.3).

**Additional protection** (added in response to
[#99](https://github.com/jlevy/tbd/issues/99)): `.tbd/.gitattributes` configures
`merge=union` for mapping files, preventing Git from deleting nonconflicting rows during
merge while deliberately leaving same-key duplicates for schema-aware repair.
The sync code also includes `reconcileMappings()` which detects missing mappings after
merge and recovers original short IDs from git history before falling back to new random
IDs. The `doctor --fix` command provides a manual recovery path.
Together these provide three layers of defense: prevention (`.gitattributes`), detection
and recovery (reconcileMappings), and manual repair (doctor).

### 8.4 ID Length

**RESOLVED**: Adopted ULID-based internal IDs.

Internal IDs now use full 26-character ULIDs (128 bits: 48-bit timestamp and 80-bit
randomness). This provides:

- Strong cross-writer collision resistance without a central allocator
- Time-ordered sorting, with process-local monotonic generation in one millisecond
- Human interaction through short external IDs; new IDs begin as four-character base36
  and may lengthen, while imports can preserve a wider legacy grammar

The original concern about 6-hex-char limitations is moot with the dual ID system.

### 8.5 Future Extension Points

**Idea 7: Reserve directory structure for future bridges**

Should we reserve `.tbd/outbox/` and `.tbd/inbox/` directories for future bridge runtime
use?

**Options:**

1. Reserve now (empty dirs, documented for future use)

2. Add when needed (avoid premature structure)

> **Note:** The cache/ directory has been removed.
> Any future local state should use `.tbd/` directly with appropriate gitignore entries.

### 8.6 Issue Storage Location

**Hybrid sync branch vs main branch storage**

The current design stores all issues on the `tbd-sync` branch, keeping main branch
clean. However, there may be use cases where some issues should live on the main branch
(e.g., for visibility in PRs, code review context) while others remain on the sync
branch.

**Possible configurations:**

1. **All sync branch** (current design): All issues on `tbd-sync`, main branch stays
   clean. Simplest model, no reconciliation needed.

2. **All main branch**: Issues stored in `.tbd` and/or other folders on main or
   development branches, tracked with code.
   Simpler git model but adds more noise to commit history and creates merge
   complexities.

3. **Status-based split**: Active issues (open, in_progress) on main or development
   branches for visibility; closed/archived issues moved to sync branch automatically.
   tbd enforces the invariant.
   Challenge: What happens when working on different feature branches?
   Need to think through sync behavior.

4. **Gitignored working copies**: Sync branch remains authoritative and complete.
   Allow gitignored copies in a working directory (e.g., `.tbd/local/`) for convenient
   reading and editing.
   A `tbd save` command would push edits from the gitignored copy to the sync branch.
   This avoids reconciliation since sync branch is always the source of truth.

**Considerations:**

- Reconciliation complexity: Having issues in multiple locations creates sync challenges
  (the pain point that motivated moving away from Beads’ 4-location model)

- Branch-specific issues: How do issues get edited and merged on main and feature
  branches? Do they diverge?
  Get merged?

- Visibility vs cleanliness tradeoff: Main branch storage provides GitHub visibility but
  adds noise to diffs and history

**Recommendation:** Defer for now.
The gitignored working copy approach (Option 4) seems promising as it preserves the
single-source-of-truth model while adding convenience.

### 8.7 External Issue Tracker Linking

External trackers use one provider-generic command group and adapter interface.
Linear is the first implementation; GitHub issues are the next.
A repository opts in through `integrations` config.
With no enabled provider, the registry, doctor check, and ordinary `tbd sync` path
remain inert and make no provider request.

Each bead has at most one issue link per provider under the existing opaque namespace:

```yaml
extensions:
  linear:
    id: 7202337e-d1ee-4192-bb6c-c6ae42b97469 # stable provider identity
    linked_at: 2026-08-10T19:34:32.065Z
```

The corresponding bridge record owns mutable provider presentation data.
Its identity and display subset is:

```yaml
# .tbd/data-sync/bridge/linear/links/<bead-id>.yml
type: lk
bead_id: is-01hx5zzkbkactav9wevgemmvrz
external_id: 7202337e-d1ee-4192-bb6c-c6ae42b97469
external_key: TBD-3
external_url: https://linear.app/example/issue/TBD-3/example
# base, remote_updated_at, synced_at, and state follow the bridge schema
```

The bead side needed no schema change or format bump: `extensions` was already an opaque
field, so compatible writers round-trip a link untouched.
The **config** side caused the historical f07 boundary.
`integrations` added a top-level config key, while every tbd released before 0.6.0
parsed config in strip mode and silently dropped that block the first time it rewrote
`config.yml`—observed three times during the pilot.
Those clients could not be fixed retroactively, so f07 made them fail closed with an
upgrade message. From f07 onward, `ConfigSchema` and the `integrations` block preserve
unknown keys. The current repository format is f08, whose separate issue-record
preservation boundary is described in §2.7.3 and `docs/tbd-format-versioning.md`.
`tbd doctor` reports a block that is committed but missing locally, which is the exact
signature of a pre-f07 client having stripped it.
The persisted payload is an allow-list; credentials, raw API responses, emails, and
workspace metadata never enter a bead.
The bead link persists only stable provider `id` and `linked_at` fields.
Human keys and URLs can change when a Linear team is renamed or an issue moves, so
`external_key` and `external_url` live in the per-link bridge record and refresh on
sync. Rewriting a bead link removes legacy bead-level `key` and `url` fields.
Different extension namespaces merge independently.
A namespace deletion is an edit, so unlink is not silently resurrected by a concurrent
merge. Within a provider namespace, link writes replace the owned stable link fields,
remove the two legacy display fields, and preserve already-durable siblings such as
comments or future additive provider state.
The writer never spreads new fields from a link input, so sibling preservation does not
weaken the credential/raw-payload boundary.
Embedded provider comments union by comment ID or `local_id` only within one link
lineage: both namespaces must name the same nonempty provider issue ID, or both legacy
namespaces must omit `id`. Different IDs, and known IDs paired with missing, empty, or
malformed IDs, never exchange comments.
Merge keeps the selected namespace and records the complete loser in the attic,
including during approximate-base workspace and outbox recovery, before the source can
be cleared.

`TrackerAdapter` maps every provider into canonical tbd fields.
Each canonicalized issue may carry safe mapping warnings.
The sync engine deduplicates them by provider id and message and exposes them in human
and JSON reports; for example, an unknown Linear workflow-state type maps conservatively
to `open` while remaining visible instead of aborting or silently fabricating a status.
`integration sync --push` is the one-way projection.
`sync` uses a per-link base record on the sync branch for true field-wise three-way
reconciliation. Write-ahead intents are committed before provider writes and replayed
idempotently after a crash.
That guarantee applies to replay of the same committed journal and client UUID; it is
not a cross-replica logical-comment deduplication claim.
Description projection has one authoritative writer delimiter pair in
`core/managed-block.ts`: `⟦tbd⟧` and `⟦/tbd⟧`. These visible plain-text delimiters have
no Markdown or HTML semantics.
Readers also accept the former HTML-comment pair; the next outbound splice migrates it
without changing human prose around the managed region or registering a remote
description edit. Full sync renders the block from the reconciled canonical values, so a
pulled or conflict-winning field and its provider-visible summary cannot diverge for one
cycle. A bead-prose push writes the prose first and appends the managed region in a
separate splice, so a region placed in the middle of a provider description moves to the
end; delimiter-only refreshes preserve its position.
Mixed, incomplete, reversed, or duplicate markers fail closed and leave the provider
description untouched.
Every intent operation carries its owning bead id.
Replay performs provider I/O only while that bead still names the operation’s exact
provider id; a user comment must also retain the exact unpushed local entry.
A create’s client UUID is its future provider id, so sync commits it as a provisional
bead link with the journal before provider I/O. A pre-commit crash made no provider
write; a post-commit crash has the durable claim needed for safe replay.
The matching durable create intent makes liveness distinguish two cases: an item that
already exists is fetched and reconciled normally even if follow-up journal work
remains; when the first bridge record does not exist yet, the journaled creation patch
is the three-way base, so a provider edit during that failure window still pulls or
conflicts correctly.
A confirmed absence is pending rather than orphaned—even during pull-only runs that
intentionally defer replay.
Unlink or relink makes an old journal successful cancellation, not work that may touch
the former provider item.
Independent embedded comments union by `local_id` when present, otherwise by provider
`id`, and provider comment connections paginate completely.
Two current boundaries remain:

- Separate stale replicas can plan delivery of one pending local comment with different
  client UUIDs and create duplicate provider comments.
  `tbd-6vg5` tracks stable, destination-scoped delivery identity across replicas and
  uncertain responses.
- A pushed `{local_id, id}` entry and an independently pulled `{id}` entry do not yet
  canonicalize as aliases.
  When entries with one chosen identity carry divergent content, union chooses one
  observation without preserving or reporting the other.
  `tbd-58nm` tracks alias canonicalization and same-ID divergence preservation.

The current merge-retention guarantee therefore covers disjoint comment identities, and
replay of one journal identity is idempotent.
It does not yet cover those two cross-replica cases.
For entries with a provider `id`, a body over 10,000 JavaScript UTF-16 code units
becomes its first 10,000 units plus a truncation marker.
Only the newest 50 provider-ID entries retain a body, possibly truncated; older entries
retain their stored identity and metadata fields, including `local_id` when present,
with `body: ''`. Pending `local_id`-only entries remain full and outside both limits
until a provider ID lands.

These are current embedded provider comments, not native bead comments.
They exist only inside an explicitly linked provider namespace, and
`tbd integration comment` queues this representation for that destination.
The repository policy controls direction with `two_way`, `inbound`, `outbound`, or
`off`; `two_way` is the default.
The internal native-comment modules in §2.10 do not read, write, project, or replace
this state, and no current native/provider synchronization path exists.

Phase 4 makes complete native prose the provider-independent authority.
Mutable provider aliases, destination lineage, missing-body stubs, and delivery intents
remain bridge state.
Activation requires an explicit, idempotent inventory and cutover of existing bodies,
pending writes, aliases, and stubs; unavailable text must be fetched deliberately before
native publication. Writes use stable destination-scoped delivery keys, relinking starts
a new lineage, and historical backfill requires preview and explicit selection.
Provider retention limits may compact bridge state but must never truncate a native
record.

When both sides change a merge-owned field differently, the configured winner is kept,
the loser is archived before either side is overwritten, and the archive path plus a
client-UUID conflict comment are journaled together.
Replay of that journal reuses both, so it does not duplicate the resolution and never
advertises a missing archive.

Bare `integration sync` reconciles every linked pair.
Outbound selectors are accepted only with `--push`; using `--bead`, `--type`,
`--status`, `--label`, `--spec`, or `--limit` without it fails as a usage error rather
than silently widening a staged run.
`--pull --external <ref...>` is the explicit inbound selector and bypasses the inbound
policy. `--pull` performs no provider writes, including intent replay; remote attachment
claims and conflict notices are journaled locally for the next full sync.
In every direction, inbound creation persists the bead, bridge record, and attachment
intent before provider I/O; successful full sync removes the intent only after the
idempotent claim upsert lands.
Provider-created hierarchy is imported parent-first.
A child is accepted only when its parent is already linked or belongs to the same import
batch; otherwise it fails closed instead of flattening.
`linear.policy.outbound.max_nesting` limits only creation of new outbound projection;
inbound and already-linked items retain their true parent.

Linear `target.project` configuration scopes both outbound creation and automatic
inbound discovery. Explicit `--pull --external` is identity-directed and intentionally
bypasses that scan scope.
Outbound assignee writes accept an explicit `identity.user_map` override, an existing
stable actor binding, or one unique case-insensitive exact match for the local handle
against an active directory member’s email, login, or display name.
The explicit map wins; a new directory match persists a binding by provider user ID, and
an existing binding can continue to resolve a deactivated member.
Directory failure, no match, or an ambiguous match skips that outbound field with a
visible reason. Inbound assignee mapping remains `identity.user_map`-only: the remote
provider ID or email must reverse-map to a canonical local alias.
Safely mapped aliases seed inbound-created beads, while an unknown provider identity
freezes that field with a safe warning until it is mapped.
The bridge retains its prior canonical base during that freeze, so concurrent local
edits remain divergent and recoverable.
Provider emails are runtime lookup inputs and are not persisted.
Provider display names do cross the persistence boundary in the allowlisted
`display_name` of actor-binding records and the `author` field of embedded provider
comments. The bead assignee remains the configured canonical local alias rather than an
email address.

One external item must never have multiple bead writers.
`link` and inbound creation prevent creating that state with both local reverse indexes
and a provider attachment probe.
An existing `tbd://bead/…` claim refuses the operation unless `--force` is explicit;
this prevents sequential mistakes but is not an atomic cross-repository lock.
Manual link and inbound-create workflows persist the local link/base plus an idempotent
attachment intent before attempting the provider claim; transport failure therefore
replays without creating another bead or another link.
`sync` and `doctor` also detect pre-existing corruption from migrations, imports, or
hand edits: every holder of the duplicated provider id is reported, those pairs are
excluded before intent replay or provider I/O, and unrelated pairs continue.
Recovery is explicit `tbd integration unlink` until one holder remains.
Pending operations for the ambiguous external id are discarded—the durable surviving
bead re-plans current state after repair—so a stale former holder cannot write after
unlink.

Unlink is a cancellation-first transaction under the shared data-sync lock: prune every
pending operation for the bead or external item, clear the bead namespace, then delete
the bridge record last.
A journal read/parse/write failure leaves the link intact and the command retryable.
If execution stops after the bead clears, the bridge record retains the external id for
the retry. Replay provides the independent cross-machine guard: any journal merged later
is consumed without provider I/O because its live link claim is gone.

An absent intent directory means there is nothing to replay.
Any present journal that cannot be read, parsed, or validated fails the sync closed
before provider mutation; silently skipping a create intent would lose its client UUID
and permit duplication.

Plain `tbd sync` runs enabled trackers after git pull/merge and before push, alongside
docs and issues. Surface failures roll up without discarding successful work.
`tbd sync --push` selects only the Git issue surface and skips trackers.
The deliberate combined form `tbd sync --push --integrations` performs outbound provider
projection while holding the data-sync lock, then commits those writes before the Git
push; it does not invoke inbound reconciliation.
`tbd integration sync --push` is the provider-specific outbound command.
Provider reports with contained item failures and invalid integration config both fail
the tracker surface closed and produce a non-zero aggregate result, while independent
surfaces still complete.
The unset `integrations.on_tbd_sync` mode resolves to `guarded`, which folds enabled
trackers into plain sync but refuses an oversized run.
An explicit `integrations.on_tbd_sync: off` keeps a configured tracker manual.
The retired pre-f08 boolean `sync_on_tbd_sync` remains readable only for migration
compatibility. There are no webhooks or background provider polling; remote exchange is
always an ordinary explicit tbd command.

**Candidate GitHub adapter.** The current runtime implements the full tracker lifecycle
only for Linear. GitHub has config-schema and provider-registry scaffolding, but
`buildAdapter()` rejects it because no GitHub adapter exists.
Generic bead `refs` can persist GitHub issue or pull-request URLs as ordinary external
references; tbd does not currently fetch, refresh, link, unlink, claim, or mutate those
GitHub objects. The issue adapter and a read-only pull-request association lifecycle
remain candidate behavior.

The live browser remains a viewer.
It may project allow-listed provider keys and URLs, offer shared provider filters, and
navigate to external items; it never holds a credential, calls a provider, edits a link,
or changes sync semantics.
Agents perform link, unlink, explicit inbound selection, outbound projection, and full
sync with the CLI, and the existing local observer publishes those bead changes
immediately.

The full policy, bridge layout, state machine, rollout gates, GitHub work map, and web
projection contract live in
`docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md`. That plan
contains the authoritative compatibility/evidence matrix.
The provider-independent live scenario contract and completion check live in the
import-safe `scripts/provider-live-qa-contract.ts` module.
Linear supplies the concrete API driver through
`scripts/validate-linear-integration-live.ts`, documented in
`tests/qa/linear-integration.qa.md`; future GitHub validation reuses the same scenario
IDs and adds only provider-specific cases.

* * *

**End of tbd Design Specification**

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
