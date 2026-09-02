---
type: is
id: is-01m1j19fwksq5km5haf4k8hrxe
title: Deferring with --defer does not set status deferred, so the two fields can disagree
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-09-02T21:44:36.498Z
updated_at: 2026-09-02T21:44:36.498Z
---
Raised in the PR #264 review design assessment (issuecomment-5516514907) and deliberately
left out of scope there.

`tbd update --defer <date>` sets `deferred_until` but leaves `status` alone, so a bead can
be `status: deferred` with no date, or `status: open` with a future `deferred_until`. The
two filters also read different things: `--deferred` filters on status, `--defer-before`
on the date. Pre-existing; predates PR #264.

Decide whether the fields are meant to be independent (and document that), or whether
`--defer` should also move status. tbd-5av0's requested bulk path to `--status deferred`
probably belongs with this decision.
