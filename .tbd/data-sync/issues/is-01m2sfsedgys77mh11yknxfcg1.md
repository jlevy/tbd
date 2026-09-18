---
type: is
id: is-01m2sfsedgys77mh11yknxfcg1
title: "PR #310 B3: definition still supplies the body even when level matches session"
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2sfrxdj3qrbcvsyd4sjdsvm
created_at: 2026-09-18T05:28:22.192Z
updated_at: 2026-09-18T05:28:22.192Z
---
Medium. packages/tbd/docs/guidelines/agent-model-tiers.md:77-79 and research brief :834-837.
Review: https://github.com/jlevy/tbd/pull/310#pullrequestreview-5244530005
Fix: A definition changes the model and level only when its level differs; it still supplies the body.
