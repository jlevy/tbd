---
type: is
id: is-01kfv2hwyh8g0namvvastjprj9
title: Create ensureGitignorePatterns() edit function
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfv2jp1rd4b9sgfpgvqt9pw1
  - type: blocks
    target: is-01kfv2jy2gj2nnbct7vt46rqjt
  - type: blocks
    target: is-01kfv2m19gxrg8vbjps5m7t1cj
parent_id: is-01kfv2he1c3hct3c07gv0edh90
created_at: 2026-01-25T17:17:17.648Z
updated_at: 2026-03-09T16:12:32.834Z
closed_at: 2026-01-25T17:26:47.985Z
close_reason: null
---
Implement the idempotent edit function that ensures patterns exist in a .gitignore file.

Behavior:
- Creates file if missing
- Appends only missing patterns (uses hasGitignorePattern for detection)
- Always uses atomic write via atomically.writeFile()
- Preserves existing user patterns
- Optional header comment for new patterns section

Returns: { added: string[], skipped: string[], created: boolean }

File: packages/tbd/src/utils/gitignore-utils.ts
