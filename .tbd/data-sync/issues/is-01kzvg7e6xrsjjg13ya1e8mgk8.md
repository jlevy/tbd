---
type: is
id: is-01kzvg7e6xrsjjg13ya1e8mgk8
title: Hide unavailable bulk expansion instead of showing a disabled fallback
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:27:24.124Z
updated_at: 2026-08-12T17:52:40.650Z
closed_at: 2026-08-12T17:52:40.649Z
close_reason: "Implemented and verified in the live production viewer: unavailable bulk action hidden; expanded title weight stable; detail body structurally aligned to ID; chevron optically offset by 1px; ancestor tree guides continue through wrapped lines; page threshold raised to an empirically validated 5,000 rows. Focused 76-test web suite, full ci, 1,075 CLI transcripts, packed-web proof, publint, package-age policy, watcher release smoke, and live Chromium validation all pass."
---
packages/tbd/src/web/client.ts renderBoard and packages/tbd/src/web/index.html: remove the confusing disabled 'Expand individually' fallback. Show Expand all/Collapse all only when the current page is small enough for bulk expansion; otherwise hide it. Cover visibility, labels, and behavior in web UI tests.
