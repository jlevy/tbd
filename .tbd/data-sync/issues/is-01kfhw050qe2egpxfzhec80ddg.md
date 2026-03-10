---
type: is
id: is-01kfhw050qe2egpxfzhec80ddg
title: Implement DocCache get() and list() methods
kind: task
status: closed
priority: 1
version: 12
labels: []
dependencies:
  - type: blocks
    target: is-01kfhw0ahez8ke820ykd7ste85
  - type: blocks
    target: is-01kfhw0ffz5dt50b37cffpqrbg
  - type: blocks
    target: is-01kfhw0wgptnbr3vkg9qrcjg0c
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:29:34.742Z
updated_at: 2026-03-09T16:12:32.018Z
closed_at: 2026-01-23T02:43:26.624Z
close_reason: "Implemented: DocCache has get() for exact matching and list() for listing all docs, including shadow support"
---
Implement DocCache methods: load() using existing parseFrontmatter() from parser.ts, get(name) for exact filename matching (with/without .md), list(includeAll) returning active or all docs including shadowed, and isShadowed() helper. Track seenNames for shadowing detection.
