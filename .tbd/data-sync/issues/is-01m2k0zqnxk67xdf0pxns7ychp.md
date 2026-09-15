---
type: is
id: is-01m2k0zqnxk67xdf0pxns7ychp
title: "PR #288 R3: make attic archive failures exit nonzero"
kind: bug
status: closed
priority: 2
version: 3
labels: []
dependencies: []
parent_id: is-01m2k0zjx9mdxzfq5redfbzzyy
created_at: 2026-09-15T17:14:13.051Z
updated_at: 2026-09-15T18:35:49.089Z
closed_at: 2026-09-15T18:35:49.086Z
close_reason: "PR #288 follow-up review fully addressed in 3289adfa; reconciled with #289 in ca40c022, disposition published, targeted and full CLI tests passed, and all seven GitHub checks are green."
resolution: null
duplicate_of: null
---
Formal review 5213372082 R3. packages/tbd/src/cli/commands/sync.ts currently reports conflictsNotArchived in text but does not put the issue surface in failures or set a nonzero exit status. Add failure injection covering summary, warning, and exit status.
