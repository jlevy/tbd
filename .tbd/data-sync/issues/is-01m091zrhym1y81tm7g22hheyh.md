---
type: is
id: is-01m091zrhym1y81tm7g22hheyh
title: "Integration robustness: policy sizing, lock recovery, and link durability"
kind: epic
status: closed
priority: 1
version: 5
labels: []
dependencies: []
child_order_hints:
  - is-01m09206be03ygtgz4mc1serg2
  - is-01m0920hptvym7fn204t7s23wc
  - is-01m0920y7b3hk0mf56c4seh9hr
created_at: 2026-08-17T23:47:54.548Z
updated_at: 2026-08-18T00:05:38.200Z
closed_at: 2026-08-18T00:05:38.200Z
close_reason: Fixed in 8fcbacc3. Selection previews now report why beads were selected (kind vs inherited spec_path) and warn when inheritance dominates; the sync fold defaults to guarded so a plain tbd sync no longer waives the bulk guard; the bridge link record is written before the follow-up round trips that previously left half-written pairs; and doctor reports both abandoned lock sidecars (--fix clears provably dead ones) and beads whose link has no bridge record. 2240 tests pass.
---
Three defects found while connecting a large spec-driven repo (1450 open beads, 121 open epics, 120 active specs) to Linear for the first time on v0.7.0. Together they turned a routine first sync into a cleanup job: 263 unwanted issues created in a shared workspace, 473 beads left claiming links to issues that never existed, and a deadlock that made every later tbd command appear to hang.

Each is independently fixable and independently valuable. The common thread is that the integration surface reports success and health in situations where a human would call it broken.
