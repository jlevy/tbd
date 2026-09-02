---
type: is
id: is-01m1d1wcxcv1pxvpa8g4dc9a2x
title: PR shortcuts hardcode --base main and silently flatten stacks
kind: bug
status: open
priority: 0
version: 2
labels: []
dependencies:
  - type: blocks
    target: is-01m1d1x86a96ak3rzd8w6ft7ej
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:18:43.883Z
updated_at: 2026-08-31T23:19:22.001Z
---
create-or-update-pr-simple.md and create-or-update-pr-with-validation-plan.md both instruct:

  gh pr create --repo $REPO --head $BRANCH --base main --title ... --body ...

On a stacked branch this is wrong and destructive to the stack: the PR is retargeted at main, so
the diff shown to the reviewer includes every lower layer, and the stack GitHub tracks is broken.
An agent following our own shortcut undoes the user's stack without saying anything. This is the
highest-severity guidance bug found in the review.

Two further problems with the same lines:
- 'main' is assumed as the trunk name. Repos using master/develop/trunk get a wrong base.
- 'gh pr edit' on an existing stacked PR has the same retargeting hazard if --base is passed.

FIX
- Derive the base instead of hardcoding it. Resolve the repo default branch via
  'gh repo view --json defaultBranchRef -q .defaultBranchRef.name' and use that as the fallback.
- Before creating/updating, detect whether the branch is part of a stack
  ('gh stack view --json', which is the non-interactive form) and if so use the branch below as
  the base, or delegate the whole create/update to 'gh stack submit --auto'.
- Never pass --base main unconditionally. Never pass --base on 'gh pr edit' unless deliberately
  retargeting.
- Keep the non-stacked path exactly as simple as it is now; this must not add ceremony for the
  common single-PR case.
