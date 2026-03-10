---
type: is
id: is-01kfm8etgth19ebhnjscsj7cxn
title: Verify prime command docs consistency
kind: task
status: closed
priority: 2
version: 8
labels:
  - docs-review
dependencies: []
created_at: 2026-01-23T01:45:47.289Z
updated_at: 2026-03-09T16:12:32.175Z
closed_at: 2026-01-23T01:49:36.866Z
close_reason: "Minor issue: --brief option present in CLI but not documented in tbd-docs.md or tbd-design.md. Otherwise consistent."
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the prime command. Ensure all sources are consistent and accurate for:
- Command description and purpose
- All options (--export, --brief)
- Behavior when not in tbd project (silent exit)
- Custom PRIME.md override behavior
- Hook integration (SessionStart, Compaction)
