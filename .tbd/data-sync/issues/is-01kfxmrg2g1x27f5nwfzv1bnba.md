---
type: is
id: is-01kfxmrg2g1x27f5nwfzv1bnba
title: Fix .tbd/.gitignore messaging to distinguish created vs updated vs no-op
kind: bug
status: closed
priority: 3
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kfxms7r482jq06yy7hdrpfcn
created_at: 2026-01-26T17:13:57.071Z
updated_at: 2026-03-09T16:12:32.926Z
closed_at: 2026-01-28T04:06:53.905Z
close_reason: "Fixed: setup.ts:1407-1411 now distinguishes created vs updated vs no-op"
---
In setup.ts:1159, we always print 'Created .tbd/.gitignore' but ensureGitignorePatterns returns { added, skipped, created } which tells us exactly what happened. Should show: Created (new file), Updated (patterns added), or nothing (already up to date). Location: packages/tbd/src/cli/commands/setup.ts#L1142-1159
