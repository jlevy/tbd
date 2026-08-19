---
type: is
id: is-01m0bahns9883ea2cn8ajgnf99
title: "tracker: state model (resolution, hold, name-based Linear mapping)"
kind: epic
status: in_progress
priority: 0
version: 7
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
assignee: josh
labels: []
dependencies:
  - type: blocks
    target: is-01m0c4z87m3kd0cyw2qkd5k6z4
child_order_hints:
  - is-01m0bahzrjpybv07yrjx11r7bc
  - is-01m0baj02g8vwdd94fd2cgck33
created_at: 2026-08-18T20:55:59.008Z
updated_at: 2026-08-19T04:41:02.811Z
extensions:
  linear:
    id: a6f4de12-f0b2-4eeb-a444-01666ac9d52c
    linked_at: 2026-08-19T04:41:02.810Z
---
tbd has one terminal status and no way to say work was abandoned rather than delivered, nor that it began and stopped. Adds `resolution` (completed|canceled|duplicate) and `hold` (blocked|paused) as axes beside status, and replaces Linear state resolution by board position with resolution by name.

Design discussion: https://github.com/jlevy/tbd/issues/244
