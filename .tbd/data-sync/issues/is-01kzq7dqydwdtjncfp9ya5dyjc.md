---
type: is
id: is-01kzq7dqydwdtjncfp9ya5dyjc
title: Triage runtime js-yaml audit advisory before next release
kind: bug
status: deferred
priority: 1
version: 4
labels:
  - release
  - supply-chain
  - review
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
deferred_until: 2026-08-15T00:00:00.000Z
created_at: 2026-08-11T01:36:35.788Z
updated_at: 2026-08-13T06:11:56.191Z
---
On 2026-08-10, pnpm audit --prod on PR 207 head reported one high advisory at get-tbd to gray-matter to js-yaml (GHSA-5p4m-2wfm-xmqj). PR 207 does not modify package.json or pnpm-lock.yaml, so this is a baseline release concern, not a PR regression. Follow SUPPLY-CHAIN-SECURITY.md before any upgrade and record exploitability plus the verified remediation.

## Notes

PR #209 senior review suggestion SG3 independently recommends dropping gray-matter so its legacy js-yaml dependency and audit advisory disappear. This is the same release/supply-chain concern already tracked here; retain the cooldown and supply-chain validation before changing dependencies.
