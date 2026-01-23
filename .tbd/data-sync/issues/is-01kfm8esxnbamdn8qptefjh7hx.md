---
close_reason: "ISSUES FOUND: 1) Docs say 'tbd setup --auto' but only 'tbd setup auto' works (subcommand). 2) --interactive, --from-beads, --prefix flags don't work even though defined in code. 3) CLI help doesn't show these options. Docs need update OR CLI needs fix."
closed_at: 2026-01-23T01:48:48.345Z
created_at: 2026-01-23T01:45:46.676Z
dependencies:
  - target: is-01kfm8tw2rf5jd0rmapbx6f9gn
    type: blocks
id: is-01kfm8esxnbamdn8qptefjh7hx
kind: task
labels:
  - docs-review
priority: 2
status: closed
title: Verify setup command docs consistency
type: is
updated_at: 2026-01-23T01:52:30.174Z
version: 4
---
Check tbd-docs.md, tbd-design.md, and CLI --help for the setup command and all subcommands (auto, claude, cursor, codex, beads). Ensure all sources are consistent and accurate for:
- Main setup command options
- setup auto behavior and detection
- setup claude (--check, --remove options)
- setup cursor (--check, --remove options)
- setup codex (--check, --remove options)
- setup beads --disable workflow
