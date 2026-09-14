---
type: is
id: is-01m2gcahk5rjcrzsjd8r2t4wwg
title: Import counts a bead as imported before writing it and swallows write failures
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-14T16:34:38.309Z
updated_at: 2026-09-14T16:34:38.309Z
---
Found by the senior review of PR #287, out of scope there. cli/commands/import.ts:630-639: imported++ runs before writeIssue, and a write failure is caught and only surfaced under --verbose. So 'Import complete / New issues: N' and exit 0 can follow writes that never landed, and the count overstates what is on disk. Same silent-failure class as the P0 import bug PR #287 fixed (tbd-0oz8), adjacent to the changed lines. Fix: count after a successful write, and fail loudly (non-zero exit) on a write error rather than gating the report on --verbose.
