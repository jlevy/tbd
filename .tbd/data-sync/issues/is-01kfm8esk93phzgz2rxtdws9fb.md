---
type: is
id: is-01kfm8esk93phzgz2rxtdws9fb
title: Verify init command docs consistency
kind: task
status: closed
priority: 2
version: 8
labels:
  - docs-review
dependencies: []
created_at: 2026-01-23T01:45:46.344Z
updated_at: 2026-03-09T16:12:32.159Z
closed_at: 2026-01-23T01:47:38.336Z
close_reason: "Verified: docs consistent. Minor note: CLI help doesn't mark --prefix required but runtime validates it (intentional UX for better error message)"
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the init command. Ensure all three sources are consistent and accurate for:
- Command description and purpose
- All options (--prefix, --sync-branch, --remote)
- Usage examples
- Relationship to setup --auto
