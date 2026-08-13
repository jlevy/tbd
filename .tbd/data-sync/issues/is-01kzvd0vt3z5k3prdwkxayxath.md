---
type: is
id: is-01kzvd0vt3z5k3prdwkxayxath
title: Give web bead tags a deliberate non-wrapping-first column
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:31:22.945Z
updated_at: 2026-08-12T17:21:45.989Z
closed_at: 2026-08-12T17:21:45.989Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
The Labels column currently receives only leftover auto-table width, so ready and ordinary label tags wrap even when the table has ample room. Keep ready beside user labels because both are bead attributes, but in packages/tbd/src/web/client.ts render them inside one .tag-cluster and mark the header/data cells as .labels. In packages/tbd/src/web/styles.css assign the column a sensible minimum/target width, keep each individual tag unbroken, and let only the cluster wrap when the full set cannot fit. Balance this against the title column and preserve the 700px narrow-screen table contract. Add regression coverage and verify representative one- and two-tag rows in the live viewer.
