---
type: is
id: is-01kfhvzztx2sjcps7mymgykvsc
title: Create DocCache class with load() method
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfhw050qe2egpxfzhec80ddg
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:29:29.436Z
updated_at: 2026-03-09T16:12:32.012Z
closed_at: 2026-01-23T02:43:26.377Z
close_reason: "Implemented: doc-cache.ts contains DocCache class with load() method that loads .md files from configured paths"
---
Create packages/tbd/src/file/doc-cache.ts (in file/ not lib/ because it uses fs/promises). Define DocCache class, scoring constants (SCORE_EXACT_MATCH=1.0, SCORE_PREFIX_MATCH=0.9, SCORE_CONTAINS_ALL=0.8, SCORE_PARTIAL_BASE=0.7, SCORE_MIN_THRESHOLD=0.5) with docstrings, DocFrontmatter interface, and CachedDoc/DocMatch interfaces.
