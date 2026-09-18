---
type: is
id: is-01m2sfsedgys77mh11yknxfcg1
title: "PR #310 B3: definition still supplies the body even when level matches session"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2sfrxdj3qrbcvsyd4sjdsvm
hold: null
hold_until: null
created_at: 2026-09-18T05:28:22.192Z
updated_at: 2026-09-18T05:36:14.875Z
started_at: 2026-09-18T05:32:06.166Z
closed_at: 2026-09-18T05:36:14.875Z
close_reason: "Fixed in a35d1e0f; dispositions posted on #310 review B"
resolution: null
duplicate_of: null
---
Medium. packages/tbd/docs/guidelines/agent-model-tiers.md:77-79 and research brief :834-837.
Review: https://github.com/jlevy/tbd/pull/310#pullrequestreview-5244530005
Fix: A definition changes the model and level only when its level differs; it still supplies the body.
