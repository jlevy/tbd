---
type: is
id: is-01ky1fafvvt18p056jfy6z1dm2
title: "PR #196 review R5: created/deleted reports include null-to-null fields"
kind: bug
status: closed
priority: 3
version: 3
labels:
  - pr196-review
dependencies: []
parent_id: is-01ky1f9xcbb3qas6ex5v7hda0k
created_at: 2026-07-21T04:35:38.490Z
updated_at: 2026-07-21T04:48:29.421Z
closed_at: 2026-07-21T04:48:29.421Z
close_reason: "Fixed in 52867bd: fields null on both sides are omitted from created/deleted reports; test updated to pin omission."
---
Created/deleted beads emit all 19 normative fields including pairs where both normalized sides are null (assignee: null -> null on create). issue-changes.ts:229-241. Fix: skip fields whose normalized before and after are both null in the created/deleted branch.
