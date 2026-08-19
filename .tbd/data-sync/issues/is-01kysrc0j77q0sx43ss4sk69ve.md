---
type: is
id: is-01kysrc0j77q0sx43ss4sk69ve
title: "Repo-wide doc-guidelines sweep: pre-existing spaced em dashes in docs, comments, and CLI strings"
kind: chore
status: open
priority: 3
version: 2
labels:
  - pause
dependencies: []
created_at: 2026-07-30T14:55:31.911Z
updated_at: 2026-08-15T05:43:43.145Z
---
Follow-up to the PR #198 sweep, which fixed only lines added on that branch. Pre-existing violations of the common-doc-guidelines em-dash rule remain across the repo: prose in tbd-docs.md and tbd-design.md (for example the bulk-operations section and path-layout notes), older CHANGELOG entries, tryscript prose and test headers (cli-body-input, cli-docs-fork, cli-spec-inherit, cli-sync-fail-loud-155, cli-sync-missing-worktree-135), code comments in close.ts, reopen.ts, update.ts, bulk.ts (dry-run and read-classification notes), and user-facing CLI strings such as the bulk summary hint in bulk.ts (Unsynced changes, run tbd sync to publish). CLI string changes are golden-pinned, so goldens must be updated in the same commit. Comments must drop em dashes entirely per general-comment-rules.
