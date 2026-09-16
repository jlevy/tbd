---
type: is
id: is-01m2nkxx5mqbttbnqkwvh8g7yg
title: "PR #301 review R2: preflight interactive stack checkout conflicts"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m2nkxetrqprhrk8vsh7q9avn
created_at: 2026-09-16T17:23:44.947Z
updated_at: 2026-09-16T17:23:44.947Z
---
Medium finding at packages/tbd/docs/shortcuts/standard/address-pr-review.md:93. gh stack checkout can prompt indefinitely when target branches overlap a different local stack. Add the official unstack-local preflight or stop safely, and test the workflow contract. Review: https://github.com/jlevy/tbd/pull/301#issuecomment-5701658210
