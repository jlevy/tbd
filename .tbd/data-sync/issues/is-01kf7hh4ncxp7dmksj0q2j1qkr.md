---
type: is
id: is-01kf7hh4ncxp7dmksj0q2j1qkr
title: Refactor tbd status to remove issue counts
kind: task
status: closed
priority: 1
version: 11
labels: []
dependencies:
  - type: blocks
    target: is-01kf7hhy9hqk0ht4h4yr31hvzy
  - type: blocks
    target: is-01kf7hgnt5ymykg47yvryr2dj7
created_at: 2026-01-18T03:14:12.779Z
updated_at: 2026-03-09T16:12:31.407Z
closed_at: 2026-01-18T05:44:02.678Z
close_reason: Issue counts removed from status command, moved to stats
---
Remove issue counts (Ready, In progress, Open, Total) from tbd status output. These will be moved to tbd stats.

Status should focus on setup/configuration only:
- Version info
- Repository path, initialized status, git branch
- Sync branch, remote, ID prefix  
- Integrations status (Claude, Cursor, Codex)
- Worktree status
- Add footer: 'Use tbd stats for issue statistics, tbd doctor for health checks'
