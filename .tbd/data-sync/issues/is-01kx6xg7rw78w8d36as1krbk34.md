---
type: is
id: is-01kx6xg7rw78w8d36as1krbk34
title: "PR #176 Bugbot: single update masks corrupt reads as NotFoundError"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
created_at: 2026-07-10T21:03:57.200Z
updated_at: 2026-07-10T21:15:16.987Z
closed_at: 2026-07-10T21:15:16.986Z
close_reason: "Fixed in dcc274af on PR #176: single-ID update now rethrows non-ENOENT read errors raw (matching loadAllIssues); corrupt issues report the real parse error instead of 'not found'. Sibling no-fields-validation thread rebutted on the PR (legacy single-verb contract). Validated: lint, 1365 vitest, 982 tryscript; goldens lock the behavior."
---
Bugbot thread discussion_r3561781199 on de2678a5. runSingle's readIssue catch converts every failure to NotFoundError; only ENOENT should map to not-found (with --ignore-missing downgrading it to a reported skip). Corrupt front matter or permission errors must surface raw, matching loadAllIssues semantics used by single close/reopen and bulk update (the S1 contract). Sibling thread discussion_r3561781206 (lone missing update skips no-fields validation) is rebutted: legacy single-ID update accepts a no-field invocation as a metadata touch, so the lone-missing path mirrors its own verb's contract; strict no-fields validation is deliberately bulk-only.
