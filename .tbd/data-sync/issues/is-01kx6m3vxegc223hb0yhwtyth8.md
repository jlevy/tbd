---
type: is
id: is-01kx6m3vxegc223hb0yhwtyth8
title: "PR #176 review R16 (Bugbot): single-ID --ignore-missing exits silently"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kx51tj4c2bv1hqq9ess6rfzt
created_at: 2026-07-10T18:19:54.670Z
updated_at: 2026-07-10T18:31:47.326Z
closed_at: 2026-07-10T18:31:47.325Z
close_reason: "Addressed on PR #176: R1 PR retitled/rewritten; R2/R7/R14 bulk+anti-loop guidance across skill-baseline, tbd-prime, tbd-closing, skill-brief, prime.ts, tbd-docs, README, shortcuts; R3 dedupe; R4 pre-read fail-closed; R5 failed-result capture + non-zero exit; R6/R12 json-contract+reopen tests; R8 spec status; R9 skip note; R10 TTY hint; R11 required BodyInputState; R13 --status wording; R15 parser ## Notes-at-start fix; R16 lone --ignore-missing skip reported. Commits 3b9c247, 0eafd44, 75bd74c; validated by full suite (1358 vitest + 957 tryscript)."
---
close.ts:106-109 / reopen.ts: a lone unknown or unreadable ID with --ignore-missing returns before any output — exit 0, zero output. Bulk prints a summary. Fix: fall through to emitBulkSummary so the missing skip is reported (text and --json). Found by Cursor Bugbot on PR #176 merge commit 6491d39.
