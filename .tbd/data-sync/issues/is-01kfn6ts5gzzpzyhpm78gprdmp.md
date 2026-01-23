---
close_reason: "Fixed: replaced all process.exit(1) calls with throw new CLIError()"
closed_at: 2026-01-23T10:40:11.201Z
created_at: 2026-01-23T10:36:36.399Z
dependencies: []
id: is-01kfn6ts5gzzpzyhpm78gprdmp
kind: bug
labels: []
priority: 2
status: closed
title: "setup.ts: uses process.exit instead of CLIError"
type: is
updated_at: 2026-01-23T10:40:11.202Z
version: 2
---
Error handling bypasses BaseCommand framework by using process.exit(1) directly.
