---
type: is
id: is-01m0r9sxqr5cvhjgdbyycpanxa
title: Align generated language-group notes with selective guideline routing
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wtrfbn7ryrw82f9r91pw
created_at: 2026-08-23T21:53:08.342Z
updated_at: 2026-08-23T22:48:43.822Z
closed_at: 2026-08-23T22:48:43.822Z
close_reason: "Fixed, fully validated, and pushed in stacked PR #260 through commit 8ae47120; Linux, macOS, Windows, coverage/lint, benchmark, and security checks are green."
resolution: null
duplicate_of: null
---
The stacked routing policy says not to load an entire language group by default, but generated TypeScript, Python, Rust, and Convex notes still say to load all entries. Make the generated directory consistently instruct agents to select only documents relevant to the changed surface, and route the newly cross-cutting core documents explicitly.
