---
type: is
id: is-01kzvjg4dmfp0et6f440nppjd1
title: Make CSS design-system tests CRLF-safe on Windows
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - ci
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T18:07:06.163Z
updated_at: 2026-08-12T18:10:09.462Z
closed_at: 2026-08-12T18:10:09.461Z
close_reason: null
---
packages/tbd/tests/bead-web-css.test.ts blockAfter currently compares LF multiline selectors against CRLF stylesheet text on Windows, returning null for valid icon, copy, and tag rules. Normalize line endings in the helper and add a synthetic CRLF regression. Verify focused tests, full local gate, and hosted Windows CI.
