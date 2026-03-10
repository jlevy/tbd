---
type: is
id: is-01kf5zyg8pfyaqsyb9tpkh89yq
title: "Add docs: Switching from Beads to TBD (temporary disable)"
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T10:45:43.748Z
updated_at: 2026-03-09T16:12:30.548Z
closed_at: 2026-01-17T12:44:53.958Z
close_reason: Beads-side documentation, not TBD. The existing migration section in tbd-docs.md is sufficient for TBD users.
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.012Z
    original_id: tbd-1921
---
## Summary

Add reference documentation explaining how to temporarily disable Beads when switching to TBD.

## Context

When users import their beads data to TBD (tbd import beads), they need a way to disable bd so that:
- Agents don't get confused by having both systems active
- The bd prime hook doesn't inject beads workflow context
- Git hooks don't run bd sync operations

## Recommended Commands

Document this two-command approach for temporary disable:

    bd setup claude --remove && bd hooks uninstall

This removes:
- Claude Code SessionStart/PreCompact hooks (from ~/.claude/settings.json)
- Git hooks from .git/hooks/ (pre-commit, post-merge, pre-push, etc.)

## What to Document

1. Temporary disable (reversible):
   - bd setup claude --remove - removes Claude hooks
   - bd hooks uninstall - removes git hooks
   - bd daemon stop - stops daemon if running

2. Re-enabling (if user wants to go back):
   - bd setup claude - reinstalls Claude hooks
   - bd hooks install - reinstalls git hooks

3. Permanent uninstall (later, optional):
   - Point to community uninstall script
   - Or manual: brew uninstall bd / npm uninstall -g @beads/bd

## Location

Add to reference docs, likely as part of migration/import documentation.
