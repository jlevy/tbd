---
type: is
id: is-01m0r6fh338van0p5px2g0nvvn
title: "PR #258 review R16: parse action references as YAML"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:01.986Z
updated_at: 2026-08-23T21:21:56.727Z
closed_at: 2026-08-23T21:21:56.727Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
scripts/check-action-pins.mjs and packages/tbd/tests/action-pins.test.ts. The line regex misses valid YAML such as spaced or flow-style uses keys and can mistake block-scalar text for an action. Traverse workflow YAML structure and retain exact line diagnostics with positive and negative tests.
