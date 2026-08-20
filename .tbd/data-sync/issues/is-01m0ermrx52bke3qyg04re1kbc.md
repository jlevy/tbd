---
type: is
id: is-01m0ermrx52bke3qyg04re1kbc
title: Live-verify directory-bound assignment end to end
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:00:03.876Z
updated_at: 2026-08-20T05:14:55.594Z
started_at: 2026-08-20T05:13:31.840Z
closed_at: 2026-08-20T05:14:55.592Z
close_reason: "VERIFIED LIVE against team OS. With user_map:{} and field_sync.fields.assignee set to merge, a bead assigned by the bare handle 'josh' resolved through the workspace directory and published: OS-337 is now assigned to josh <josh@finterm.ai>. A binding was written to bridge/linear/users/3f632462-....yml keyed by provider user id, carrying handle and display_name and NO email, exactly as designed. A second push settled. Config restored to assignee: local afterwards — the conservative default the OS-351 fix requires — so this remains opt-in per repository."
resolution: null
duplicate_of: null
---
Actor Phase 2 is implemented and unit-covered but never exercised against the real API, because the OS-351 fix requires field_sync.fields.assignee: merge and this repo has not set it. Set it deliberately, confirm a handle resolves through the workspace directory, binds by provider user id under bridge/linear/users/, and publishes; then revert the config.
