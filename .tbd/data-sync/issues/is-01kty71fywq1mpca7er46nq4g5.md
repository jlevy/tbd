---
type: is
id: is-01kty71fywq1mpca7er46nq4g5
title: "UX: agent-friendly bead annotations: update --reason (parity with close) and a comment/notes alias"
kind: feature
status: open
priority: 3
version: 3
labels:
  - pause
dependencies: []
created_at: 2026-06-12T15:26:06.300Z
updated_at: 2026-08-15T05:43:43.096Z
---
Two invented-but-plausible commands fail with unknown option/command: 'tbd update <id> --status=closed --reason=...' and 'tbd comment <id> ...'. Both failed silently in an agent session where stderr was suppressed, causing bead-status drift. Consider: accept --reason on update when closing; alias 'tbd comment' to appending --notes; and/or suggest the correct command in the error.
