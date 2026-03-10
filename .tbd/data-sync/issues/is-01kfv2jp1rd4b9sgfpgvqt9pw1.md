---
type: is
id: is-01kfv2jp1rd4b9sgfpgvqt9pw1
title: Refactor init.ts to use ensureGitignorePatterns()
kind: task
status: closed
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kfv2k7bhtsw5de4b2fgxgfaa
parent_id: is-01kfv2he1c3hct3c07gv0edh90
created_at: 2026-01-25T17:17:43.351Z
updated_at: 2026-03-09T16:12:32.846Z
closed_at: 2026-01-25T17:27:36.150Z
close_reason: null
---
Replace duplicated gitignore creation code in init.ts with the new ensureGitignorePatterns() utility.

Location: packages/tbd/src/cli/commands/init.ts lines 70-89

Replace writeFile() with ensureGitignorePatterns() call.
