---
type: is
id: is-01kf7nbezdmr4qwytemnz1mf20
title: "Audit: Diagnostic commands should show specific paths and details"
kind: task
status: closed
priority: 1
version: 7
labels: []
dependencies: []
created_at: 2026-01-18T04:21:01.035Z
updated_at: 2026-03-09T16:12:31.647Z
closed_at: 2026-01-18T05:32:57.198Z
close_reason: "All child issues completed: diagnostic utilities implemented, doctor/setup/status commands updated to show specific paths and details"
---
All diagnostic commands (doctor, setup --check, status) should consistently show specific file paths and detailed information when reporting issues.

**Current behavior:**
- doctor: Some checks show paths, but orphan/duplicate/validity checks only show counts
- setup --check: Most don't show the paths being checked
- status: Integration section doesn't show paths

**Expected behavior:**
- All checks should show the path being verified
- When issues are found, list specific items (which orphans, which duplicates, etc.)
- Consistent output format across all diagnostic commands

**Child issues:**
- Doctor: Show details for orphaned dependencies, duplicate IDs, invalid issues
- Setup claude --check: Show settings path and skill path
- Setup codex --check: Show full AGENTS.md path
- Setup cursor --check: Show expected rules file path
- Status: Show integration file paths

**Code reuse:**
- Create shared diagnostic output utilities in lib/output.ts or lib/diagnostics.ts
- Use consistent CheckResult-style interface across all commands
