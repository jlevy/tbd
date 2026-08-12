---
type: is
id: is-01kzsttpn4rnzxb23qtg62hrpg
title: Retry transient local reload failures without a new filesystem change
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - liveness
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:54:12.259Z
updated_at: 2026-08-12T04:38:51.082Z
closed_at: 2026-08-12T04:38:51.082Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
A reload error leaves lastMarker unchanged. If the marker equals the last accepted value and no new native event arrives, reconciliation suppresses every later reload and the observer remains in error after the transient condition clears. Invalidate the accepted marker and schedule a bounded retry, preserving one-active/one-pending work and avoiding a busy loop; add recovery tests.
