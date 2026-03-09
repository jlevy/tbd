---
close_reason: "Command hierarchy redesigned: status shows setup only, stats shows all statistics, doctor is comprehensive superset"
closed_at: 2026-01-18T05:44:11.997Z
created_at: 2026-01-18T03:13:57.572Z
dependencies: []
id: is-01kf7hgnt5ymykg47yvryr2dj7
kind: epic
labels: []
priority: 1
status: closed
title: Redesign tbd status/stats/doctor command hierarchy
type: is
updated_at: 2026-03-09T02:47:22.445Z
version: 13
---
Redesign the relationship between status, stats, and doctor commands:

## Current State
- `tbd status`: Shows setup info + issue counts + integrations + worktree
- `tbd stats`: Shows issue breakdowns by status/kind/priority
- `tbd doctor`: Runs health checks (git version, config, dependencies, etc.)

## Target State
- `tbd status`: Essential setup info ONLY (no issue statistics)
  - Version, repo path, git branch
  - Sync branch, remote, ID prefix
  - Integrations status
  - Worktree status
  - Mentions: 'tbd stats' and 'tbd doctor'

- `tbd stats`: All issue statistics
  - Ready/In progress/Open/Total counts (moved from status)
  - By status, kind, priority breakdowns
  - Mentions: 'tbd status' and 'tbd doctor'

- `tbd doctor`: Comprehensive health check (superset)
  - Runs status output
  - Runs stats output
  - Additional environment/setup checks
  - Makes suggestions for any issues found
