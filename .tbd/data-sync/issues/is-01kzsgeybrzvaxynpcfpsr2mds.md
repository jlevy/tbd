---
type: is
id: is-01kzsgeybrzvaxynpcfpsr2mds
title: Keep canonical board state over duplicate same-version SSE
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - review
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T22:53:01.175Z
updated_at: 2026-08-11T22:54:00.782Z
closed_at: 2026-08-11T22:54:00.781Z
close_reason: Canonical board state now dominates duplicate same-version SSE frames; exact ordering regression, focused web suite, and typecheck pass.
---
A board response intentionally replaces a bounded SSE state at the same observer stateVersion with complete canonical moved/removed IDs. A delayed duplicate SSE frame at that same version can currently overwrite the canonical state without scheduling another fetch. Reject same-version SSE duplicates while preserving same-version board recovery, and cover the ordering regression.

## Notes

Implemented in src/web/core.ts: Store.receiveState rejects an SSE duplicate when observerId, stateVersion, and dataVersion are already adopted, while its separate board-response path still accepts a same-version canonical state. tests/web-core.test.ts proves a delayed bounded duplicate cannot replace complete canonical moved IDs. Focused web suite: 5 files / 41 tests green; package typecheck green.
