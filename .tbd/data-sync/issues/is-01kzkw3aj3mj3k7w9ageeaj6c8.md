---
type: is
id: is-01kzkw3aj3mj3k7w9ageeaj6c8
title: "PR #205 review R4: make watch worker delivery safe"
kind: bug
status: closed
priority: 1
version: 9
labels: []
dependencies: []
parent_id: is-01kzkw2m9r8zz31np7zzgpdymp
created_at: 2026-08-09T18:20:56.770Z
updated_at: 2026-08-09T19:27:14.152Z
closed_at: 2026-08-09T19:27:14.151Z
close_reason: Canonicalized LF or CRLF to one CRLF sequence in the regression fixture; the extractor already handled actual Windows CRLF. Targeted Vitest, Prettier, and ESLint pass.
---
PR #205 R4. packages/tbd/docs/shortcuts/standard/watch-beads.md:45-71. Preserve the checkpoint until worker success, pull/revalidate state before action, surface failure, and make signal traps terminate.

## Notes

Reopened: macOS CI exposed Bash 3.2 nounset incompatibility in the unattended recipe

Reopened: Windows CI exposed an LF-only Markdown fence extractor after checkout converted the shortcut to CRLF; reopening to record the portability regression and fix.

Reopened: Windows CI showed the CRLF regression fixture itself double-converted an already-CRLF checkout into CRCRLF; reopening for the exact cross-platform test correction.
