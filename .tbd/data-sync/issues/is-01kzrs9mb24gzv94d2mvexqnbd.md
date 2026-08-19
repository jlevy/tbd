---
type: is
id: is-01kzrs9mb24gzv94d2mvexqnbd
title: "Phase 4.4: prove client/server behavior parity and retire stale inline race paths"
kind: task
status: closed
priority: 1
version: 4
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
updated_at: 2026-08-11T18:03:03.873Z
closed_at: 2026-08-11T18:03:03.873Z
close_reason: Production CLI/server/client implementation complete; lifecycle, security, race, build, browser, performance, and packaged-artifact evidence is green.
extensions:
  linear:
    id: 67d4faa8-fbfc-46d4-ac48-d59b086c3380
    linked_at: 2026-08-11T16:24:56.904Z
    key: TBD-147
    url: https://linear.app/finterm-ai/issue/TBD-147/phase-44-prove-clientserver-behavior-parity-and-retire-stale-inline
---
Add built-artifact integration checks for connect-before-fetch, query round-trip/equivalent command, wake/body refresh, Last-Event-ID, and safe rendering. Verify the stitched page reproduces the spike’s required behavior and contains no inline development-only mutation or stale body error path; use this evidence to close tbd-x8g8 when the spike is deleted.
