---
type: is
id: is-01m2nh7vfx2j6b8p7hw0zxmf8k
title: Handle remote-only formal stacks in merge and review workflows
kind: bug
status: in_progress
priority: 1
version: 3
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T16:36:45.179Z
updated_at: 2026-09-16T16:42:09.445Z
started_at: 2026-09-16T16:37:03.455Z
---
Independent review found merge-upstream and address-pr-review still treated gh stack view exit 2 as proof that a PR is unstacked. Detect formal remote membership with the GitHub stacks API before merge/update actions; adopt or document a safe external-tool path, and add focused coverage.

## Notes

Updated merge-upstream and address-pr-review to query formal GitHub stack membership through repos//stacks?pull_request= before any merge-upstream path. Remote-only formal stacks must be adopted with gh stack checkout before sync/rebase; API, extension, or adoption failures stop the workflow. Pinned Markdown formatting and diff checks pass. Focused static coverage remains for the parent task.
