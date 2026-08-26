---
type: is
id: is-01m0xvh568xcky76eahjbwbrqr
title: Prevent full-suite timeout in Rust gate script tests
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
created_at: 2026-08-26T01:39:07.591Z
updated_at: 2026-08-26T01:59:02.536Z
closed_at: 2026-08-26T01:59:02.536Z
close_reason: "Implemented and validated in stacked PR #260; all local, pre-push, and GitHub checks pass."
resolution: null
duplicate_of: null
---
The full test suite timed out after 5 seconds in the check-rust-gate test that rejects contradictory Cargo feature options. The same subprocess test completed in 42 ms in isolation, so the file needs the repository subprocess-test timeout policy to remain reliable under concurrent full-suite load.
