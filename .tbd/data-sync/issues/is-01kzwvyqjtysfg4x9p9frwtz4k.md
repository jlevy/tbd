---
type: is
id: is-01kzwvyqjtysfg4x9p9frwtz4k
title: "PR #209 review S15: Correct changelog Pretty sorting contract"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
  - docs
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:11:36.153Z
updated_at: 2026-08-13T06:29:35.774Z
closed_at: 2026-08-13T06:29:35.774Z
close_reason: "Fixed with regression coverage in the PR #209 senior-review remediation; focused tests and the full 1,630-test release suite pass."
---
PR #209 senior review S15. packages/tbd/CHANGELOG.md says global column sorting flattens Pretty, contradicting shipped behavior and other docs. Rewrite the clause to state sorting never disables Pretty and preserves hierarchy/child order.
