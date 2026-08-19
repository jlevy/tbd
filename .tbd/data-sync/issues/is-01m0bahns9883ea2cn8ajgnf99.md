---
type: is
id: is-01m0bahns9883ea2cn8ajgnf99
title: "Tracker state model: resolution, hold, and name-based Linear mapping"
kind: epic
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
child_order_hints:
  - is-01m0bahzrjpybv07yrjx11r7bc
  - is-01m0baj02g8vwdd94fd2cgck33
  - is-01m0c5qm44fxj4m6tr29k2v29f
  - is-01m0c5qw38xxxfgr8grwwnyz7x
created_at: 2026-08-18T20:55:59.008Z
updated_at: 2026-08-19T04:51:13.639Z
---
tbd has one terminal status and no way to say work was abandoned rather than delivered, nor that it began and stopped. Adds `resolution` (completed|canceled|duplicate) and `hold` (blocked|paused) as axes beside status, and replaces Linear state resolution by board position with resolution by name.

Design discussion: https://github.com/jlevy/tbd/issues/244
