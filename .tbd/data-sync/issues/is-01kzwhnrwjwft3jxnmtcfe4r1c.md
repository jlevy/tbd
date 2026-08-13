---
type: is
id: is-01kzwhnrwjwft3jxnmtcfe4r1c
title: Preserve active sort stack across live bead updates
kind: bug
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:11:56.813Z
updated_at: 2026-08-13T04:06:22.845Z
closed_at: 2026-08-13T04:06:22.845Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Live-browser review may have observed a selected decreasing-Updated sort reset when a bead changed and the watcher delivered a new snapshot. Verify end to end with a real local bead mutation: URL/query sort stack, chooser/header state, and row ordering must survive refresh/SSE data-version changes. A changed bead may move within the selected order, but the order keys and directions must never reset. Fix and add regression coverage if reproducible; otherwise document the evidence before closing.

## Notes

Live-browser validation on 2026-08-12: with the default Updated-desc/Priority-asc stack active, a real local bead mutation triggered the filesystem observer and board refresh without changing either sort key or direction; the updated bead moved to the top as expected under the preserved ordering.
