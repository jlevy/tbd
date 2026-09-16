---
type: is
id: is-01m2nh7vfx2j6b8p7hw0zxmf8k
title: Handle remote-only formal stacks in merge and review workflows
kind: bug
status: closed
priority: 1
version: 6
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T16:36:45.179Z
updated_at: 2026-09-16T16:53:58.054Z
started_at: 2026-09-16T16:37:03.455Z
closed_at: 2026-09-16T16:53:58.054Z
close_reason: Implemented with focused setup, routing, transcript, installer, and packed-upgrade coverage.
resolution: null
duplicate_of: null
---
Independent review found merge-upstream and address-pr-review still treated gh stack view exit 2 as proof that a PR is unstacked. Detect formal remote membership with the GitHub stacks API before merge/update actions; adopt or document a safe external-tool path, and add focused coverage.

## Notes

merge-upstream and address-pr-review now distinguish local tracking from authoritative remote membership, adopt remote-only stacks with gh stack checkout before local operations, and fail closed on API/adoption failures. Focused integration coverage passes.
