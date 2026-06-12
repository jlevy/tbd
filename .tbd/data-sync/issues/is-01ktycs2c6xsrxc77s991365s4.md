---
type: is
id: is-01ktycs2c6xsrxc77s991365s4
title: "Review/S2+S8: manifest name/kind/path not validated — unfork --force path traversal; unknown kind crashes status"
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:21.701Z
updated_at: 2026-06-12T17:45:34.485Z
closed_at: 2026-06-12T17:45:34.485Z
close_reason: "Fixed in 6b4d266: isSafeDocName rejects path-traversal/unsafe names; readForkManifest parses per-entry and drops unsafe/malformed entries with a warning instead of aborting. Tests in fork-manifest.test.ts."
---
