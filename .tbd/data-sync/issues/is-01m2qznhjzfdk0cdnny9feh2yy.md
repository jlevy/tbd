---
type: is
id: is-01m2qznhjzfdk0cdnny9feh2yy
title: setup treats the AGENTS.md block as stale on CRLF checkouts
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
created_at: 2026-09-17T15:27:22.718Z
updated_at: 2026-09-18T16:26:41.287Z
closed_at: 2026-09-18T16:26:41.287Z
close_reason: "Fixed in fa7cd39e: inspectManagedArtifact compares managed content ignoring line endings, so a CRLF checkout no longer reports AGENTS.md or the generated skills stale; CLI test drives setup, policy grant, doctor on a CRLF file (red-green proved). Remaining convention-preserving write is tbd-dugv"
resolution: null
duplicate_of: null
---
Found while fixing CI for PR #309 (tbd-e7ct), pre-existing since 0.9.0: setup.ts writes an LF tbd block into a CRLF AGENTS.md and the managed-block freshness comparison is line-ending sensitive, so on a fresh Windows checkout setup and doctor report the block stale and rewrite it, leaving mixed line endings (hidden in commits by git autocrlf). policy-grants.ts now normalizes on read and preserves the file's line endings on write; apply the same approach to setup's managed-block comparison and write, with a CRLF test.
