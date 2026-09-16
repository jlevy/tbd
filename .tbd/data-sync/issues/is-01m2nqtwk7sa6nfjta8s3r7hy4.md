---
type: is
id: is-01m2nqtwk7sa6nfjta8s3r7hy4
title: Make gh-stack installer tests portable on Windows CI
kind: bug
status: closed
priority: 1
version: 4
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
hold: null
hold_until: null
created_at: 2026-09-16T18:32:00.358Z
updated_at: 2026-09-16T18:52:52.769Z
started_at: 2026-09-16T18:32:07.844Z
closed_at: 2026-09-16T18:52:52.767Z
close_reason: "Windows portability fix shipped in f5862479 and fresh PR #301 matrix is fully green, including Windows Node 24."
resolution: null
duplicate_of: null
---
PR #301 head 048ce4dc added Darwin/Linux-only shell integration tests that ran under Windows Git Bash, plus a source-text assertion that did not normalize CRLF. The Windows Node 24 job failed five assertions. Skip the four Unix-only executable/manifest integration cases on win32, normalize CRLF for the portable source contract, and prove the refreshed matrix is green.

## Notes

Resolved in f5862479: skip four Darwin/Linux-only shell integration cases on win32 while retaining portable source-contract coverage, normalize CRLF for source inspection, and keep the production installer unchanged. Focused local installer suite passed 34/34. Fresh hosted run 35136128676 passed Windows Node 24 in 9m23s, coverage/lint, macOS, both Ubuntu variants, benchmark, and DeepSource.
