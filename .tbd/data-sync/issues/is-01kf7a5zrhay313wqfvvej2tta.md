---
type: is
id: is-01kf7a5zrhay313wqfvvej2tta
title: Show Git version in tbd status command
kind: feature
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T01:05:47.281Z
updated_at: 2026-03-09T16:12:31.347Z
closed_at: 2026-01-19T08:24:09.296Z
close_reason: Implemented - tbd status shows 'Git 2.50.1' and indicates version support
---
Add Git version detection to tbd status command.

Requirements:
- Show detected Git version in status output
- Indicate whether the version is supported (2.42+)
- This should share code with tbd doctor's Git version check
- tbd doctor should remain the superset (more comprehensive checks)
