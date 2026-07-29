---
type: is
id: is-01kyqdm2sqe8j0ft318wdfqvjq
title: "PR #198 review R1: dep/create blocker writes can persist partial state without reporting it"
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyqdkenfn9rswm3s44vg11j8
created_at: 2026-07-29T17:09:13.142Z
updated_at: 2026-07-29T18:04:24.942Z
closed_at: 2026-07-29T18:04:24.941Z
close_reason: "Review addressed on PR #198: R1-R4 + docs gap fixed in 69b6ec8, Bugbot round-1 trio fixed in 52c9856, Bugbot round-2 pair rebutted in-thread with technical justification. Disposition map posted; CI green on all checks at 52c9856."
---
High. create.ts:182-191 (blocker wiring after writeIssue+saveIdMapping), dep.ts runMulti write loops. Sequential blocker writes: a later failure leaves earlier edges applied, command exits 1 with a generic error and no per-target outcome; create --depends-on can fail after the bead is durable WITHOUT revealing the new display ID (retry -> duplicate bead). Repro'd by reviewer with unwritable second blocker. Fix option chosen: explicit resumable partial reporting (option 2), matching the repo's existing bulk contract (bulk.ts throwOnWriteFailures reports, never rolls back; mapping saves are merge-protected against entry loss, so rollback of create is not viable anyway). Report added/failed per target in input order; create always emits the created ID once durable plus a remedy command. Fault-injection tests (vitest, win32-skipped).
