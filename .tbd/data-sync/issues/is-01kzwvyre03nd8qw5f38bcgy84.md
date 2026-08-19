---
type: is
id: is-01kzwvyre03nd8qw5f38bcgy84
title: "PR #209 review SG2: Make reset-sort scope honest"
kind: task
status: closed
priority: 3
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:37.023Z
updated_at: 2026-08-13T06:29:35.779Z
closed_at: 2026-08-13T06:29:35.779Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review suggestion 2. packages/tbd/src/web/client.ts reset sort also enables Pretty because isDefaultBoardSort includes pretty. Rename it reset view or leave Pretty unchanged, then update accessible labels/tests.
