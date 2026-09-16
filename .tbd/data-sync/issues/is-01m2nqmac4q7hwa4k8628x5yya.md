---
type: is
id: is-01m2nqmac4q7hwa4k8628x5yya
title: "PR #301: make gh-stack installer coverage portable on Windows CI"
kind: bug
status: closed
priority: 1
version: 5
delegate: windows-ci-fix
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T18:28:25.090Z
updated_at: 2026-09-16T18:52:54.972Z
started_at: 2026-09-16T18:28:36.839Z
closed_at: 2026-09-16T18:52:54.970Z
close_reason: Duplicate Windows CI follow-up resolved by f5862479; full hosted matrix is green.
resolution: null
duplicate_of: null
---
Windows job 104920895818 on run 35133769384 fails installer tests because the shell sees MINGW64_NT as unsupported, generated scripts use CRLF in assertions, and path/race fixtures assume POSIX path semantics. Preserve the installer support boundary while making the black-box tests and any intended detection portable; reproduce from CI annotations, add focused coverage, and get the full Windows job green.

## Notes

Resolved by the production-safe test portability fix in f5862479. The fresh PR #301 run 35136128676 passed Windows Node 24 in 9m23s and the complete hosted matrix is green. The alternate uncommitted harness patch is not required.
