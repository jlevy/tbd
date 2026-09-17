---
type: is
id: is-01m2qznhjzfdk0cdnny9feh2yy
title: setup treats the AGENTS.md block as stale on CRLF checkouts
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-17T15:27:22.718Z
updated_at: 2026-09-17T15:27:22.718Z
---
Found while fixing CI for PR #309 (tbd-e7ct), pre-existing since 0.9.0: setup.ts writes an LF tbd block into a CRLF AGENTS.md and the managed-block freshness comparison is line-ending sensitive, so on a fresh Windows checkout setup and doctor report the block stale and rewrite it, leaving mixed line endings (hidden in commits by git autocrlf). policy-grants.ts now normalizes on read and preserves the file's line endings on write; apply the same approach to setup's managed-block comparison and write, with a CRLF test.
