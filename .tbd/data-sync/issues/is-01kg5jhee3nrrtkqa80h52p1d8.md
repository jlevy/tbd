---
type: is
id: is-01kg5jhee3nrrtkqa80h52p1d8
title: "Phase 7: Testing for unified sync"
kind: task
status: open
priority: 3
version: 6
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:04.323Z
updated_at: 2026-03-09T16:12:33.410Z
---
Add tests:
- Unit tests for syncDocsWithDefaults()
- Unit tests for auto-prune behavior
- Integration test: tbd sync syncs both
- Integration test: tbd sync --issues only syncs issues
- Integration test: tbd sync --docs only syncs docs
- Integration test: new bundled docs appear after upgrade simulation
- Integration test: stale internals are pruned
- Verify tbd docs --refresh returns command not found
