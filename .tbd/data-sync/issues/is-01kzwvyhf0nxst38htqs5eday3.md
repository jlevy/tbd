---
type: is
id: is-01kzwvyhf0nxst38htqs5eday3
title: "PR #209 review S1: Keep board refresh failures visible with rows"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:29.887Z
updated_at: 2026-08-13T06:29:35.702Z
closed_at: 2026-08-13T06:29:35.697Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S1. packages/tbd/src/web/core.ts BoardStore refresh failure sets boardError, but packages/tbd/src/web/client.ts renderBoard only exposes it through the rows-dependent empty state. Add a persistent error signal independent of row count, clear it after a successful refresh, and cover stale-table behavior.
