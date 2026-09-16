---
type: is
id: is-01m2nh7vfx2j6b8p7hw0zxmf8k
title: Handle remote-only formal stacks in merge and review workflows
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T16:36:45.179Z
updated_at: 2026-09-16T16:37:03.457Z
started_at: 2026-09-16T16:37:03.455Z
---
Independent review found merge-upstream and address-pr-review still treated gh stack view exit 2 as proof that a PR is unstacked. Detect formal remote membership with the GitHub stacks API before merge/update actions; adopt or document a safe external-tool path, and add focused coverage.
