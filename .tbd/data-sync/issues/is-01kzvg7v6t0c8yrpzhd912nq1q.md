---
type: is
id: is-01kzvg7v6t0c8yrpzhd912nq1q
title: Tune row disclosure chevron optical alignment
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:27:37.432Z
updated_at: 2026-08-12T17:52:40.712Z
closed_at: 2026-08-12T17:52:40.712Z
close_reason: "Implemented and verified in the live production viewer: unavailable bulk action hidden; expanded title weight stable; detail body structurally aligned to ID; chevron optically offset by 1px; ancestor tree guides continue through wrapped lines; page threshold raised to an empirically validated 5,000 rows. Focused 76-test web suite, full ci, 1,075 CLI transcripts, packed-web proof, publint, package-age policy, watcher release smoke, and live Chromium validation all pass."
---
packages/tbd/src/web/styles.css: move each row disclosure chevron slightly down relative to the bead ID while preserving the now-correct text baselines. Express the optical offset as a design token and cover it in CSS regression tests.
