---
type: is
id: is-01kv6252k13c1nk228rsknfa1j
title: Update spec statuses after v0.3.0 ship (f05/f06)
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-06-15T16:34:36.257Z
updated_at: 2026-06-15T16:34:36.257Z
---
Doc hygiene noticed during the v0.3.0 release review (not release-blocking):
- docs/project/specs/active/plan-2026-06-12-config-upgrade-history.md (f06) is still in active/ though f06 shipped in v0.3.0 — move it to done/.
- Both plan-2026-06-11-forkable-docs.md (already in done/) and the config-upgrade-history spec still say 'Status: Draft' in their headers — update to a completed status.
These are repo docs under docs/project/specs/, not shipped in the npm package, so they did not affect the v0.3.0 release.
