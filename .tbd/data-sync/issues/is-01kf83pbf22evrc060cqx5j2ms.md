---
type: is
id: is-01kf83pbf22evrc060cqx5j2ms
title: Improve setup tests with dedicated fixture repos
kind: feature
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T08:31:37.953Z
updated_at: 2026-08-15T05:43:09.147Z
closed_at: 2026-08-15T05:43:09.146Z
close_reason: "Delivered: setup coverage now uses dedicated temporary fixture repositories for fresh, linked-worktree, AGENTS.md, hook, migration, and dry-run scenarios."
---

## Notes

Current setup tests run tryscript in sandboxed temp directories but use relative paths (../dist) that can behave differently depending on working directory. Should create proper fixture repos that simulate real user scenarios: new projects, existing projects with AGENTS.md, projects with .cursor/ directory, etc. This makes tests more reproducible and less dependent on test execution context.
