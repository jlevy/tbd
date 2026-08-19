---
type: is
id: is-01m0de95sq9b6s7fgfc5rkhq6x
title: "Sync clears Linear assignees: a null local assignee is pushed as an explicit unassign"
kind: bug
status: open
priority: 0
version: 3
assignee: josh
labels: []
dependencies: []
created_at: 2026-08-19T16:39:43.669Z
updated_at: 2026-08-19T16:54:27.939Z
extensions:
  linear:
    id: 8a51f977-f9e5-411d-8c72-4e8e67be7837
    linked_at: 2026-08-19T16:54:20.080Z
---
## Summary

A linked bead with no local assignee pushes a null assignee to Linear, clearing whatever
person a human had assigned there. The only gate on the push is whether `user_map` is
non-empty, so filling in `user_map` (the documented prerequisite for assignee sync) is by
itself enough to start erasing assignees.

`field_sync.fields.assignee` is never consulted on the push path, so setting it to `local`
does not prevent this.

## Reproduction

Observed live against the `OS` team, project `tbd`.

1. Start with `identity.user_map: {}` and `field_sync.fields.assignee: local`.
2. Set `user_map` to a single real mapping, leaving `assignee: local` untouched.
3. Run `tbd integration sync`.

Result: `OS-162`, whose bead `tbd-3xng` is closed and carries `assignee: null`, lost its
Linear assignee. The sync reported it plainly:

```
linear: push 1, pull 1
  ~ tbd-3xng: assignee push overwrote an edit
```

Restoring the assignee in Linear and syncing again cleared it a second time, confirming
this is steady-state behavior rather than a one-off race. Reverting `user_map` to `{}`
stops it, and the assignee then survives repeated syncs.

## Cause

`LinearAdapter.canPushAssignee` in `packages/tbd/src/integrations/linear/adapter.ts`:

```ts
return this.userMap.size > 0 && (assignee === null || this.userMap.has(assignee));
```

The `assignee === null` disjunct makes "this bead has no assignee" a pushable value rather
than an absence. Callers in `packages/tbd/src/integrations/core/sync-engine.ts` use this
as the sole gate before including `assignee` in the outbound patch, so a null flows
through as an explicit clear.

The field-flow rule is read into `provider-settings.ts` but is not applied here, which is
the second half of the bug: an operator who wants to hold assignees local has no setting
that actually does it once `user_map` is populated.

## Why This Matters

`FieldSyncClauseSchema` documents the intended contract:

> `assignee` stays local because tracker assignees are people (names/emails) and nothing
> person-identifying lands in beads without an explicit `user_map` and an explicit
> `assignee: merge`.

That protects the inbound direction only. Outbound has no equivalent guard, so the
conservative default is not conservative in the direction that destroys data. The tracker
is where a human assigned the work; a bead that simply never recorded an assignee should
not be able to overwrite that.

The blast radius scales with how many beads predate assignee tracking, which is most of
them in any repo that adopted the integration later.

## Fix

Treat a null local assignee as "no opinion", not as a value:

- `canPushAssignee(null)` should be false. Pushing an assignee should require a mapped
  identity.
- Consult `field_sync.fields.assignee` on the push path. `local` should mean the field does
  not leave the repo; `merge` should be required before any outbound assignee write.
- Deliberate unassignment, if it is wanted later, needs to be an explicit distinct action,
  not the default reading of an empty field.

## Tests

- A bead with `assignee: null` linked to an issue assigned in Linear: sync leaves the
  Linear assignee untouched, under every `field_sync.fields.assignee` mode.
- With `assignee: local` and a populated `user_map`, no assignee is written outbound.
- With `assignee: merge` and a mapped local assignee, the assignee is written as it is
  today.
- Populating `user_map` on a repo with existing linked beads performs no assignee writes on
  the next sync.
