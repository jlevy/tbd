---
type: is
id: is-01kst8pd1c6e9khrcjvwbnya4f
title: "Phase 2 rescue tests: same-ULID divergence matrix + dirty-worktree precondition"
kind: task
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-05-29-tbd-sync-unrelated-history-hardening.md
labels: []
dependencies: []
parent_id: is-01kss7hxvj9nxnhthv6efvehg0
created_at: 2026-05-29T16:22:20.460Z
updated_at: 2026-05-29T17:16:14.241Z
---
Dedicated unit/integration test bead for rescueUnrelatedHistory (separate from the impl bead tbd-6l8r and the e2e tryscript tbd-xxk5), per the spec's Phase 2 'Tests:' bullet and Testing Strategy.

Construct two unrelated tbd-sync roots in a temp repo, run rescue, and assert:
- git merge-base --is-ancestor origin/tbd-sync tbd-sync is true (push fast-forwards)
- issue-file count == id-map entry count; no duplicate public IDs
- local-only beads survive; backup branch tbd-backup-<ts> exists with pre-rescue HEAD

Same-ULID divergence matrix (both-different bucket, must never be dropped):
- identical content -> no-op
- differing scalar fields -> mergeIssues field-merge
- differing labels -> field-merge
- true conflict -> preserved in attic/conflicts/

Precondition test: rescue aborts on a dirty worktree / merge-in-progress (no MERGE_HEAD, no unstaged changes) rather than resetting over uncommitted work.

Prefer pure functions for the ULID-bucket categorization so it can be unit-tested without git.
