---
type: is
id: is-01kzwvypa2db1rwdk8e9cchg5r
title: "PR #209 review S12: Replace client source-substring assertions"
kind: task
status: open
priority: 2
version: 4
labels:
  - review
  - testing
  - followup
  - pause
dependencies: []
parent_id: null
created_at: 2026-08-13T06:11:34.849Z
updated_at: 2026-08-15T05:44:06.022Z
---
PR #209 senior review S12. packages/tbd/tests/bead-web-css.test.ts asserts exact packages/tbd/src/web/client.ts substrings and ordering. Keep CSS/page artifact contracts but move client behavior claims to DOM/jsdom rendering tests that survive harmless renames.

## Notes

Disposition: deferred, non-blocking. Replacing source-contract tests requires a browser-DOM harness decision; retain the CSS/page contract tests now and migrate client claims in a dedicated test-infrastructure change.
