---
type: is
id: is-01m1yzxaq89j76rrca4yb48ww2
title: A pulled description containing a '## Notes' heading is truncated on read-back
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:37.026Z
updated_at: 2026-09-14T02:58:47.597Z
---
Found while surveying #265. parseMarkdownWithFrontmatter splits the body at the first /(^|\n)## Notes\n/i (parser.ts:74-83, :130-131). A description pulled from Linear that contains a literal '## Notes' heading is stored verbatim, then truncated on the next read, so local != base and the next run pushes the truncated prose: converges in two runs but loses text. Store pulled prose so a literal '## Notes' round-trips unchanged (escape or fence on write, or split only on the notes tbd itself appends). Test: pull a description with '## Notes' and assert the second run is quiet and the bead text is intact.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): DESIGN CHANGE. Do not change the parser: 0.7.0 and 0.8.1 split at the first /(^|\n)## Notes\n/i after trimming (file/parser.ts:71,78,131), including lowercase and fenced headings, and would truncate and push back any description a new parser keeps whole. Writer-side encoding instead: add a trailing space to each `## notes` line in a description (a leading space when it is the last line). Verified against the 0.8.1 parser, serializer, and description hash: round-trips with and without notes, idempotent on rewrite, hash-neutral (bridge-state.ts:109-116 strips trailing whitespace and 1-3 leading spaces). Do not use `\##` or `## Notes ##` (hash changes, push loop). Report the one unencodable case (a description that is only the heading, on a bead with notes) as excluded. Gated by tbd-stdj (T2).
