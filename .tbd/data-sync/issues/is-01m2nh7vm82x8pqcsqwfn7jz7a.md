---
type: is
id: is-01m2nh7vm82x8pqcsqwfn7jz7a
title: Verify pinned gh-stack skill identity during setup
kind: bug
status: closed
priority: 1
version: 5
delegate: codex@spud10
labels:
  - stacked-prs
  - security
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T16:36:45.311Z
updated_at: 2026-09-16T16:45:17.350Z
started_at: 2026-09-16T16:37:03.553Z
closed_at: 2026-09-16T16:42:50.328Z
close_reason: Pinned skill identity and ownership are now verified before reuse and after forced reinstall; focused collision coverage passes.
resolution: null
duplicate_of: null
---
The ensure-gh-cli skill presence check accepts any skill named gh-stack, regardless of source, version, pin, or scope. Require the pinned github/gh-stack source and pinned commit identity for the owning agent, reject same-name collisions, and add shell coverage.

## Notes

Hardened gh_stack_skill_present to inspect all scopes for the owning agent, require the official github/gh-stack source at exact GH_STACK_SKILL_SHA with pinned=true in user scope, and reject any nonmatching same-name record (including a project-scoped shadow). Added valid identity, wrong-source, wrong-version, unpinned, wrong-scope, wrong-agent, and valid-user-plus-project-shadow fixtures. Focused Vitest: 21 passed; package typecheck and focused ESLint passed.
