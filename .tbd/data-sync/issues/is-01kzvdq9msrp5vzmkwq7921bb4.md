---
type: is
id: is-01kzvdq9msrp5vzmkwq7921bb4
title: Collapse gray text treatments to authoritative color roles
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - design-system
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:43:38.008Z
updated_at: 2026-08-12T17:21:46.037Z
closed_at: 2026-08-12T17:21:46.037Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Audit every color and opacity use in packages/tbd/src/web/styles.css and the live viewer. Auxiliary text (including command hints such as tbd status) must resolve directly to --muted, never to an opacity-derived extra gray; --border remains structural, --text remains primary, and semantic status/priority/update colors retain their meanings. Reserve opacity only for actual state changes such as disabled or context-only content, document any exceptions, add CSS contracts, and validate light/dark computed colors.
