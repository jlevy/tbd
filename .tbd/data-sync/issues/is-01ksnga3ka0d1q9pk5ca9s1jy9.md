---
type: is
id: is-01ksnga3ka0d1q9pk5ca9s1jy9
title: "H6: Decide stale-lock heartbeat policy (accept risk or implement heartbeat)"
kind: task
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies: []
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T19:59:14.026Z
updated_at: 2026-05-28T04:17:02.499Z
closed_at: 2026-05-28T04:17:02.499Z
close_reason: null
---
RESIDUAL RISK (both reviews, non-blocking). DATA_SYNC_LOCK_OPTIONS (packages/tbd/src/utils/lockfile.ts:70-74) uses timeoutMs 35min > staleMs 30min (invariant now correct), but there is no heartbeat: a live tbd sync that hangs longer than staleMs can have its lock broken by another process mid-operation. 
Decision: either (a) explicitly accept this risk for current data sizes and document the trade-off in the spec/lockfile.ts comment, or (b) implement heartbeat metadata inside the lock directory (touch mtime periodically during long sync; treat lock as stale only if heartbeat is older than staleMs). 
Recommendation: accept the risk now (option a) and split heartbeat into a separate future enhancement bead — non-blocking for this PR. 
Acceptance: spec H6 reflects the chosen decision; if (a), lockfile.ts comment documents the accepted window; if (b), heartbeat implemented + tested.
