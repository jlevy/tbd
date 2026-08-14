---
type: is
id: is-01kzwvym7hwt6fnwdym126tf4b
title: "PR #209 review S7: Explain browser sorting in equivalent command"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - docs
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:32.720Z
updated_at: 2026-08-13T06:29:35.753Z
closed_at: 2026-08-13T06:29:35.753Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S7. packages/tbd/src/cli/web/board.ts describeQuery and packages/tbd/src/web/core.ts command hint make the default two-key browser sort permanently inexact while displaying tbd list --pretty without the visible order. Name the actual browser sort divergence precisely and test default and custom stacks.
