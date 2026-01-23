---
created_at: 2026-01-23T01:52:22.103Z
dependencies: []
id: is-01kfm8tw2rf5jd0rmapbx6f9gn
kind: bug
labels:
  - cli
  - docs
priority: 1
status: open
title: "Fix setup command: use flags not subcommands"
type: is
updated_at: 2026-01-23T01:52:22.103Z
version: 1
---
## Problem

The setup command currently uses subcommands (`tbd setup auto`, `tbd setup claude`, etc.) but it should use FLAGS on the main command.

### Current (broken):
- `tbd setup auto` - works as subcommand
- `tbd setup --auto` - ERROR: unknown option

### Expected:
- `tbd setup --auto` - should work
- `tbd setup --interactive` - should work  
- `tbd setup --from-beads` - should work (or remove if deprecated)
- `tbd setup` (no flags) - should print help about required flags
- `tbd setup claude`, `tbd setup cursor`, `tbd setup codex`, `tbd setup beads` - keep as subcommands for individual integrations

### Root Cause
Commander.js doesn't properly route parent command options when subcommands are added. The options ARE defined (lines 1347-1350 in setup.ts) but don't work.

### Also Fix
- Remove deprecated `import --from-beads` option
- Update tbd-docs.md to match actual behavior
- Update tbd-design.md to match actual behavior
