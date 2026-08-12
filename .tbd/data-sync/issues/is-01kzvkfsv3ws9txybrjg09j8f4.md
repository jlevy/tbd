---
type: is
id: is-01kzvkfsv3ws9txybrjg09j8f4
title: Keep live-change marker adjacent to bead ID
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - review
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T18:24:23.906Z
updated_at: 2026-08-12T18:29:32.677Z
closed_at: 2026-08-12T18:29:32.676Z
close_reason: null
---
Late PR review thread PRRT_kwDOQ109P86YrKUT notes td.id::after paints the live-change dot after the copyable control's reserved button space. Anchor the marker to the literal ID text rather than the cell and protect the geometry/selector with a regression test.
