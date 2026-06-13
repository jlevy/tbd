---
type: is
id: is-01ktyez0dpb7y7zmbxwck00car
title: "DocMap: require a location (path and/or source) per entry"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyessevb2mdcafd12z7670n
created_at: 2026-06-12T17:44:33.462Z
updated_at: 2026-06-12T18:20:43.940Z
closed_at: 2026-06-12T18:20:43.940Z
close_reason: "Fixed in a3a5b37: zod refinement requires path and/or source per entry; tests added. Producer fixed in the same commit so tbd output conforms."
---
PR #169 review sec 4. The format definition says every entry has a location but the schema makes both optional. Add a zod refinement requiring at least one of path/source. Must land together with the producer fix (upstream entries currently emit neither).
