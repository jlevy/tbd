---
type: is
id: is-01m00mw87c585dzj8yxfxm9er5
title: "f08: make IssueSchema preserve unknown keys and carry them through merge"
kind: feature
status: closed
priority: 0
version: 8
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-2
dependencies:
  - type: blocks
    target: is-01m00mw9ppcnxpzvqakekq5tpc
  - type: blocks
    target: is-01m00k639pqyx9p30eszfh06k0
  - type: blocks
    target: is-01m00y5g4nha1jb0kxnempajex
  - type: blocks
    target: is-01m00h62dhwa0tgqbrxz4sb0sc
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T17:24:52.588Z
updated_at: 2026-08-15T08:02:59.890Z
closed_at: 2026-08-15T08:02:59.889Z
close_reason: "f08 shipped: IssueSchema passthrough, mergeIssues carries keys outside FIELD_STRATEGIES via an LWW default, issuesSubstantivelyEqual compares them (without which a change to only an unknown key never persists), nested integration clauses passthrough, CURRENT_FORMAT f08 with migration and describeMigration. 15 contract tests in f08-unknown-key-preservation.test.ts."
---
PROVEN by round-trip probe: a bead carrying refs: and docs: written by a newer tbd comes back from an older client's parse-and-write with BOTH FIELDS SILENTLY DELETED, while extensions: survives (it is a declared field with opaque contents).

IssueSchema is a plain Zod object, so it parses in strip mode. The blast radius is larger than the f07 config case: a config strip loses one file's block on an explicit command; a bead strip loses metadata across EVERY bead an old client touches, and tbd sync rewrites beads during ordinary merges. Data-loss vector, not an inconvenience.

Three layers, not one:
- Parse (IssueSchema): strip drops unknown keys -> must preserve.
- Serialize (sortKeys, yaml-utils.ts:63-73): iterates Object.keys(obj) -> ALREADY CORRECT, no change.
- Merge (mergeIssues, git.ts:790-792): starts from {...base} then iterates the fixed FIELD_STRATEGIES table, so a key added on only ONE side is never copied -> needs a default strategy for keys outside the table.

f08 should do for beads what f07 did for config: preserve unknown keys AND bump the format so pre-f08 clients fail closed rather than deleting metadata they do not understand. After f08, an additive bead field never needs another bump.

Migration is metadata-only (a stamp, like f05 and f07). No issue file is rewritten, so the upgrade is abortable by restoring .tbd/config.yml and deleting $GIT_COMMON_DIR/tbd/layout.yml.

Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 2
Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §5.5

## Notes

SCOPE ADDITION: f08 must make the NESTED integration schemas passthrough too, not only IssueSchema. ConfigSchema and the provider blocks are already passthrough, but IntegrationSelectSchema (schemas.ts:350), InboundClauseSchema, and FieldSyncClauseSchema are plain Zod objects — so a key added inside select/policy.outbound/policy.inbound is stripped by an older client on the next config rewrite. The format rules require a bump for exactly that ('additions inside a nested schema that does not preserve unknown keys when an older client could lose data').

SEQUENCING CONSEQUENCE: any new selection clause waits for f08. That includes attention-based selection (tbd-9j5a, always_statuses), which is otherwise a small tempting change that would be silently lost.
