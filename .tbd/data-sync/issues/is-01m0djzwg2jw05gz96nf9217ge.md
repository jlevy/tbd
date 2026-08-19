---
type: is
id: is-01m0djzwg2jw05gz96nf9217ge
title: "OS-351: blocker bug that interacts with the state/actor axes"
kind: bug
status: closed
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
created_at: 2026-08-19T18:02:02.112Z
updated_at: 2026-08-19T19:17:02.768Z
closed_at: 2026-08-19T19:17:02.763Z
close_reason: Content obtained and fixed — superseded by tbd-k0rd, which is the mirrored bead for OS-351.
resolution: null
duplicate_of: null
---
Reported by Josh 2026-08-19 as a real bug and a blocker that interacts with the state and actor axis work in PR #245, to be fixed in the same PR rather than separately.

BLOCKED ON CONTENT: the issue lives in Linear as OS-351 and is not mirrored into this repository (no bead carries that key). The agent no longer has a LINEAR_API_KEY — the previous key was removed from .env and flagged for rotation after being pasted into a session transcript — so the issue body cannot be read.

To unblock, either:
  - paste the OS-351 description into the session, or
  - provide a rotated LINEAR_API_KEY, after which: tbd integration sync --pull --external OS-351

Do not guess at the defect; it interacts with hold/resolution/delegate semantics and a wrong assumption would be worse than waiting.
