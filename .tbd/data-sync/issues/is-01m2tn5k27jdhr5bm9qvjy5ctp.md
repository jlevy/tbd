---
type: is
id: is-01m2tn5k27jdhr5bm9qvjy5ctp
title: setup should write the AGENTS.md managed block in the file's existing line-ending convention
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-09-18T16:21:37.479Z
updated_at: 2026-09-18T16:21:37.479Z
---
Second half of review E's E2 / review G's G3 on PR #309. inspectManagedArtifact now compares ignoring line endings, so a CRLF checkout no longer reports managed surfaces stale. Still open: installCodexSection / updatetbdSection splice an LF block into whatever the file has, so on a CRLF checkout a rewrite produces a mixed-ending file and a one-line semantic change shows up as a whole-file diff (measured at 40 insertions / 39 deletions). Fix: reuse usesCrlf from policy-grants.ts when writing the managed block, as withPolicyBlock already does. Related: tbd-mc4s.
