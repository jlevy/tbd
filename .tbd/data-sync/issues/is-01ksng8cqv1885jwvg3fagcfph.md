---
type: is
id: is-01ksng8cqv1885jwvg3fagcfph
title: "Spec follow-up: Harden shared common-dir sync lock boundary (PR #121)"
kind: epic
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies: []
child_order_hints:
  - is-01ksng99kvwaf35zwfr61y56gs
  - is-01ksng9a223hhdkb2tw3ew3wd4
  - is-01ksng9agn362xcxea5ddx38kt
  - is-01ksnga2my9rmrq6sre0c57p3j
  - is-01ksnga34m6xqq6msc4yp6asmx
  - is-01ksnga3ka0d1q9pk5ca9s1jy9
created_at: 2026-05-27T19:58:17.851Z
updated_at: 2026-05-27T19:59:14.026Z
---
Post-review hardening for PR #121 (shared common-dir sync worktree). Two senior engineering reviews confirmed the design is correct and most of the implementation is solid (lock timing invariant restored, duplicate error classes removed, stale-fallback cache fixed, path constants renamed, uninstall debug context preserved). This epic tracks the remaining lock-boundary gaps the second review held the PR for, plus cleanups surfaced by merging the post-#121 main (which dropped Changesets for tag-triggered releases). See the 'Post-Review Hardening (PR #121 Follow-up)' section of the spec (items H1-H6). All line references are against the merged branch head codex/implement-shared-common-dir-sync-worktree.
