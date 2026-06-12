---
type: is
id: is-01ktyewpx6n7e803h6dmdh5q86
title: Validate --kind values across docs subcommands
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:18.182Z
updated_at: 2026-06-12T18:20:29.453Z
closed_at: 2026-06-12T18:20:29.453Z
close_reason: "Fixed in a3a5b37: parseKindOption validates --kind on fork/unfork/list/diff with the valid set in the error. Verified empirically (Unknown kind bogus)."
---
[Phase 1] PR #169. KIND_CACHE_PATHS[kind] ?? [] makes docs list --kind=bogus silently empty and fork --kind=bogus mislead with 'No doc found'. Validate against known kinds and error with the valid set.
