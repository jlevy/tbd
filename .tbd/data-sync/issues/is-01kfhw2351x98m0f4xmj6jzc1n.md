---
type: is
id: is-01kfhw2351x98m0f4xmj6jzc1n
title: Update tbd setup to copy built-in docs
kind: task
status: closed
priority: 1
version: 11
labels: []
dependencies:
  - type: blocks
    target: is-01kfhvzn1vbsam9xckr0njfbqg
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
created_at: 2026-01-22T03:30:38.368Z
updated_at: 2026-03-09T16:12:32.097Z
closed_at: 2026-01-23T04:44:04.773Z
close_reason: Implemented copyBuiltinDocs() in setup.ts to copy built-in docs from bundled package to .tbd/docs/shortcuts/. Updated copy-docs.mjs to copy shortcuts and install directories during postbuild.
---
Update tbd setup to: 1) Copy built-in system and standard docs to .tbd/docs/shortcuts/{system,standard}/, 2) Use atomically library for safe file writes, 3) Add version comment (<!-- tbd-version: X.Y.Z -->) for upgrade detection.
