---
type: is
id: is-01kyqdm4n2zrnk78p7a79q0w4g
title: "PR #198 review R2: single show --ignore-missing swallows non-ENOENT read failures"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyqdkenfn9rswm3s44vg11j8
created_at: 2026-07-29T17:09:15.042Z
updated_at: 2026-07-29T18:04:24.961Z
closed_at: 2026-07-29T18:04:24.961Z
close_reason: "Review addressed on PR #198: R1-R4 + docs gap fixed in 69b6ec8, Bugbot round-1 trio fixed in 52c9856, Bugbot round-2 pair rebutted in-thread with technical justification. Disposition map posted; CI green on all checks at 52c9856."
---
Medium. show.ts showSingle readIssue catch treats corrupt YAML/EPERM as Not found (exit 0 under --ignore-missing). Bulk path only downgrades ENOENT. Fix: single path downgrades only resolve-miss + ENOENT under --ignore-missing; other errors rethrow with original context. Audit the bare readIssue catches in create --depends-on and dep runMulti blocker reads the same way. Add corrupt-file test for the single path.
