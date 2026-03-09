---
close_reason: Added done->closed mapping in import.ts and verified with tryscript tests
closed_at: 2026-01-16T19:07:46.563Z
created_at: 2026-01-16T07:08:11.638Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.220Z
    original_id: tbd-1813
id: is-01kf5zyg8mpct987bf470atzw5
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "Bug: import status mapping missing done to closed"
type: is
updated_at: 2026-03-09T02:47:21.149Z
version: 5
---
The mapStatus function in import.ts doesn't map beads 'done' status to tbd 'closed'. Beads uses 'done' for completed issues, but the statusMap only has 'closed' and 'tombstone'. This causes all 'done' issues (127 of them) to be imported as 'open' instead of 'closed'.
