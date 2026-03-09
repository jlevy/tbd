---
close_reason: "Verified: docs consistent. Minor note: CLI help doesn't mark --prefix required but runtime validates it (intentional UX for better error message)"
closed_at: 2026-01-23T01:47:38.336Z
created_at: 2026-01-23T01:45:46.344Z
dependencies: []
id: is-01kfm8esk93phzgz2rxtdws9fb
kind: task
labels:
  - docs-review
priority: 2
status: closed
title: Verify init command docs consistency
type: is
updated_at: 2026-03-09T02:47:23.125Z
version: 7
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the init command. Ensure all three sources are consistent and accurate for:
- Command description and purpose
- All options (--prefix, --sync-branch, --remote)
- Usage examples
- Relationship to setup --auto
