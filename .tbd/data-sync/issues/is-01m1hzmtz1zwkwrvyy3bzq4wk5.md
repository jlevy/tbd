---
type: is
id: is-01m1hzmtz1zwkwrvyy3bzq4wk5
title: "PR #264 review R8: optional clock params invite the two-clock bug (judgment)"
kind: bug
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m1hzmrdcgkf45b2nf8mhqghq
created_at: 2026-09-02T21:15:51.136Z
updated_at: 2026-09-02T21:43:56.008Z
closed_at: 2026-09-02T21:43:56.007Z
close_reason: "Fixed in c1235d3c on PR #264; disposition map posted as issuecomment-5516854053."
resolution: null
duplicate_of: null
---
issue-selection.ts:81, mirror.ts:50. Make now required on readyIssueIds and readyAt required on MirrorContext.
