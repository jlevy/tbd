---
type: is
id: is-01kzs2g35k00znnx9zh7gprp9g
title: "R13: Remove shell-specific syntax from the web transcript"
kind: bug
status: in_progress
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - ci
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T18:48:58.802Z
updated_at: 2026-08-11T19:02:32.579Z
---
Windows run 31523906669 proves the focused transcript still embeds POSIX shell syntax after R11: shell:true leaves $TRYSCRIPT_TEST_DIR literal, resolving the entry under the sandbox, and single-quoted jq source is passed with quote characters. In packages/tbd/tests/cli-web.tryscript.md, invoke a sandbox-copied Node fixture instead of expanding the entry path in the shell, and use shell-neutral double quotes for sed/jq arguments. Add packages/tbd/tests/run-built-cli.mjs to resolve TRYSCRIPT_TEST_DIR through process.env, replace process.argv[1], and import dist/bin.mjs via pathToFileURL. Acceptance: focused transcript passes locally and in Ubuntu/macOS/Windows CI without weakening the built-artifact contract.

## Notes

Third Windows run 31525257214 / job 93891871889 proved the shell/path correction works: Help and both validation cases passed. Only dry-run failed because the dynamic-import helper returned after bin.mjs launched its intentionally void runCli(), so the unchecked before-hook init was not durable on Windows. Reworked the fixture to spawnSync process.execPath + dist/bin.mjs and propagate its status; moved init into an explicit transcript assertion. Focused transcript now 5/5; ci:quality and packed proof pass. Pending pushed Windows matrix.
