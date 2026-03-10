---
type: is
id: is-01kf766hr946ya80ncb2af9nfj
title: "Bug: Import changes ID prefix"
kind: bug
status: closed
priority: 2
version: 7
labels: []
dependencies: []
created_at: 2026-01-17T23:56:11.400Z
updated_at: 2026-03-09T16:12:31.225Z
closed_at: 2026-01-18T03:56:40.890Z
close_reason: Fixed by auto-detecting prefix from imported issues and updating config
---
When importing from Beads, ID prefix changes based on local config.
Original tbd-100 becomes bd-100. Fix: auto-detect prefix or add --preserve-prefix flag.
