---
type: is
id: is-01kzwvykw482c2wyh4rnxjp9xr
title: "PR #209 review S6: Preserve keyboard focus across live rerenders"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - accessibility
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:32.355Z
updated_at: 2026-08-13T06:29:35.744Z
closed_at: 2026-08-13T06:29:35.744Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S6. packages/tbd/src/web/client.ts renderBoard and renderLabelFacetOptions replace focused subtrees during SSE updates. Capture stable focus identity before replacement and restore it afterward; avoid rebuilding an open label menu unnecessarily. Cover row disclosure, copy control, and label chooser focus.
