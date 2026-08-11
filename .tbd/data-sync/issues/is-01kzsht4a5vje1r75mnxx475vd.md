---
type: is
id: is-01kzsht4a5vje1r75mnxx475vd
title: Make local-observation path assertion cross-platform
kind: bug
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - windows
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:16:36.292Z
updated_at: 2026-08-11T23:17:29.110Z
---
Hosted Windows CI on 2ca87b7c exposed that tests/web-board.test.ts hard-codes POSIX strings for BoardState.getObservationPaths(), although production correctly uses node:path.join. Build expected paths with path.join so the constant-size observation-surface contract is asserted on Windows, macOS, and Linux; record as senior-review finding R22 and rerun the exact hosted matrix.

## Notes

Hosted run 31545475376 failed only tests/web-board.test.ts on Windows: production used node:path.join and correctly produced backslashes, while the assertion hard-coded POSIX strings. The expected config/workspace/issues/mappings/ref paths now use join(), and the focused web-board suite passes 9/9 locally. Active spec records this as R22. Full local and hosted reruns remain.
