---
type: is
id: is-01kzn5132f7f1gntqbg68wg2hv
title: "Conflict handling: attic entry plus external comment with resolve lifecycle"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn513dx5caz86bq89cm502s
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:15.182Z
updated_at: 2026-08-10T06:16:15.548Z
---
When BOTH sides changed the same field: resolve by configured per-field owner, else LWW; archive the loser to the existing attic; AND call postConflict() to post a comment naming the field, both values, and the attic path. commentResolve/commentUnresolve exist (verified), so a conflict report has a native handled/unhandled state an agent can query later. Track comment ids in bridge state. This is the requirement that conflicts are never silently resolved. Spec Component 10.
