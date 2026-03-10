---
type: is
id: is-01kfm8tw2rf5jd0rmapbx6f9gn
title: "Fix setup command: use flags not subcommands"
kind: bug
status: closed
priority: 1
version: 9
labels:
  - cli
  - docs
dependencies: []
created_at: 2026-01-23T01:52:22.103Z
updated_at: 2026-03-09T16:12:32.258Z
closed_at: 2026-01-23T02:11:22.422Z
close_reason: "Fixed: setup command now uses only flags (--auto, --interactive), no subcommands. Commander.js properly routes flags when no subcommands exist."
---
## Intended Behavior

```bash
tbd setup                    # Shows help about setup
tbd setup --auto             # Auto setup for agents (uses smart defaults)
tbd setup --auto --prefix=X  # Auto setup with explicit prefix
tbd setup --interactive      # Interactive setup for humans (prompts for info)
tbd setup claude             # Configure Claude integration only (subcommand)
tbd setup cursor             # Configure Cursor integration only (subcommand)
tbd setup codex              # Configure Codex integration only (subcommand)
```

## Problem
Commander.js doesn't route parent command options when subcommands exist. `tbd setup --auto` fails with 'unknown option'.

## Solution
Intercept argv in cli.ts before Commander parses. When `setup --auto` or `setup --interactive` is detected, handle it specially.
