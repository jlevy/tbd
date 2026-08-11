---
type: is
id: is-01kzsht4a5vje1r75mnxx475vd
title: Make local-observation path assertion cross-platform
kind: bug
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - windows
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:16:36.292Z
updated_at: 2026-08-11T23:40:53.796Z
---
Hosted Windows CI on 2ca87b7c exposed that tests/web-board.test.ts hard-codes POSIX strings for BoardState.getObservationPaths(), although production correctly uses node:path.join. Build expected paths with path.join so the constant-size observation-surface contract is asserted on Windows, macOS, and Linux; record as senior-review finding R22 and rerun the exact hosted matrix.

## Notes

Hosted run 31545475376 failed only tests/web-board.test.ts on Windows: production used node:path.join and correctly produced backslashes, while the assertion hard-coded POSIX strings. Commit de4f1218 builds expected paths with join(). Focused web-board suite passed 9/9 locally; full pnpm run ci passed 109 files / 1,507 tests; replacement hosted run 31546459019 passed Ubuntu, macOS, Windows, Coverage & Lint, Benchmark, and DeepSource. Final exact-head audit remains before closure.
