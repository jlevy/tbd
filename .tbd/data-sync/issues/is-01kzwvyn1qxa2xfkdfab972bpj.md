---
type: is
id: is-01kzwvyn1qxa2xfkdfab972bpj
title: "PR #209 review S9: Bound tree traversal against cycles and depth"
kind: bug
status: open
priority: 2
version: 2
labels:
  - review
  - robustness
  - followup
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:33.558Z
updated_at: 2026-08-13T06:29:36.345Z
---
PR #209 senior review S9. packages/tbd/src/cli/web/board.ts rollUpUpdatedAt and walk recurse without cycle or depth protection around buildIssueTree data. Replace with bounded iterative traversal or degrade malformed cyclic/deep subtrees safely so the long-lived web server cannot stack overflow.

## Notes

Disposition: deferred, non-blocking. Cycle/depth hardening predates PR #209 and is shared with terminal tree construction; fix both surfaces together with iterative traversal and explicit corrupt-input tests.
