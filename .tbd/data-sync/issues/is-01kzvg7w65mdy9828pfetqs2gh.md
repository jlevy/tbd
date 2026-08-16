---
type: is
id: is-01kzvg7w65mdy9828pfetqs2gh
title: Continue ancestor tree guides through wrapped titles
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:27:38.436Z
updated_at: 2026-08-12T17:52:40.720Z
closed_at: 2026-08-12T17:52:40.720Z
close_reason: "Implemented and verified in the live production viewer: unavailable bulk action hidden; expanded title weight stable; detail body structurally aligned to ID; chevron optically offset by 1px; ancestor tree guides continue through wrapped lines; page threshold raised to an empirically validated 5,000 rows. Focused 76-test web suite, full ci, 1,075 CLI transcripts, packed-web proof, publint, package-age policy, watcher release smoke, and live Chromium validation all pass."
---
packages/tbd/src/web/client.ts renderRow and packages/tbd/src/web/styles.css: when a pretty-printed title wraps, continue each ancestor vertical tree guide through continuation lines, but do not continue the terminal elbow/branch connector. Support zero, one, or multiple ancestor bars and add focused rendering/CSS tests.
