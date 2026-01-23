---
close_reason: Implemented copyBuiltinDocs() in setup.ts to copy built-in docs from bundled package to .tbd/docs/shortcuts/. Updated copy-docs.mjs to copy shortcuts and install directories during postbuild.
closed_at: 2026-01-23T04:44:04.773Z
created_at: 2026-01-22T03:30:38.368Z
dependencies:
  - target: is-01kfhvzn1vbsam9xckr0njfbqg
    type: blocks
id: is-01kfhw2351x98m0f4xmj6jzc1n
kind: task
labels: []
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
priority: 1
status: closed
title: Update tbd setup to copy built-in docs
type: is
updated_at: 2026-01-23T04:44:04.774Z
version: 6
---
Update tbd setup to: 1) Copy built-in system and standard docs to .tbd/docs/shortcuts/{system,standard}/, 2) Use atomically library for safe file writes, 3) Add version comment (<!-- tbd-version: X.Y.Z -->) for upgrade detection.
