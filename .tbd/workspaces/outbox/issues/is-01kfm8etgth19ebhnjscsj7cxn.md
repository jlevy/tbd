---
close_reason: "Minor issue: --brief option present in CLI but not documented in tbd-docs.md or tbd-design.md. Otherwise consistent."
closed_at: 2026-01-23T01:49:36.866Z
created_at: 2026-01-23T01:45:47.289Z
dependencies: []
id: is-01kfm8etgth19ebhnjscsj7cxn
kind: task
labels:
  - docs-review
priority: 2
status: closed
title: Verify prime command docs consistency
type: is
updated_at: 2026-03-09T02:47:23.140Z
version: 7
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the prime command. Ensure all sources are consistent and accurate for:
- Command description and purpose
- All options (--export, --brief)
- Behavior when not in tbd project (silent exit)
- Custom PRIME.md override behavior
- Hook integration (SessionStart, Compaction)
