---
type: is
id: is-01m0ra22m4v7cgjmqxe405fh8n
title: Make the Rust MSRV gate cover every promised package
kind: bug
status: closed
priority: 1
version: 4
labels:
  - review
dependencies: []
parent_id: is-01m0r5wtrfbn7ryrw82f9r91pw
created_at: 2026-08-23T21:57:35.491Z
updated_at: 2026-08-23T22:48:43.841Z
closed_at: 2026-08-23T22:48:43.841Z
close_reason: "Fixed, fully validated, and pushed in stacked PR #260 through commit 8ae47120; Linux, macOS, Windows, coverage/lint, benchmark, and security checks are green."
resolution: null
duplicate_of: null
---
The inherited verify recipe relies on Cargo's default-member selection, so some published members can remain untested. Use --workspace when members share one MSRV; otherwise run explicit package or release-unit jobs at each declared rust-version. Do not impose one compiler floor on independently versioned packages.
