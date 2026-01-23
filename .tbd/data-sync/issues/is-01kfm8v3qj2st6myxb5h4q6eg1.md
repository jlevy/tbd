---
created_at: 2026-01-23T01:52:29.937Z
dependencies: []
id: is-01kfm8v3qj2st6myxb5h4q6eg1
kind: task
labels:
  - cli
  - docs
priority: 2
status: open
title: Remove deprecated import --from-beads option
type: is
updated_at: 2026-01-23T01:52:29.937Z
version: 1
---
## Task

Remove the deprecated `--from-beads` option from the import command.

### Current state:
- tbd-docs.md says `--from-beads` is deprecated
- CLI still shows and accepts `--from-beads`
- Also has undocumented `--beads-dir` option

### Action:
1. Remove `--from-beads` and `--beads-dir` options from import command
2. Update tbd-docs.md to remove deprecation note (since option will be gone)
3. Update tbd-design.md §5.1 to reflect simplified import (JSONL only)
4. Users should use `tbd setup --auto` (once fixed) for Beads migration
