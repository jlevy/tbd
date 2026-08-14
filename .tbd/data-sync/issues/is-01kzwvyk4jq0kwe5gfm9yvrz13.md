---
type: is
id: is-01kzwvyk4jq0kwe5gfm9yvrz13
title: "PR #209 review S4: Delegate row expansion clicks"
kind: task
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:31.601Z
updated_at: 2026-08-13T06:29:35.728Z
closed_at: 2026-08-13T06:29:35.728Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S4. packages/tbd/src/web/client.ts createIssueRow allocates one click closure per rendered row despite the delegated-event design contract. Put the bead ID on each row and use one #rows listener, preserving nested interactive-control behavior.
