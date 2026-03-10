---
type: is
id: is-01kgav6bhmybd7hds22ba1k0fz
title: "Enhancement: workspace list should show issue counts by status"
kind: task
status: closed
priority: 2
version: 11
spec_path: docs/project/specs/active/plan-2026-01-30-workspace-sync-alt.md
labels: []
dependencies: []
created_at: 2026-01-31T20:16:30.259Z
updated_at: 2026-03-09T16:12:33.617Z
closed_at: 2026-01-31T20:22:55.936Z
close_reason: Implemented workspace list with issue counts by status. Added listWorkspacesWithCounts() function and updated workspace list command to display table format with open/in_progress/closed/total columns. Golden session test added to cli-workspace-save.tryscript.md
---
Enhance `tbd workspace list` to show issue counts by status (open, in_progress, closed, total) for each workspace. Output format should be consistent with `tbd stats` styling (aligned columns). Currently only lists workspace names without any counts.
