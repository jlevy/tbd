---
type: is
id: is-01m1yzxw2jnvn814wsq63njw55
title: tbd list --linked/--unlinked [provider] and JSON links
kind: feature
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:54.791Z
updated_at: 2026-09-16T08:27:45.869Z
extensions:
  linear:
    id: ce4bc2a0-3b6b-4a08-b410-4c5dea5a037d
    linked_at: 2026-09-16T08:27:45.869Z
---
GH #271 part 3. list --json omits extensions (list.ts:80-98), so a tracker link cannot be filtered on; finding unlinked epics means reading the 'would create' line of a dry run. Add --linked [provider] and --unlinked [provider] filtering on readLink; with one enabled provider the argument is optional, with several and none named the error lists them. JSON rows gain links: {<provider>: {id, linked_at}} only when a link exists, so the pinned shape for unlinked beads is unchanged. Test with a linked bead in the mock-server e2e.
