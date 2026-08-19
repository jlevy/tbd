---
type: is
id: is-01kzwvyj4932csgk8945fy1jnt
title: "PR #209 review S2: Clear tooltips detached by status rerender"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:30.568Z
updated_at: 2026-08-13T06:29:35.713Z
closed_at: 2026-08-13T06:29:35.713Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S2. packages/tbd/src/web/client.ts renderStatus replaces status children and can detach activeTooltipTarget without pointerout. Centralize a document.contains guard in render(), hide stale tooltip state, restore aria safely, and add a regression.
