---
type: is
id: is-01kf5zyg8mamy5ghgzxxbq5azz
title: "Bug: extra newline after YAML frontmatter closing ---"
kind: bug
status: closed
priority: 3
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:07:27.408Z
updated_at: 2026-03-09T16:12:29.866Z
closed_at: 2026-01-16T19:09:28.522Z
close_reason: Removed extra blank line from serializer output in parser.ts
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.214Z
    original_id: tbd-1812
---
Issue files have an extra blank line between the YAML frontmatter closing '---' and the markdown body content. The body should start immediately after the closing ---. See serialization code in file/storage.ts.
