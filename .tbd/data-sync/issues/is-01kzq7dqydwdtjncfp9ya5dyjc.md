---
type: is
id: is-01kzq7dqydwdtjncfp9ya5dyjc
title: Triage runtime js-yaml audit advisory before next release
kind: bug
status: open
priority: 1
version: 1
labels:
  - release
  - supply-chain
dependencies: []
created_at: 2026-08-11T01:36:35.788Z
updated_at: 2026-08-11T01:36:35.788Z
---
On 2026-08-10, pnpm audit --prod on PR 207 head reported one high advisory at get-tbd to gray-matter to js-yaml (GHSA-5p4m-2wfm-xmqj). PR 207 does not modify package.json or pnpm-lock.yaml, so this is a baseline release concern, not a PR regression. Follow SUPPLY-CHAIN-SECURITY.md before any upgrade and record exploitability plus the verified remediation.
