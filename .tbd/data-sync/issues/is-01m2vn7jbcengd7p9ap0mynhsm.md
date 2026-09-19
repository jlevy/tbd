---
type: is
id: is-01m2vn7jbcengd7p9ap0mynhsm
title: "Publish Review I on #309 (ManagePullRequest post_comment)"
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2vmva9sbfzx7k0mrh45kbkf
created_at: 2026-09-19T01:41:56.716Z
updated_at: 2026-09-19T01:41:56.716Z
---
Review I and dispositions are written at /tmp/review-I-309.md and /tmp/dispositions-I-309.md (also /opt/cursor/artifacts/review-I-309.md). This worker has no ManagePullRequest; gh POST reviews and issue comments return 403. Post both comments on #309 with markers tbd:review v=1 id=I and tbd:dispositions v=1 review=I. Do not post on #310 (rebase-only). Do not update_pr (owner-managed body). Do not merge.
