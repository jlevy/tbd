---
type: is
id: is-01kzrs8yftzrvng3a16fs26hm1
title: "Phase 4.1: implement transport-injected web client store and race tests"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - client
  - testing
  - web
dependencies:
  - type: blocks
    target: is-01kzrs94ma78nxv4qyd4yx8hr5
parent_id: is-01kzrs6dd1abehychzed2yc1fk
created_at: 2026-08-11T16:07:47.449Z
updated_at: 2026-08-11T16:07:53.737Z
---
Create packages/tbd/src/web/core.ts with BoardControls/query building, caveats, phase labels, deltasValid, and ClientStore. Inject fetch/events transport; enforce one board request plus queued refresh, generation ordering, monotonic SSE state, expanded-body generation, stale success/error discard, reconnect cursor, and wake coalescing. Add packages/tbd/tests/web-core.test.ts covering the prior R4-R6 races and unresolved Bugbot stale-error race (tbd-x8g8) red-first.
