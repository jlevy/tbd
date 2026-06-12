---
type: is
id: is-01ktyew1pyeqxm1ydnwd2jnfzs
title: "Forked shortcuts not served: lookup_path overrides fork-dir precedence"
kind: bug
status: closed
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:42:56.478Z
updated_at: 2026-06-12T18:20:20.325Z
closed_at: 2026-06-12T18:20:20.325Z
close_reason: "Fixed in 4301220: fork dir prepended structurally in shortcut.ts past persisted lookup_path; new fork-a-shortcut serve golden block. Verified end-to-end on e8b5112: customized forked shortcut is served."
---
[Phase 1] PR #169. doc-sync.ts:561-566 persists docs_cache.lookup_path into every repo config; shortcut.ts:78 lets it replace DEFAULT_SHORTCUT_PATHS, so the fork dir is never prepended for shortcuts. Verified end-to-end: forked+edited review-code shows [forked, customized] in docs list but tbd shortcut serves the upstream copy. Violates G2 and tbd-design 2.9 invariant 1. Fix: prepend FORK_SHORTCUTS_DIR structurally regardless of config; add a fork-a-shortcut serve assertion to cli-docs-fork.tryscript.md.
