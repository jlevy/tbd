---
type: is
id: is-01m2690rvb4tg7z9c02z7ev0gx
title: Repair pre-existing broken links in current documentation
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-09-10T18:24:28.009Z
updated_at: 2026-09-10T18:24:28.009Z
---
A full repository Markdown-link audit performed while reconciling PR #283 found broken relative links outside the changed coordination-doc set. Current affected surfaces include docs/general/research/current (golden testing, coverage, Convex, Bun/TypeScript CLI research), docs/project/architecture/current/arch-testing.md, several docs/project/research/current files, active specs for external docs/config upgrade/agent ergonomics, and packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md. Archived-doc and placeholder-template links should be triaged separately rather than blindly rewritten. The 35 documents changed by PR #283 pass the same local target-and-anchor checker.
