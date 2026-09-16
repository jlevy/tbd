---
type: is
id: is-01m2nqtwk7sa6nfjta8s3r7hy4
title: Make gh-stack installer tests portable on Windows CI
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
hold: null
hold_until: null
created_at: 2026-09-16T18:32:00.358Z
updated_at: 2026-09-16T18:32:07.845Z
started_at: 2026-09-16T18:32:07.844Z
---
PR #301 head 048ce4dc added Darwin/Linux-only shell integration tests that ran under Windows Git Bash, plus a source-text assertion that did not normalize CRLF. The Windows Node 24 job failed five assertions. Skip the four Unix-only executable/manifest integration cases on win32, normalize CRLF for the portable source contract, and prove the refreshed matrix is green.
