---
type: is
id: is-01kzwh1kn32yy2c68xex09h9kz
title: Sort Updated column by chronological timestamp
kind: bug
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:00:56.098Z
updated_at: 2026-08-13T03:07:01.606Z
closed_at: 2026-08-13T03:07:01.604Z
close_reason: Fixed Updated ordering to compare parsed timestamps chronologically with deterministic malformed-value fallback and display-ID tie-break; added mixed-precision ascending/descending regression coverage and passed the full 1,614-test CI gate.
---
Final PR review finding: packages/tbd/src/cli/web/board.ts currently routes the Updated column through compareText. Valid ISO timestamps with mixed fractional-second forms can order lexicographically differently from chronology and disagree with CLI --sort updated. Compare parsed Date timestamps for valid values, define a deterministic fallback for malformed values, preserve the final stable ID tie-breaker, and add focused ascending/descending/composed-sort regressions before resolving the PR thread.
