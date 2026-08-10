---
type: is
id: is-01kzn3x8t4xkexsjd4pqhc2fz5
title: Review and harden bead-web spike (technical review findings)
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
created_at: 2026-08-10T05:56:41.411Z
updated_at: 2026-08-10T06:04:33.826Z
---

## Notes

Review complete, six findings fixed and live-verified in commit 6bf3f1b9 on claude/tbd-web-spike: Host/Origin validation (DNS rebinding + cross-origin POST, 403), SSE backpressure (drop clients past 1MB buffered), demo-topology cleanup + actionable EADDRINUSE on startup failure, 4xx mapping for write usage errors (400 bad JSON/status, 413 oversized), displayId-keyed /api/bead lookup replacing O(n) scan, single sort per tree query. Verified via curl against a live instance before commit.
