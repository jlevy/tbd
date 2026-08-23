---
type: is
id: is-01m0r6fhf0a5sy50ebz5tr4wye
title: "PR #258 review R17: correct PyO3 release guidance"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:02.367Z
updated_at: 2026-08-23T21:21:56.735Z
closed_at: 2026-08-23T21:21:56.735Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/rust-release-rules.md. Rust supports producing cdylib and rlib together; abi3 has API/performance and free-threaded limitations; PyO3 trampolines catch unwinding panics as PanicException while uncaught custom FFI panics abort. State each boundary precisely and cite primary docs.
