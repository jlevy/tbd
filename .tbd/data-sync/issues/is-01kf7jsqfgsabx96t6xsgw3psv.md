---
created_at: 2026-01-18T03:36:22.760Z
dependencies: []
id: is-01kf7jsqfgsabx96t6xsgw3psv
kind: bug
labels: []
priority: 1
status: open
title: "Bug: --parent filter does not resolve display IDs"
type: is
updated_at: 2026-01-18T03:36:22.760Z
version: 1
---
The 'tbd list --parent tbd-xyz' command does not resolve the display ID to internal ID before filtering. It should work like other commands that accept issue IDs and resolve them first.
