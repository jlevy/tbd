---
type: is
id: is-01m26a8w044kdzmya9setmfhtg
title: Preserve agent_map through provider settings resolution
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels:
  - documentation
  - release-stability
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T18:46:21.955Z
updated_at: 2026-09-10T20:20:02.683Z
started_at: 2026-09-10T18:46:36.682Z
closed_at: 2026-09-10T20:20:02.683Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Fix resolveProviderSettings so grouped and legacy agent_map values reach integration runtime, with grouped-first precedence and focused regression coverage.
