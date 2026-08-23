---
type: is
id: is-01m0ramaxx9y2k2b9p00qqkk3r
title: Keep generated skill mirrors out of the Markdown formatter hook
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wtrfbn7ryrw82f9r91pw
created_at: 2026-08-23T22:07:33.820Z
updated_at: 2026-08-23T22:48:43.848Z
closed_at: 2026-08-23T22:48:43.848Z
close_reason: "Fixed, fully validated, and pushed in stacked PR #260 through commit 8ae47120; Linux, macOS, Windows, coverage/lint, benchmark, and security checks are green."
resolution: null
duplicate_of: null
---
lefthook.yml supplies one regex-like alternation to exclude, but Lefthook 2 treats exclude entries as glob patterns. The pre-commit hook therefore reformats generated .agents/.claude skills and leaves them stale. Replace it with actual path globs and add a live contract test against the installed Lefthook matcher.
