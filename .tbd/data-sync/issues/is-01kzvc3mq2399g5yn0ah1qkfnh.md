---
type: is
id: is-01kzvc3mq2399g5yn0ah1qkfnh
title: Unify web semantic colors, status icons, and tag roles with the CLI
kind: feature
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:15:25.409Z
updated_at: 2026-08-12T17:21:45.949Z
closed_at: 2026-08-12T17:21:45.949Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Establish and implement the browser's concise authoritative visual-system contract beside packages/tbd/src/web/styles.css, informed by MetaBrowser's co-located token/component inventory without importing its stack. Reuse tbd's canonical CLI semantics from packages/tbd/src/lib/status.ts and priority.ts: status icons ○/◐/●/○/✓ and color families blue/green/red/muted/muted; priority P0 red, P1 amber, P2-P4 neutral. In packages/tbd/src/web/client.ts render Status and Priority as restrained semantic tags in board rows, apply the same status classes/icons in stats, keep arbitrary labels neutral, and keep readiness visually meaningful without making it the only colored tag. In packages/tbd/src/web/styles.css define component roles for semantic tags, plain aggregate metadata, icons, selects, and disclosures; retain tasteful text contrast and color only where it clarifies state. In packages/tbd/src/web/index.html change the aggregate bead count from a pill to plain header metadata. Extend packages/tbd/tests/bead-web-css.test.ts to enforce CLI-aligned icons/classes and the component-role invariants. Verify light/dark rendering, active/closed rows, priorities, readiness, stats, and header metadata in the built browser.
