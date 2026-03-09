---
close_reason: Completed in cf08856 - enforce atomic writes and consolidate command context (#16)
closed_at: 2026-01-19T08:21:01.205Z
created_at: 2026-01-18T03:19:02.488Z
dependencies:
  - target: is-01kf7htgqhy36w25mnk7c6qwqs
    type: blocks
id: is-01kf7hszjstaa0cn5jsnzskr75
kind: task
labels: []
priority: 2
status: closed
title: Audit all write file operations for atomic writes
type: is
updated_at: 2026-03-09T16:12:31.443Z
version: 9
---
Audit all file write operations to ensure we're using the 'atomically' library consistently.

We already use atomically in most places, but need a comprehensive audit:
- Search for fs.writeFile, fs.writeFileSync, fs/promises writeFile
- Ensure all are replaced with 'atomically' writeFile
- Check for any edge cases where atomic writes might not be appropriate

Files to check:
- All command handlers in src/cli/commands/
- File operations in src/file/
- Any scripts in scripts/

This ensures data integrity if the process is interrupted during writes.
