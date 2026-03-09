---
close_reason: Implemented documentation improvements
closed_at: 2026-01-17T10:56:04.137Z
created_at: 2026-01-17T10:41:31.472Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.967Z
    original_id: tbd-1913
id: is-01kf5zyg8pxx1y1fkhhr8tv9q5
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Add "For AI Agents" section
type: is
updated_at: 2026-03-09T16:12:30.685Z
version: 6
---
Add dedicated section for AI agent usage:

## For AI Agents

### Agent Workflow Loop
tbd ready --json              # Find available work
tbd update <id> --status in_progress  # Claim (advisory)
# ... work ...
tbd close <id> --reason "Done"  # Complete
tbd sync                      # Sync

### Agent-Friendly Flags
--json              JSON output for parsing
--non-interactive   Fail if input required (auto in CI)
--yes               Auto-confirm prompts
--dry-run           Preview changes
--quiet             Machine-readable output only

### Actor Resolution Order
1. --actor <name> flag
2. TBD_ACTOR environment variable
3. Git user.email
4. System username

### Claude Code Integration
tbd setup claude --global    # Install session hooks
tbd prime                    # Output workflow context
