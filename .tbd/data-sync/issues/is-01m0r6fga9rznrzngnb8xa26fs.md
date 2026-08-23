---
type: is
id: is-01m0r6fga9rznrzngnb8xa26fs
title: "PR #258 review R14: preserve minimal-test-set principle"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:01.192Z
updated_at: 2026-08-23T21:21:56.708Z
closed_at: 2026-08-23T21:21:56.707Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/general-testing-rules.md. The expansion replaced the original minimal-tests-with-maximal-coverage rule with a categorical rejection of test-count optimization. Restore the original optimization goal while defining coverage as independent behavioral evidence and diagnostic value.
