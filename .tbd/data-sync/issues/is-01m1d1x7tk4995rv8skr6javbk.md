---
type: is
id: is-01m1d1x7tk4995rv8skr6javbk
title: Stack awareness in the PR review lifecycle docs
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:19:11.442Z
updated_at: 2026-08-31T23:19:11.442Z
---
pr-review-workflows.md maps the review lifecycle but has no notion of a stack, and the review and
address shortcuts inherit that blind spot.

CHANGES
- pr-review-workflows.md: note that when a PR is one layer of a stack, review is scoped to that
  layer's own diff (which is what GitHub shows, since the base is the branch below), and findings
  must name the layer they belong to.
- address-pr-review.md: a fix belongs on the layer that owns the code, not on whatever branch is
  checked out. After committing to a lower layer, the layers above need rebasing
  ('gh stack rebase --upstack') before CI on the upper PRs means anything. Also note
  'gh pr checkout <N>' can land the agent mid-stack.
- merge-upstream.md: its merge-from-trunk advice conflicts with stack maintenance, where the
  correct move is a stack rebase, not a merge commit. Add a short 'if this branch is in a stack'
  carve-out.
- review-code.md: 'gh pr diff <PR>' on a stacked PR shows only that layer. Say so, so a reviewer
  does not think the change is incomplete.

Keep each addition short. These are carve-outs in existing docs, not new sections.
