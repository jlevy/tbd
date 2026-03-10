---
type: is
id: is-01kfm8et695tcp6xvvf39dn18j
title: Verify import command docs consistency
kind: task
status: closed
priority: 2
version: 8
labels:
  - docs-review
dependencies: []
created_at: 2026-01-23T01:45:46.953Z
updated_at: 2026-03-09T16:12:32.170Z
closed_at: 2026-01-23T01:49:18.971Z
close_reason: "INCONSISTENCIES: 1) --from-beads called deprecated in tbd-docs but still works. 2) --beads-dir undocumented. 3) Design doc has --format and --branch that don't exist. 4) --merge and --validate not in design doc. Needs alignment."
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the import command. Ensure all sources are consistent and accurate for:
- Command description and purpose
- All options (--from-beads, --beads-dir, --merge, --verbose, --validate)
- Deprecation note for --from-beads vs setup --auto
- Usage examples and migration workflow
