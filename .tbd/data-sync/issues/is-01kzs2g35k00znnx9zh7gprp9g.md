---
type: is
id: is-01kzs2g35k00znnx9zh7gprp9g
title: "R13: Remove shell-specific syntax from the web transcript"
kind: bug
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - ci
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T18:48:58.802Z
updated_at: 2026-08-11T19:29:56.546Z
closed_at: 2026-08-11T19:29:56.544Z
close_reason: Fixed with the awaited shell-neutral run-built-cli harness, explicit sandbox setup assertion, and portable sed/jq filters. GitHub Actions run 31527569977 passed the focused transcript on Windows, macOS, and Ubuntu.
---
Windows run 31523906669 proves the focused transcript still embeds POSIX shell syntax after R11: shell:true leaves $TRYSCRIPT_TEST_DIR literal, resolving the entry under the sandbox, and single-quoted jq source is passed with quote characters. In packages/tbd/tests/cli-web.tryscript.md, invoke a sandbox-copied Node fixture instead of expanding the entry path in the shell, and use shell-neutral double quotes for sed/jq arguments. Add packages/tbd/tests/run-built-cli.mjs to resolve TRYSCRIPT_TEST_DIR through process.env, replace process.argv[1], and import dist/bin.mjs via pathToFileURL. Acceptance: focused transcript passes locally and in Ubuntu/macOS/Windows CI without weakening the built-artifact contract.

## Notes

Fixed with the awaited shell-neutral run-built-cli harness, explicit sandbox setup assertion, and portable sed/jq filters. GitHub Actions run 31527569977 passed the focused transcript on Windows, macOS, and Ubuntu.
