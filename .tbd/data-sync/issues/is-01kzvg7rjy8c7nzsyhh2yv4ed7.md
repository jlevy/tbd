---
type: is
id: is-01kzvg7rjy8c7nzsyhh2yv4ed7
title: Benchmark and raise the board pagination threshold
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T17:27:34.744Z
updated_at: 2026-08-12T17:52:40.700Z
closed_at: 2026-08-12T17:52:40.700Z
close_reason: "Implemented and verified in the live production viewer: unavailable bulk action hidden; expanded title weight stable; detail body structurally aligned to ID; chevron optically offset by 1px; ancestor tree guides continue through wrapped lines; page threshold raised to an empirically validated 5,000 rows. Focused 76-test web suite, full ci, 1,075 CLI transcripts, packed-web proof, publint, package-age policy, watcher release smoke, and live Chromium validation all pass."
---
Benchmark production browser rendering at 5,000 and 10,000 visible beads, including DOM size and settled interaction/render latency. Choose the highest clean working-set threshold supported by evidence, keeping pagination as a last-resort safety valve for very large repositories. Update core, tests, active spec, design docs, README/docs/skill surfaces consistently.
