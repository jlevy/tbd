---
type: is
id: is-01kzp7rd5ap1sgzqgs3ejdwn5a
title: Orphaned empty data-sync.lock blocks all syncs; doctor reports healthy
kind: bug
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels:
  - sync
dependencies: []
created_at: 2026-08-10T16:23:10.758Z
updated_at: 2026-09-16T08:26:06.124Z
extensions:
  linear:
    id: ac24d02e-ed81-4d9a-8145-1b8515560cc1
    linked_at: 2026-09-16T08:26:06.124Z
---
A SIGTERM/crash during tbd sync leaves the empty lock directory .git/tbd/locks/data-sync.lock behind. There is no staleness or PID detection on the shared data-sync lock, so every later sync waits on it silently until killed, each kill orphaning a fresh lock. tbd doctor checks only parent-dir writability ('Shared lock writability') and reports the repository healthy, giving the operator no signal. Observed live 2026-08-10 after a machine crash and again after each timeout-kill. Fix: record owner PID (like refs/tbd/watch reclamation in bead-watch.ts), reclaim ownerless empty lock dirs on acquisition, and teach doctor to flag a stale lock.
