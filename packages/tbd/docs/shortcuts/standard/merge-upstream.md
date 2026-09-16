---
title: Merge Upstream
description: Merge origin/main into the current branch with conflict resolution, then verify, push, and watch CI
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

Merge upstream changes from origin/main into the current branch and leave the branch
pushed with CI green.

## Stack Safety Check

Determine both local tracking and formal GitHub stack membership before running
`git merge`:

```bash
REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')
BRANCH=$(git branch --show-current)
PR_NUMBER=$(gh pr list --repo "$REPO" --head "$BRANCH" --state open --limit 1 \
  --json number --jq '.[0].number // empty')
```

Stop if `gh pr list` fails; do not infer that the branch has no PR from an unavailable
GitHub check.

- Run `gh stack view --json` to check local tracking.
  Exit 0 with a stack containing `$BRANCH` means the branch is locally tracked.
  Exit 2 means only that it is not tracked locally.
  For any other nonzero exit, including a missing `gh stack`, stop and run
  `tbd shortcut setup-github-cli`.

- If `$PR_NUMBER` is nonempty, resolve `$PR_URL` with
  `gh pr view "$PR_NUMBER" --repo "$REPO" --json url --jq .url`, then check the
  authoritative remote membership:

  ```bash
  REMOTE_STACK_NUMBER=$(gh api \
    "repos/$REPO/stacks?pull_request=$PR_NUMBER" \
    --jq '.[0].number // empty')
  ```

  Stop if either command fails.
  A nonempty `$REMOTE_STACK_NUMBER` means the PR is part of a formal GitHub stack even
  when `gh stack view --json` exits 2.

If either check identifies a stack, do not run the normal merge path below.
A merge commit breaks the stack because stacked branches are kept current by rebasing
the chain, not by merging the trunk into one layer.

- For a remote-only formal stack, apply the official skill’s checkout-conflict preflight
  before `gh stack checkout "$PR_URL"`: if any target branch is tracked in a different
  local stack, switch to a non-shared branch in that stack and run
  `gh stack unstack --local`, then return to this branch.
  If you cannot prove the checkout is conflict-free or safely remove the conflicting
  local tracking, stop instead of invoking a command that can prompt indefinitely.
  Stop if checkout fails or a subsequent `gh stack view --json` does not contain
  `$BRANCH`; do not merge or reconstruct the chain by hand.
- Run `gh stack sync`. This rebases and force-pushes (`--force-with-lease`) every branch
  in the stack. Skip normal-path steps 2 through 5 below.
  Capture and inspect the command’s combined output: a divergent non-interactive sync
  can print `Sync aborted — no changes were made` and exit 0. Treat any `Sync aborted`
  output as failure, resolve the divergence using the official skill, retry, and require
  a final `gh stack view --json` containing `$BRANCH`. Run the step 6 verification
  without creating a merge commit, then complete the push, CI, and closeout steps.

The normal path applies only when local tracking is absent and the current PR, if any,
has no formal remote stack membership.
See `tbd shortcut stacked-prs`.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Check state:**
   - Run `git status` and `git fetch --all`
   - Complete the stack safety check above before continuing
   - If uncommitted changes exist, commit them first via
     `tbd shortcut code-review-and-commit` (or ask the user if the changes look like
     another agent’s in-progress work)

2. **Review upstream changes:** commits on origin/main since the branch diverged
   - `git log HEAD..origin/main --oneline`

3. **Review local changes:** commits on this branch since diverging
   - `git log origin/main..HEAD --oneline`
   - `git diff origin/main...HEAD --stat`

4. **Evaluate conflicts:** identify likely logical or structural conflicts before
   merging—including semantic conflicts merge cannot see (both sides touching the same
   behavior, renamed symbols, regenerated files)

5. **Merge:** run `git merge origin/main`
   - Resolve all conflicts carefully with full context
   - For each conflict, understand both sides before choosing a resolution

6. **Verify and commit:** run formatting, linting, and tests (see project docs for the
   exact commands)
   - Fix any issues introduced by the merge
   - On the normal path, commit the merge result.
     On the stack path, do not create a merge commit

7. **Push and wait for CI (CRITICAL):**
   - `git push`
   - If the branch has a PR, watch CI. **GitHub CLI setup** (if issues, run
     `tbd shortcut setup-github-cli`):
     ```
     REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')
     ```
   - Run `gh pr checks <PR_NUMBER> --repo $REPO --watch 2>&1` and wait for the **final
     summary**—do not stop at early “passing” output
   - If CI fails: analyze, fix, commit, push, and restart this step

8. **Close out:** run `tbd sync`, then report the merge or stack-sync result to the user
   (commits integrated, conflicts resolved and how, CI status)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
