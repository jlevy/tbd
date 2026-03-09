---
close_reason: "INCONSISTENCIES in 'not initialized' suggestions: 1) tbd-docs says 'tbd setup --auto' (broken flag) and 'tbd init --prefix=X'. 2) tbd-design says 'tbd import --from-beads' (deprecated). 3) Actual CLI just shows 'tbd init'. All three disagree."
closed_at: 2026-01-23T01:50:05.555Z
created_at: 2026-01-23T01:45:47.590Z
dependencies: []
id: is-01kfm8ett70fzcbqka4paxmc9d
kind: task
labels:
  - docs-review
priority: 2
status: closed
title: Verify status command docs consistency
type: is
updated_at: 2026-03-09T16:12:32.181Z
version: 8
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the status command. Ensure all sources are consistent and accurate for:
- Command description and purpose
- Output format (initialized vs uninitialized)
- Beads detection and migration suggestions
- JSON output format
