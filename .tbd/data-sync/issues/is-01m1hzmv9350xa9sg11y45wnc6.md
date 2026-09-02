---
type: is
id: is-01m1hzmv9350xa9sg11y45wnc6
title: "PR #264 review R9: unnecessary as Partial<Issue> casts in tests"
kind: bug
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m1hzmrdcgkf45b2nf8mhqghq
created_at: 2026-09-02T21:15:51.458Z
updated_at: 2026-09-02T21:43:56.337Z
closed_at: 2026-09-02T21:43:56.336Z
close_reason: "Fixed in c1235d3c on PR #264; disposition map posted as issuecomment-5516854053."
resolution: null
duplicate_of: null
---
deferred-until.test.ts, 6 sites. tsc passes without them; casts on test data hide missing fields.
