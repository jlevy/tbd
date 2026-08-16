---
type: is
id: is-01kzwvykgjy83x75qwycq14a6d
title: "PR #209 review S5: Do not toggle rows after text selection"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:31.985Z
updated_at: 2026-08-13T06:29:35.735Z
closed_at: 2026-08-13T06:29:35.735Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S5. packages/tbd/src/web/client.ts whole-row expansion fires after drag-select. In the delegated row handler, require the browser selection to be collapsed before toggling and cover text-copy selection behavior.
