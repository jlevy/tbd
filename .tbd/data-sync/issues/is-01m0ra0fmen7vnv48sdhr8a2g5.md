---
type: is
id: is-01m0ra0fmen7vnv48sdhr8a2g5
title: Remove universal all-features assumptions from Rust gate examples
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wtrfbn7ryrw82f9r91pw
created_at: 2026-08-23T21:56:43.277Z
updated_at: 2026-08-23T22:48:43.833Z
closed_at: 2026-08-23T22:48:43.833Z
close_reason: "Fixed, fully validated, and pushed in stacked PR #260 through commit 8ae47120; Linux, macOS, Windows, coverage/lint, benchmark, and security checks are green."
resolution: null
duplicate_of: null
---
The inherited Rust floor, verification recipe, plan, and project setup still hard-code --all-features even though the review and testing guidance recognize mutually exclusive feature sets. Show default-feature commands, require the documented supported feature matrix, scope docs/MSRV jobs to their promised feature sets, and reserve --all-features for projects where that combination is valid.
