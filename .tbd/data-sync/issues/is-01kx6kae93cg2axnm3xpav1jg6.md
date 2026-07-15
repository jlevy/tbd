---
type: is
id: is-01kx6kae93cg2axnm3xpav1jg6
title: "PR #176 review R15: parser drops ## Notes section when description is empty (notes silently lost/corrupted)"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kx51tj4c2bv1hqq9ess6rfzt
created_at: 2026-07-10T18:06:01.506Z
updated_at: 2026-07-10T18:31:47.321Z
closed_at: 2026-07-10T18:31:47.321Z
close_reason: "Addressed on PR #176: R1 PR retitled/rewritten; R2/R7/R14 bulk+anti-loop guidance across skill-baseline, tbd-prime, tbd-closing, skill-brief, prime.ts, tbd-docs, README, shortcuts; R3 dedupe; R4 pre-read fail-closed; R5 failed-result capture + non-zero exit; R6/R12 json-contract+reopen tests; R8 spec status; R9 skip note; R10 TTY hint; R11 required BodyInputState; R13 --status wording; R15 parser ## Notes-at-start fix; R16 lone --ignore-missing skip reported. Commits 3b9c247, 0eafd44, 75bd74c; validated by full suite (1358 vitest + 957 tryscript)."
---
parser.ts:89 regex /\n## Notes\n/ requires a preceding newline; an issue with notes but no description serializes to a body STARTING with ## Notes, so parseIssue folds the notes into description — notes vanish on read and the next write duplicates the section. Pre-existing (also affects main); exposed by the new reopen-stdin tryscript on PR #176. Fix: anchor regex with (^|\n). (PR #176)
