---
type: is
id: is-01kzwj62hcm12f1gw1mg1pk8tb
title: Clarify filtered header tallies with shown
kind: bug
status: closed
priority: 3
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:20:50.987Z
updated_at: 2026-08-13T04:06:22.887Z
closed_at: 2026-08-13T04:06:22.887Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Change filtered aggregate copy from '<matched> of <total>' to '<matched> of <total> shown' so the numbers state what they count. Preserve '<total> beads' for the complete graph and the separate closed-hidden suffix and tooltip semantics. Add a source-contract assertion.
