---
type: is
id: is-01m05x3fzw9mvsg09kdseyqh78
title: Reopening a bead whose Linear issue was archived should unarchive it
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T18:24:50.683Z
updated_at: 2026-08-16T18:24:50.683Z
---
When a remote is archived the pair is marked orphaned and skipped (sync-engine ~line 609) — correct quiescence for closed work, and the bead keeps its link so no duplicate is created.

But a REOPENED bead takes the same branch: the pair stays orphaned and the reopen never reaches Linear. With Linear's auto-archive running (autoArchivePeriod, default 6 months), every reopen-after-archive silently stops syncing.

Linear has issueUnarchive. The engine should, when a linked bead is in an open-ish status and the remote reports archivedAt, unarchive and revive the pair (orphaned -> linked), then reconcile normally. This is the missing half of letting Linear's native archival be the pair's end-of-life.
