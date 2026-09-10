---
type: is
id: is-01m26cmj84b3r2neyg0epwdz1a
title: Resolve fresh meta scaffold and MetaSchema mismatch
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:27:42.337Z
updated_at: 2026-09-10T19:27:42.337Z
---
Fresh sync scaffolding writes meta.yml with schema_version only while MetaSchema requires created_at. Decide and enforce one canonical shape across init, parsing, doctor, and documentation.
