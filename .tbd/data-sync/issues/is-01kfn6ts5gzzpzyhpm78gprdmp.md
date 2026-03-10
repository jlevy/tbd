---
type: is
id: is-01kfn6ts5gzzpzyhpm78gprdmp
title: "setup.ts: uses process.exit instead of CLIError"
kind: bug
status: closed
priority: 2
version: 7
labels: []
dependencies: []
created_at: 2026-01-23T10:36:36.399Z
updated_at: 2026-03-09T16:12:32.542Z
closed_at: 2026-01-23T10:40:11.201Z
close_reason: "Fixed: replaced all process.exit(1) calls with throw new CLIError()"
---
Error handling bypasses BaseCommand framework by using process.exit(1) directly.
