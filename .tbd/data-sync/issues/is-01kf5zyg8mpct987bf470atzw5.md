---
type: is
id: is-01kf5zyg8mpct987bf470atzw5
title: "Bug: import status mapping missing done to closed"
kind: bug
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:08:11.638Z
updated_at: 2026-03-09T16:12:29.994Z
closed_at: 2026-01-16T19:07:46.563Z
close_reason: Added done->closed mapping in import.ts and verified with tryscript tests
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.220Z
    original_id: tbd-1813
---
The mapStatus function in import.ts doesn't map beads 'done' status to tbd 'closed'. Beads uses 'done' for completed issues, but the statusMap only has 'closed' and 'tombstone'. This causes all 'done' issues (127 of them) to be imported as 'open' instead of 'closed'.
