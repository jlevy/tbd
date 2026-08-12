---
type: is
id: is-01kzq7dqydwdtjncfp9ya5dyjc
title: Triage runtime js-yaml audit advisory before next release
kind: bug
status: deferred
priority: 1
version: 3
labels:
  - release
  - supply-chain
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
deferred_until: 2026-08-15T00:00:00.000Z
created_at: 2026-08-11T01:36:35.788Z
updated_at: 2026-08-12T23:38:22.597Z
---
On 2026-08-10, pnpm audit --prod on PR 207 head reported one high advisory at get-tbd to gray-matter to js-yaml (GHSA-5p4m-2wfm-xmqj). PR 207 does not modify package.json or pnpm-lock.yaml, so this is a baseline release concern, not a PR regression. Follow SUPPLY-CHAIN-SECURITY.md before any upgrade and record exploitability plus the verified remediation.

## Notes

PR #209 routes every tbd gray-matter call through the existing yaml package, making js-yaml and its vulnerable !!omap resolver unreachable. The audit remains visible because gray-matter still declares js-yaml. Fixed js-yaml 3.15.1 was published 2026-07-31T17:48:53Z and is inside the 14-day supply-chain cooldown through 2026-08-14. Re-evaluate the minimal transitive upgrade after cooldown; this is non-blocking for 0.5.0 because the affected parser path cannot be selected.
