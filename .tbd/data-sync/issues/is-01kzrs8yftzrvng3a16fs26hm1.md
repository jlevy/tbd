---
type: is
id: is-01kzrs8yftzrvng3a16fs26hm1
title: "Phase 4.1: implement transport-injected web client store and race tests"
kind: task
status: closed
priority: 1
version: 5
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
updated_at: 2026-08-11T18:03:03.852Z
closed_at: 2026-08-11T18:03:03.852Z
close_reason: Production CLI/server/client implementation complete; lifecycle, security, race, build, browser, performance, and packaged-artifact evidence is green.
extensions:
  linear:
    id: 36a1280d-99c2-4389-84d3-17967abd13e4
    linked_at: 2026-08-11T16:24:51.930Z
    key: TBD-144
    url: https://linear.app/finterm-ai/issue/TBD-144/phase-41-implement-transport-injected-web-client-store-and-race-tests
---
Create packages/tbd/src/web/core.ts with BoardControls/query building, caveats, phase labels, deltasValid, and ClientStore. Inject fetch/events transport; enforce one board request plus queued refresh, generation ordering, monotonic SSE state, expanded-body generation, stale success/error discard, reconnect cursor, and wake coalescing. Add packages/tbd/tests/web-core.test.ts covering the prior R4-R6 races and unresolved Bugbot stale-error race (tbd-x8g8) red-first.

## Notes

Red-first client-store work started. Coverage explicitly includes PR thread discussion_r3755544745: a pre-wake body fetch that rejects after a fresh post-wake success must not overwrite the fresh body. Also pinning connect-before-fetch, queued wake coalescing, embedded-state monotonicity, resume cursor, delta gate, and query serialization.
