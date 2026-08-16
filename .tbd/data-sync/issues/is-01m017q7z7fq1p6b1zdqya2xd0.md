---
type: is
id: is-01m017q7z7fq1p6b1zdqya2xd0
title: A crashed sync leaves the bead store unwritable for up to 30 minutes
kind: bug
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - sync-efficiency
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T22:54:11.431Z
updated_at: 2026-08-16T00:14:21.113Z
extensions:
  linear:
    id: 9c50fe97-2266-4a27-b017-00883b295288
    linked_at: 2026-08-16T00:14:21.113Z
---
Hit during this session. A tbd sync killed mid-run (command timeout) left .git/tbd/locks/data-sync.lock held by a dead pid. Every subsequent write (tbd create/update) then blocked.

Stale recovery works but is slow: DATA_SYNC_LOCK_OPTIONS sets staleMs = 30 min and timeoutMs = 35 min, and the PID-liveness check (ownerIsDefinitelyDead, lockfile.ts:276-288) sits INSIDE the age gate (lockfile.ts:716-726) rather than being a fast path. So a definitely-dead same-host owner still holds the lock for the full 30 minutes.

That is a defensible design for a lock protecting fetch/merge/push, but for an agent workflow it means one killed sync stalls all bead writes for half an hour, with no message explaining why (the command simply hangs until timeoutMs).

Worth considering: (a) break the lock immediately when the owner pid is provably dead on this host and the record is unchanged across the check — the safety argument for waiting is about SUSPENDED processes, which ESRCH already excludes; or at minimum (b) print a waiting-on-lock notice naming the holder pid and the expected stale time, so the stall is legible instead of looking like a hang.

Reproduced: three lock generations, all owner pids dead (verified via kill -0 -> ESRCH), hostname matching, and writes still blocked.
