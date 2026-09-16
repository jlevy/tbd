---
type: is
id: is-01m2nqmac4q7hwa4k8628x5yya
title: "PR #301: make gh-stack installer coverage portable on Windows CI"
kind: bug
status: in_progress
priority: 1
version: 2
delegate: windows-ci-fix
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T18:28:25.090Z
updated_at: 2026-09-16T18:28:36.842Z
started_at: 2026-09-16T18:28:36.839Z
---
Windows job 104920895818 on run 35133769384 fails installer tests because the shell sees MINGW64_NT as unsupported, generated scripts use CRLF in assertions, and path/race fixtures assume POSIX path semantics. Preserve the installer support boundary while making the black-box tests and any intended detection portable; reproduce from CI annotations, add focused coverage, and get the full Windows job green.
