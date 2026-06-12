---
type: is
id: is-01ktycs2swb8107h074323hwew
title: "Review/S1: no lock on forks.yml read-modify-write — concurrent fork/update loses entries"
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:22.139Z
updated_at: 2026-06-12T17:45:34.847Z
closed_at: 2026-06-12T17:45:34.846Z
close_reason: "Fixed in 6b4d266: forks.yml read-modify-write serialized under withForkManifestLock (shared lock) across fork/unfork/update."
---
