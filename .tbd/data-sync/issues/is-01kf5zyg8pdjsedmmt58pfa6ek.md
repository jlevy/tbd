---
type: is
id: is-01kf5zyg8pdjsedmmt58pfa6ek
title: Update cli-edge-cases.tryscript.md to use path directive
kind: chore
status: closed
priority: 3
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:08:18.938Z
updated_at: 2026-03-09T16:12:30.534Z
closed_at: 2026-01-17T11:12:44.063Z
close_reason: Updated to use path directive and tbd command instead of bin.mjs
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.077Z
    original_id: tbd-1929
---
Replace node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs with tbd command by adding path: - ../dist to YAML frontmatter
