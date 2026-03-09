---
close_reason: Doctor now shows STATUS + STATISTICS + HEALTH CHECKS as comprehensive superset
closed_at: 2026-01-18T05:44:03.619Z
created_at: 2026-01-18T03:14:39.024Z
dependencies:
  - target: is-01kf7hgnt5ymykg47yvryr2dj7
    type: blocks
id: is-01kf7hhy9hqk0ht4h4yr31hvzy
kind: task
labels: []
priority: 1
status: closed
title: Refactor tbd doctor to include status and stats output
type: is
updated_at: 2026-03-09T02:47:22.460Z
version: 10
---
Make tbd doctor a comprehensive health check that includes:

1. Run tbd status output (setup/configuration section)
2. Run tbd stats output (issue statistics section)
3. Run additional health checks:
   - Git version
   - Config file validity
   - Issues directory
   - Dependency integrity (orphaned references)
   - Unique ID validation
   - Temp file cleanup
   - Issue validity (required fields, ID format, priority range)
   - Claude Code skill file
   - Cursor rules file
   - Codex AGENTS.md

4. Provide suggestions for any issues found

The output should be organized with clear section headers:
- STATUS
- STATISTICS  
- HEALTH CHECKS
- SUGGESTIONS (if any)
