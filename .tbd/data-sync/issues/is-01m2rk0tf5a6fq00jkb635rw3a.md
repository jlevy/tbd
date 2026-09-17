---
type: is
id: is-01m2rk0tf5a6fq00jkb635rw3a
title: "PR #307 B2: a mid-loop write failure loses the partial count"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2rk07a26hew8fzbz8njv6r4
hold: null
hold_until: null
created_at: 2026-09-17T21:05:35.204Z
updated_at: 2026-09-17T21:47:12.090Z
started_at: 2026-09-17T21:46:46.271Z
closed_at: 2026-09-17T21:47:12.083Z
close_reason: "fixed in 16df8995: the loop goes through applyDependencyWrites, which records {id, message} per failed write and continues; the finding reports 'removed N, M issue file(s) could not be written' with the failing ids, and the candidates are sorted by id. A genuinely partial batch is not reproducible portably (rename permission is a property of the directory), so the test exercises the failing branch with every write failing."
resolution: null
duplicate_of: null
---
Low. doctor.ts:1019-1031. A failed write aborts the loop; nothing reports which edges were already removed or which file failed. applyDependencyWrites (cli/lib/bulk.ts:162-187) exists for exactly this. Review B: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5241384146
