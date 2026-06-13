---
type: is
id: is-01ktyewrravyxqrr1t2073ytjb
title: "Guard the reference kind: FORK_KINDS includes it but KIND_CACHE_PATHS does not"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:20.074Z
updated_at: 2026-06-12T18:20:33.038Z
closed_at: 2026-06-12T18:20:33.038Z
close_reason: "Resolved in a3a5b37: explanatory guard comment at KIND_CACHE_PATHS; parseKindOption prevents the CLI creating reference entries until Phase 5 adds the references/ cache dir."
---
[Phase 5] PR #169. A forked reference doc would permanently compute orphaned (cache lookup always misses). Add the mapping with Phase 5 (references/ dir) or guard + comment until then.
