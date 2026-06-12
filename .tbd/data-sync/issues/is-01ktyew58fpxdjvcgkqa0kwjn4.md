---
type: is
id: is-01ktyew58fpxdjvcgkqa0kwjn4
title: git merge-file exit codes >127 misread as conflict counts; can clobber customized fork with empty content
kind: bug
status: closed
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:00.111Z
updated_at: 2026-06-12T18:20:22.088Z
closed_at: 2026-06-12T18:20:22.087Z
close_reason: "Fixed in 4301220: exits >127 from git merge-file reject with stderr context instead of resolving as conflict counts; unit test with binary input (exit 255) added."
---
[Phase 3] PR #169. fork-update.ts:66-79 treats any positive exit code as conflicts. git merge-file exits 255 on error (verified; conflict count is truncated to 127), so an error path resolves as merged-conflict with empty stdout and overwrites the customized forked file. Fix: treat code > 127 as an error; add unit test.
