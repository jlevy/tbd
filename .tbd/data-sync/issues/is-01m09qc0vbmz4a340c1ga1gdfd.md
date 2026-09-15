---
type: is
id: is-01m09qc0vbmz4a340c1ga1gdfd
title: deferred_until does not remove a bead from tbd ready
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
created_at: 2026-08-18T06:01:36.362Z
updated_at: 2026-09-14T04:16:44.551Z
closed_at: 2026-09-14T04:16:44.551Z
close_reason: "Fixed on main by PR #264 (c1235d3c/cb771d2f, merged 2026-09-13). readyIssueIds now takes an explicit 'now' and excludes a bead whose deferred_until is still in the future (lib/issue-selection.ts deferralPending); list --defer-before is parsed at the CLI boundary and filtered in selectIssues (cli/commands/list.ts, lib/issue-query.ts deferredBefore). Covered by tests/deferred-until.test.ts and tests/hold-axis.test.ts; verified on 52d5c2f7."
resolution: null
duplicate_of: null
---
Setting `--defer <datetime>` on a bead records `deferred_until` but leaves `status: open`, and `tbd ready` still offers the bead. A bead deferred until 2027-01-01 shows as ready today, which makes the field misleading: it reads as scheduling but changes nothing about what work is surfaced.

Found while triaging a large backlog: 21 beads under two superseded epics were given `--defer 2027-01-01T00:00:00Z`, and all 21 remained in `tbd ready` until each was separately set to `--status deferred`.

Two things would each help on their own:

- `ready` should exclude a bead whose `deferred_until` is in the future, or `--defer` should also move status to `deferred`. Whichever is intended, the two fields should not disagree about whether the work is available.
- `tbd update` refuses `--status` for multiple ids (reasonably, since close/reopen own status), but there is no bulk path to `deferred` either. Bulk-deferring a superseded subtree currently requires one call per bead, which is exactly the shell loop the CLI otherwise tells you to avoid. `--defer` is bulk-capable but does not change status, so it does not fill the gap.

Minor: `--defer 2027-01-01` fails validation and needs a full RFC 3339 datetime. The error is clear and it fails closed with zero partial writes, but a bare date is the obvious thing to type.
