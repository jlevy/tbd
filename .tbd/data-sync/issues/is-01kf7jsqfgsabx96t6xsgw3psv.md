---
type: is
id: is-01kf7jsqfgsabx96t6xsgw3psv
title: "Bug: --parent filter does not resolve display IDs"
kind: bug
status: closed
priority: 1
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T03:36:22.760Z
updated_at: 2026-03-09T16:12:31.534Z
closed_at: 2026-01-18T04:05:22.719Z
close_reason: "Fixed: list --parent now resolves display IDs to internal IDs before filtering"
---
The 'tbd list --parent tbd-xyz' command does not resolve the display ID to internal ID before filtering. It should work like other commands that accept issue IDs and resolve them first.
