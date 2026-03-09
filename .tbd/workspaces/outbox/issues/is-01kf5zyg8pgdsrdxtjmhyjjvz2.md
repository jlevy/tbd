---
close_reason: Implemented in Phase 22-24
closed_at: 2026-01-17T09:17:52.363Z
created_at: 2026-01-17T07:22:52.437Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.729Z
    original_id: tbd-1877
id: is-01kf5zyg8pgdsrdxtjmhyjjvz2
kind: task
labels: []
parent_id: null
priority: 1
status: closed
title: Implement tbd setup claude command
type: is
updated_at: 2026-03-09T16:12:30.556Z
version: 6
---
Implement the tbd setup claude command for Claude Code integration.

**Specification (from design doc 6.4.2):**

```bash
tbd setup claude [options]

Options:
  --project       Install to .claude/settings.local.json (project-specific)
  --global        Install to ~/.claude/settings.json (user-wide)
  --check         Verify installation status
  --remove        Remove tbd hooks
```

**JSON Settings Hooks to install:**
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "tbd prime" }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "tbd prime" }]
    }]
  }
}
```

**Shell hooks option:**
Generate .claude/hooks/session-start.sh for cloud environments:
```bash
#!/bin/bash
command -v tbd &>/dev/null || npm install -g tbd-cli --quiet
[ -d ".tbd" ] && tbd prime
```

**Reference files:**
- attic/beads/cmd/bd/setup/claude.go (Beads implementation)
- docs/project/architecture/current/tbd-design-v3.md section 6.4.2
