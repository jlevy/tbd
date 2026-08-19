---
type: is
id: is-01kyt5xmd4e44kvtkrx1fehz6m
title: "PR #196 review N2: one transient poll failure kills an unattended watch"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kyt5x6y2h4d3x7b68jjr6n2j
created_at: 2026-07-30T18:52:20.772Z
updated_at: 2026-07-30T19:12:33.293Z
closed_at: 2026-07-30T19:12:33.293Z
close_reason: "Fixed in f71b1cf on PR #196; CI green"
---
bead-watch.ts:103-138,183-208: ls-remote/fetch failure mid-loop exits 1; daemon exits on 1. Fix: bounded consecutive-failure tolerance in the poll loop; startup stays fail-fast. PR #196
