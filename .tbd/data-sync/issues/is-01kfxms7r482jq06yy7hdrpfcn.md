---
type: is
id: is-01kfxms7r482jq06yy7hdrpfcn
title: Fix .claude/.gitignore messaging - same issue as .tbd/.gitignore
kind: bug
status: closed
priority: 3
version: 7
labels: []
dependencies: []
created_at: 2026-01-26T17:14:21.316Z
updated_at: 2026-03-09T16:12:32.932Z
closed_at: 2026-01-28T04:06:54.025Z
close_reason: "Fixed: setup.ts:830-835 already distinguishes created vs updated vs no-op"
---
At setup.ts:678-680, we call ensureGitignorePatterns for .claude/.gitignore but don't use the return value for messaging. Should show appropriate message based on created/updated/no-op. Related to tbd-mhob.
