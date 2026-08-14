---
type: is
id: is-01kzq7dqydwdtjncfp9ya5dyjc
title: Triage runtime js-yaml audit advisory before next release
kind: bug
status: deferred
priority: 1
version: 5
labels:
  - release
  - supply-chain
  - review
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
deferred_until: 2026-08-15T00:00:00.000Z
created_at: 2026-08-11T01:36:35.788Z
updated_at: 2026-08-14T00:28:33.249Z
---
On 2026-08-10, pnpm audit --prod on PR 207 head reported one high advisory at get-tbd to gray-matter to js-yaml (GHSA-5p4m-2wfm-xmqj). PR 207 does not modify package.json or pnpm-lock.yaml, so this is a baseline release concern, not a PR regression. Follow SUPPLY-CHAIN-SECURITY.md before any upgrade and record exploitability plus the verified remediation.

## Notes

2026-08-13 release audit reproduced one high production advisory: gray-matter -> js-yaml (GHSA-5p4m-2wfm-xmqj). The committed lock resolves js-yaml 3.15.0. Patched 3.15.1 was published 2026-07-31T17:48:53Z and remains inside the mandatory 14-day cool-off until 2026-08-14T17:48:53Z; the existing defer to 2026-08-15 is appropriate. Keep public release blocked until gray-matter is removed or the patched exact transitive version is reviewed, installed, and pnpm audit --prod is clean.
