---
type: is
id: is-01kzvg7erezahwkze1bb9dt8kp
title: Keep expanded row title weight stable
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:27:24.685Z
updated_at: 2026-08-12T17:52:40.666Z
closed_at: 2026-08-12T17:52:40.666Z
close_reason: "Implemented and verified in the live production viewer: unavailable bulk action hidden; expanded title weight stable; detail body structurally aligned to ID; chevron optically offset by 1px; ancestor tree guides continue through wrapped lines; page threshold raised to an empirically validated 5,000 rows. Focused 76-test web suite, full ci, 1,075 CLI transcripts, packed-web proof, publint, package-age policy, watcher release smoke, and live Chromium validation all pass."
---
packages/tbd/src/web/styles.css: expanded rows must bold only the bead ID, not the title or metadata, so selection does not change text width. Update the co-located design-system rule and CSS regression tests.
