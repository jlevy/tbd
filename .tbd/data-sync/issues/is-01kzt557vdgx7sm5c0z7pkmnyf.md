---
type: is
id: is-01kzt557vdgx7sm5c0z7pkmnyf
title: Do not strand a live-owned lock after heartbeat maintenance failure
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T04:54:43.306Z
updated_at: 2026-08-12T05:09:21.396Z
closed_at: 2026-08-12T05:09:21.395Z
close_reason: "Implemented advisory heartbeat failure handling: failed timestamp maintenance disables further touches, while direct token ownership fences still quiesce and release. Added forced EIO regression; full 1,551-test and 1,074-transcript matrix passed."
---
Bugbot found that a transient heartbeat utimes failure poisons lease.assertOwned and stop, preventing quiescent epoch publication and owned release even when the owner token remains valid. Make heartbeat touching advisory, preserve direct ownership checks as the safety authority, release a still-owned generation, and add a forced failure regression.
