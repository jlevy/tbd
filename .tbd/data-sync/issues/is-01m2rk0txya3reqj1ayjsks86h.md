---
type: is
id: is-01m2rk0txya3reqj1ayjsks86h
title: "PR #307 B3: repair keyed on parsed id, so duplicate-id files inflate the count"
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
created_at: 2026-09-17T21:05:35.677Z
updated_at: 2026-09-17T21:47:12.802Z
started_at: 2026-09-17T21:46:46.280Z
closed_at: 2026-09-17T21:47:12.800Z
close_reason: "fixed in 16df8995: only an issue stored in exactly one <id>.md is rewritten (second listing with validateFileName, plus a per-id file count), so a duplicate or renamed file is reported as kept instead of written from another file's contents. Confirmed by 'does not rewrite an issue whose id is claimed by two files'."
resolution: null
duplicate_of: null
---
Low. doctor.ts:1015-1031. Two files parsing to the same id both write <id>.md: the count says 2, one file changes, and the repair never converges. Key the repair on files. Review B: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5241384146
