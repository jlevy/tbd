---
type: is
id: is-01kfm8ett70fzcbqka4paxmc9d
title: Verify status command docs consistency
kind: task
status: closed
priority: 2
version: 8
labels:
  - docs-review
dependencies: []
created_at: 2026-01-23T01:45:47.590Z
updated_at: 2026-03-09T16:12:32.181Z
closed_at: 2026-01-23T01:50:05.555Z
close_reason: "INCONSISTENCIES in 'not initialized' suggestions: 1) tbd-docs says 'tbd setup --auto' (broken flag) and 'tbd init --prefix=X'. 2) tbd-design says 'tbd import --from-beads' (deprecated). 3) Actual CLI just shows 'tbd init'. All three disagree."
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the status command. Ensure all sources are consistent and accurate for:
- Command description and purpose
- Output format (initialized vs uninitialized)
- Beads detection and migration suggestions
- JSON output format
