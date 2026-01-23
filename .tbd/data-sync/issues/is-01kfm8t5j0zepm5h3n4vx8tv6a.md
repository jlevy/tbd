---
close_reason: Incorporated into tbd-gev4 - error message requirements already specified there
closed_at: 2026-01-23T01:52:23.315Z
created_at: 2026-01-23T01:51:59.039Z
dependencies: []
id: is-01kfm8t5j0zepm5h3n4vx8tv6a
kind: task
labels: []
priority: 2
status: closed
title: Improve error message when --prefix is required
type: is
updated_at: 2026-01-23T01:52:23.316Z
version: 2
---
When tbd setup --auto is run without --prefix (and not doing beads migration), show a helpful error message.

Current behavior: Falls back to directory name, which often produces confusing results

New behavior: Error with clear instructions:
  Error: --prefix is required for tbd setup --auto

  The --prefix flag specifies your project name for issue IDs (e.g., myapp-abc1).
  
  Example:
    tbd setup --auto --prefix=myapp
  
  Note: If migrating from beads, the prefix is automatically read from your beads config.

This makes it explicit that the user/agent must choose a prefix rather than relying on magic detection.
