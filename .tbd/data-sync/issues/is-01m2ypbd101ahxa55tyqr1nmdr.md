---
type: is
id: is-01m2ypbd101ahxa55tyqr1nmdr
title: Settle web test requests before timeout cleanup closes the server
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01kjcb7j040avaqy7d8n2m9gbj
created_at: 2026-09-20T05:59:14.200Z
updated_at: 2026-09-20T06:12:32.245Z
---
PR #316 validation: cli-web.test.ts remote-state/explicit-sync test exceeded 45000ms and emitted an unhandled TypeError terminated / UND_ERR_SOCKET after cleanup closed the server. Inspect request ownership and timeout cleanup; ensure every in-flight promise is awaited or canceled with its rejection handled. Acceptance: forced timeout/cleanup emits no unhandled rejection and normal remote-isolation behavior remains tested.

## Notes

All 7 cli-web cases passed with one worker. Explicit-sync case completed in 8997ms versus its 45000ms deadline; no unhandled rejection in the diagnostic run. Keep this bead for forced-timeout cleanup robustness: the full-suite failure emitted UND_ERR_SOCKET after cleanup.
