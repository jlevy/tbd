---
type: is
id: is-01kzrs9mb24gzv94d2mvexqnbd
title: "Phase 4.4: prove client/server behavior parity and retire stale inline race paths"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - integration
  - testing
  - web
dependencies:
  - type: blocks
    target: is-01kzrs9vkh8j1vsrfytqdx3sr1
parent_id: is-01kzrs6dd1abehychzed2yc1fk
created_at: 2026-08-11T16:08:09.825Z
updated_at: 2026-08-11T16:08:17.264Z
---
Add built-artifact integration checks for connect-before-fetch, query round-trip/equivalent command, wake/body refresh, Last-Event-ID, and safe rendering. Verify the stitched page reproduces the spike’s required behavior and contains no inline development-only mutation or stale body error path; use this evidence to close tbd-x8g8 when the spike is deleted.
