---
type: is
id: is-01kzqmstyhvw4cmvy0v9pe3s6s
title: "PR #206 review R5: policy clause names do not indicate direction"
kind: task
status: closed
priority: 2
version: 3
labels: []
dependencies: []
parent_id: is-01kzqms8fz0d4dyfw4wsm8djfs
created_at: 2026-08-11T05:30:23.568Z
updated_at: 2026-08-11T16:29:52.794Z
closed_at: 2026-08-11T05:37:34.603Z
close_reason: "Fixed in ca224627; dispositions posted on PR #206."
---
Owner comment on the spec at the policy clause table: mirror/import/sync are vague about direction; it is an inbound and outbound creation policy plus a field sync policy, and sync should mean full synchronization. Fixed: clauses renamed outbound / inbound / field_sync throughout the spec; the sync verb now explicitly performs the full synchronization; select folds into policy.outbound.

## Notes

Reopened scope: the first pass renamed only the policy clauses; the review comment was about the mirror/import COMMANDS. Fixed in e47f4505 by adopting tbd's existing sync vocabulary across every surface (bare/--push/--pull/--status), removing mirror and import. Recorded in the spec's 'Command vocabulary' section.
