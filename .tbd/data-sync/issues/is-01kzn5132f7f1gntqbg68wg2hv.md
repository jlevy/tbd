---
type: is
id: is-01kzn5132f7f1gntqbg68wg2hv
title: "Conflict handling: attic entry plus external comment with resolve lifecycle"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn513dx5caz86bq89cm502s
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:15.182Z
updated_at: 2026-08-13T09:54:26.477Z
closed_at: 2026-08-13T09:54:26.477Z
close_reason: "Implemented in PR #206 Phase 2. The delivered equivalents are bridge-state.ts link records, reconcile.ts field matrix, intents.ts replay, conflict attic/comment lifecycle, sync-engine.ts orchestration, integration documentation plus real-binary E2E, and the guarded tbd sync fold. Revalidated after merging v0.5.0 main: typecheck/build pass, 189 integration tests pass, and 73 integration/bridge/query/web-seam tests pass."
extensions:
  linear:
    id: 5454db30-4257-4fac-a0d5-5e1daffadbd7
    linked_at: 2026-08-11T06:50:57.723Z
    key: TBD-124
    url: https://linear.app/finterm-ai/issue/TBD-124/conflict-handling-attic-entry-plus-external-comment-with-resolve
---
When BOTH sides changed the same field: resolve by configured per-field owner, else LWW; archive the loser to the existing attic; AND call postConflict() to post a comment naming the field, both values, and the attic path. commentResolve/commentUnresolve exist (verified), so a conflict report has a native handled/unhandled state an agent can query later. Track comment ids in bridge state. This is the requirement that conflicts are never silently resolved. Spec Component 10.
