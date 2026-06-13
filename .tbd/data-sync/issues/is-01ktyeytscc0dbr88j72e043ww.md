---
type: is
id: is-01ktyeytscc0dbr88j72e043ww
title: Windows drive-letter paths parse as local, not unknown scheme
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesqrj67qgwjvcg8mggkcg
created_at: 2026-06-12T17:44:27.691Z
updated_at: 2026-06-12T18:20:40.362Z
closed_at: 2026-06-12T18:20:40.362Z
close_reason: "Fixed in 6b6949e: drive-letter paths parse as local absolute paths instead of unknown-scheme rejection; round-trip tested."
---
PR #169 review sec 4. C:/Users/x/file.md hits the unknown-scheme rejection (docref.ts:172) because C: matches the scheme regex. Special-case [A-Za-z]:[\\/] as a local absolute path.
