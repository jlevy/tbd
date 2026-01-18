---
created_at: 2026-01-18T03:14:12.779Z
dependencies:
  - target: is-01kf7hhy9hqk0ht4h4yr31hvzy
    type: blocks
  - target: is-01kf7hgnt5ymykg47yvryr2dj7
    type: blocks
id: is-01kf7hh4ncxp7dmksj0q2j1qkr
kind: task
labels: []
priority: 1
status: in_progress
title: Refactor tbd status to remove issue counts
type: is
updated_at: 2026-01-18T05:38:43.787Z
version: 5
---
Remove issue counts (Ready, In progress, Open, Total) from tbd status output. These will be moved to tbd stats.

Status should focus on setup/configuration only:
- Version info
- Repository path, initialized status, git branch
- Sync branch, remote, ID prefix  
- Integrations status (Claude, Cursor, Codex)
- Worktree status
- Add footer: 'Use tbd stats for issue statistics, tbd doctor for health checks'
