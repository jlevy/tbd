---
type: is
id: is-01kfhw1dfjzj3jhw9nwkwyf03w
title: Extend ConfigSchema with docs.paths field
kind: task
status: closed
priority: 1
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfhw1hx7z3whwe5tp210ed2r
  - type: blocks
    target: is-01kfhw2rn1rmt2wqsbbv1axx2v
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:16.178Z
updated_at: 2026-03-09T16:12:32.068Z
closed_at: 2026-01-23T02:43:57.498Z
close_reason: "Implemented: schemas.ts has docs.paths field with z.array(z.string()).default() for shortcut paths configuration"
---
Add docs.paths field to ConfigSchema in schemas.ts. Default to ['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard']. Support relative paths (from tbd root), absolute paths, and ~/home-relative paths.
