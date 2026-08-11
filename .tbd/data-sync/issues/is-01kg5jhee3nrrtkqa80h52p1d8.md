---
type: is
id: is-01kg5jhee3nrrtkqa80h52p1d8
title: "Phase 7: Testing for unified sync"
kind: task
status: open
priority: 3
version: 10
spec_path: docs/project/specs/active/plan-2026-01-29-unified-sync-command.md
labels: []
dependencies: []
parent_id: is-01kg5jgqscrbp94t3hb1cegr39
created_at: 2026-01-29T19:09:04.323Z
updated_at: 2026-08-11T07:02:08.257Z
extensions:
  linear:
    id: 1e220fa3-d020-48a5-9131-86eabc1c9d98
    key: TBD-46
    url: https://linear.app/finterm-ai/issue/TBD-46/phase-7-testing-for-unified-sync
    linked_at: 2026-08-10T19:36:26.324Z
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
