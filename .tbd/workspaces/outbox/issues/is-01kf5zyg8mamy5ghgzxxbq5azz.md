---
close_reason: Removed extra blank line from serializer output in parser.ts
closed_at: 2026-01-16T19:09:28.522Z
created_at: 2026-01-16T07:07:27.408Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.214Z
    original_id: tbd-1812
id: is-01kf5zyg8mamy5ghgzxxbq5azz
kind: bug
labels: []
parent_id: null
priority: 3
status: closed
title: "Bug: extra newline after YAML frontmatter closing ---"
type: is
updated_at: 2026-03-09T02:47:21.035Z
version: 5
---
Issue files have an extra blank line between the YAML frontmatter closing '---' and the markdown body content. The body should start immediately after the closing ---. See serialization code in file/storage.ts.
