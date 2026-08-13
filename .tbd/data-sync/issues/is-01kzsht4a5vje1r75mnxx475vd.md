---
type: is
id: is-01kzsht4a5vje1r75mnxx475vd
title: Make local-observation path assertion cross-platform
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - windows
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:16:36.292Z
updated_at: 2026-08-12T00:09:10.345Z
closed_at: 2026-08-12T00:09:10.344Z
close_reason: Fixed in de4f1218; final hosted matrix 31548603423 green.
---
Hosted Windows CI on 2ca87b7c exposed that tests/web-board.test.ts hard-codes POSIX strings for BoardState.getObservationPaths(), although production correctly uses node:path.join. Build expected paths with path.join so the constant-size observation-surface contract is asserted on Windows, macOS, and Linux; record as senior-review finding R22 and rerun the exact hosted matrix.

## Notes

R22 complete in de4f1218: platform-native path.join expectations preserve the constant-size observation-path contract on Windows, macOS, and Linux. Focused test 9/9, local full gate 109 files / 1,507 tests, replacement hosted run 31546459019 green, and final exact-head run 31548603423 green on all platforms.
