---
type: is
id: is-01kzwkf94ttfwv36p51yvb0ypx
title: Make Pretty the default and preserve Updated sorting
kind: feature
status: closed
priority: 1
version: 4
labels:
  - web
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:43:21.241Z
updated_at: 2026-08-13T04:06:22.933Z
closed_at: 2026-08-13T04:06:22.933Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Pretty is enabled by default and never clears when sorting changes. In Pretty mode, the active two-key sort orders top-level tree groups only; children always retain official child_order_hints ordering with the existing deterministic fallback. For an Updated key, each root/epic group's effective timestamp is the maximum updated_at across that root and every visible descendant, so recent work inside an epic raises the entire group. Other keys compare the root bead itself; the secondary key resolves equal primary values. Flat mode keeps global row sorting. Update core defaults, initial HTML, client control handling, server tree ordering, equivalent-command caveats, tests, and docs; validate across live updates.

## Notes

Live validation confirmed roll-up is required: parent tbd-wter remained at 2026-08-13T03:44:22.414Z while child tbd-ewol advanced to 2026-08-13T03:59:30.360Z. With Pretty + Updated desc, the server still placed tbd-wter's whole group first via subtree maximum; tbd-ewol remained at its official child-order position. Browser validation also confirmed reversing Updated did not clear Pretty and Reset restored Pretty + Updated desc + Priority asc.
