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

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Check state:**
   - Run `git status` and `git fetch --all`
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
   - Commit the merge result

7. **Push and wait for CI (CRITICAL):**
   - `git push`
   - If the branch has a PR, run `gh pr checks <PR_NUMBER> --watch 2>&1` and wait for
     the **final summary**—do not stop at early “passing” output
   - If CI fails: analyze, fix, commit, push, and restart this step

8. **Close out:** run `tbd sync`, then report the merge result to the user (commits
   merged, conflicts resolved and how, CI status)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
