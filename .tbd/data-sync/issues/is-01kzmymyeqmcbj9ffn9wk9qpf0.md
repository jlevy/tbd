---
type: is
id: is-01kzmymyeqmcbj9ffn9wk9qpf0
title: tbd list --pretty renders grandchildren at the wrong depth
kind: bug
status: closed
priority: 2
version: 5
labels:
  - tree-view
dependencies: []
created_at: 2026-08-10T04:24:45.763Z
updated_at: 2026-08-11T04:42:44.433Z
closed_at: 2026-08-11T04:42:44.432Z
close_reason: Fixed in e5c9360d with regression tests; full suite (103 files / 1458 tests) green through the pre-push gate
---
renderTreeNode() in packages/tbd/src/cli/lib/tree-view.ts pushes the child connector without the ancestor prefix:

  lines.push(colors.dim(connector) + lineWithoutPrefix);   // line 230

lineWithoutPrefix strips the full childPrefix (which already contains the parent's prefix), so only 'connector + issueLine' is emitted. At depth 1 the parent prefix is empty and it looks right; at depth 2 and deeper the indentation is lost entirely and grandchildren render as siblings of their own parent.

Reproduce in this repo:

  tbd list --pretty --limit 40

tbd-4wn0 and its siblings are children of tbd-70dj, which is itself a child of tbd-up8l. They render at the same depth as tbd-70dj. The stray mid-list └── on tbd-ns1b is the same defect: it is the last child of tbd-70dj, drawn as if it were a child of tbd-up8l.

Fix: emit prefix + connector + lineWithoutPrefix. Continuation lines (lineIndex > 0) are already correct because they retain childPrefix.

Worth a golden test at depth 3; existing coverage appears to stop at depth 2 where the bug is invisible.

## Notes

Fixed on claude/tbd-web-spike: renderTreeNode re-applies the ancestor prefix; depth-3 goldens in tests/tree-view.test.ts; verified live (tbd-70dj subtree renders at true depth). Awaiting full-suite gate (deferred: disk guardrail) before close.
