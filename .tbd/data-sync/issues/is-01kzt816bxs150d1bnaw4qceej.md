---
type: is
id: is-01kzt816bxs150d1bnaw4qceej
title: Fail boundedly when prepared lock-owner generation disappears
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T05:44:56.444Z
updated_at: 2026-08-12T06:08:38.601Z
closed_at: 2026-08-12T06:08:38.601Z
close_reason: Implemented the portable mkdir-elected owner-generation protocol, bounded all failed-progress paths, preserved actionable permission diagnostics, and verified the adversarial and full release matrices.
---
An ENOENT owner-install rename is retryable when the canonical parent was concurrently displaced, but not when this contender's token-private prepared generation itself vanished. Inspect the private source after a failed install; retry only while it still exists, otherwise surface the filesystem error after empty-only cleanup. Add a forced disappearance regression and map it in the design/spec.
