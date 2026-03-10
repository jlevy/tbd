---
type: is
id: is-01kf766nmdv81zt9ga123dv4ba
title: "Bug: Errors not JSON with --json flag"
kind: bug
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-17T23:56:15.372Z
updated_at: 2026-03-09T16:12:31.231Z
closed_at: 2026-01-18T04:08:41.240Z
close_reason: "Fixed: Top-level error handler now checks for --json flag and outputs errors as JSON when specified"
---
When --json flag is used, errors still output as plain text instead of JSON, making parsing unreliable for agents.
