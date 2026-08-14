---
type: is
id: is-01kzvg7mzrhqy5m7a70qw0gn6e
title: Align expanded bead details to the ID column
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:27:31.007Z
updated_at: 2026-08-12T17:52:40.686Z
closed_at: 2026-08-12T17:52:40.686Z
close_reason: "Implemented and verified in the live production viewer: unavailable bulk action hidden; expanded title weight stable; detail body structurally aligned to ID; chevron optically offset by 1px; ancestor tree guides continue through wrapped lines; page threshold raised to an empirically validated 5,000 rows. Focused 76-test web suite, full ci, 1,075 CLI transcripts, packed-web proof, publint, package-age policy, watcher release smoke, and live Chromium validation all pass."
---
packages/tbd/src/web/client.ts renderRow and packages/tbd/src/web/styles.css: give the disclosure chevron its own table column and make the expanded detail body begin on the exact ID-column grid line. Prefer structural table cells over magic padding. Add DOM/CSS regression coverage.
