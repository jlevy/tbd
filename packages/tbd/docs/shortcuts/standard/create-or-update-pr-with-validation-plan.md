---
title: Create or Update PR with Validation Plan
description: Create or update a pull request with a detailed test/validation plan
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
We track work as beads using tbd.
Run `tbd prime` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo and branch:
     ```
     BRANCH=$(git rev-parse --abbrev-ref HEAD)
     REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')
     ```
   - Resolve the trunk instead of assuming `main`, since repos differ and a wrong base
     makes the PR unreviewable:
     ```
     TRUNK=$(gh repo view $REPO --json defaultBranchRef -q .defaultBranchRef.name)
     ```
     (`gh repo view` takes the repo as a positional argument; it has no `--repo` flag.)
     This needs network and auth.
     If it comes back empty, fall back to `git symbolic-ref refs/remotes/origin/HEAD`
     rather than proceeding with an empty base, which would make step 6 create the PR
     against nothing.
   - Use `--repo $REPO` on all gh commands (required for Claude Code Cloud)

2. Check branch state: if this branch has uncommitted work, commit it first via
   `tbd shortcut code-review-and-commit` (leave files that look like another agent’s
   in-progress work). Do not merge the trunk yet: step 3 must classify local and remote
   stack membership first, because merging the trunk into one layer breaks a stack.

3. Check if a PR already exists for this branch, and whether the branch is stacked:
   - Record whether the user explicitly asked for a stacked PR, dependent PRs, or to
     stack the current work.
   - Run: `gh pr view $BRANCH --repo $REPO --json number,url,baseRefName 2>/dev/null`.
     If it returns JSON, retain its `number`, `url`, and `baseRefName` as `$PR_NUMBER`,
     `$PR_URL`, and `$PR_BASE`; the PR exists and you will update it.
     If it errors, you will create one.
   - Check local stack tracking with `gh stack view --json 2>/dev/null`. Always pass
     `--json`; bare `gh stack view` opens a TUI that blocks forever.
     Exit 0 with a stack containing `$BRANCH` means the branch is locally tracked.
     Exit 2 means only that the branch is not tracked *locally*; `gh stack link` can
     create a formal GitHub stack without creating local tracking.
   - When a PR exists, check its authoritative remote membership:
     ```bash
     REMOTE_STACK_NUMBER=$(gh api "repos/$REPO/stacks?pull_request=$PR_NUMBER" \
       --jq '.[0].number // empty')
     ```
     If this API call fails, stop; do not assume the PR is unstacked.
     A nonempty result means the PR belongs to a formal GitHub stack, even when the
     local check exits 2.
   - If the user requested a stack and neither check finds one, run
     `tbd shortcut stacked-prs` and use the official `gh-stack` skill to initialize and
     submit a local stack or link existing PRs with `gh stack link`. Chained branch
     bases alone are not a formal GitHub stack.
   - **Reviewable unit (before `gh pr create`):** Apply Reviewable Units in
     `tbd shortcut stacked-prs` before updating the branch, creating, or retargeting.
     Focused, isolated work that will be reviewed and merged on its own stays one PR
     based on `$TRUNK` (any size).
     Consolidate incremental spec or bead-driven work into reviewable PRs; use a stack
     when the work warrants dependent layers.
     If an existing PR’s `$PR_BASE` or a new PR’s intended base is another feature
     branch and neither stack check finds membership, stop and run
     `tbd shortcut stacked-prs`. Fold work that fails the review-unit test, or formalize
     valid dependent layers, then repeat the membership checks before continuing.
     Do not pass `--base` onto a feature branch by hand.
   - Only after this classification, update a branch that is behind its base:
     - For an unstacked branch, run `tbd shortcut merge-upstream` when needed.
     - For a locally tracked stack, use `gh stack sync`.
     - For a formal remote stack without local tracking, never merge the trunk into the
       layer. Before `gh stack checkout "$PR_URL"`, apply the official skill’s conflict
       preflight: if any target branch is tracked in a different local stack, switch to
       a non-shared branch in that stack and run `gh stack unstack --local`, then return
       to this branch. If you cannot prove the checkout is conflict-free or safely remove
       the conflicting local tracking, stop instead of invoking a command that can
       prompt indefinitely.
       Then check out the remote stack, verify with `gh stack view --json`, and run
       `gh stack sync`. Stop if checkout, verification, or sync fails.
   - For every `gh stack sync` above, capture and inspect its combined output before
     continuing. A divergent non-interactive sync can print
     `Sync aborted — no changes were made` and exit 0. Treat any `Sync aborted` output
     as failure, resolve the divergence using the official skill, retry, and require a
     final `gh stack view --json` containing `$BRANCH`.

4. Review all commits on this branch since it diverged from its base:
   - Choose a base candidate:
     - Use `$TRUNK` for an unstacked branch.
     - For a formal remote stack, use the existing PR’s recorded `$PR_BASE`. This
       remains correct for a remote-only linked stack.
     - When local tracking exists but remote formal membership does not, use
       `gh stack view --json` to find `$BRANCH` in `.branches`; use the previous
       branch’s `.name`, or `.trunk` when `$BRANCH` is the bottom layer.
       This applies whether or not an open PR already exists.
   - Run `git fetch origin`, then resolve the candidate to an existing commit.
     For an existing PR, and for a trunk or already-published base, use the fetched
     `origin/<candidate>` ref so the description matches GitHub’s diff.
     Never prefer a same-named local branch over that fetched remote ref.
     Use the local `<candidate>` only for a genuinely unpublished, locally tracked stack
     layer; stop if the state-appropriate revision does not exist.
     Assign the resolved revision to `$DIFF_BASE`.
   - Run `git log $DIFF_BASE..HEAD --oneline` to see commits.
   - Run `git diff $DIFF_BASE...HEAD` to see all changes.
     Diffing a stacked layer against the trunk includes every lower layer and produces
     the wrong PR description.
   - Review any related specs in docs/project/specs/active/

5. Write a PR title and description with these sections.
   Use conventional commit prefixes: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
   `chore`, `plan`, `research`, `ops`, `process`. Scope is optional—only add when it
   resolves an important ambiguity.
   (See `tbd guidelines commit-conventions` for details.)

   ## Summary

   Brief description of the changes (2-3 sentences).

   ## Changes

   Bulleted list of specific changes made.

   ## Test Plan

   Detailed validation checklist:
   - [ ] Unit tests pass (run the project’s test command)
   - [ ] Build succeeds (run the project’s build command)
   - [ ] Manual testing steps (list specific scenarios to test)
   - [ ] Edge cases considered (list any)

   ## Related Beads

   Link any related beads using their IDs.

6. Create or update the PR:
   - **Locally tracked stack:** run `gh stack submit --auto`, then set the title and
     body with `gh pr edit`. This creates new PRs as drafts and preserves existing PR
     review state. Add `--open` only when the user explicitly asks to mark every new and
     existing PR in the stack ready for review.
   - **Formal remote stack without local tracking:** push the branch through the normal
     commit workflow and update its existing PR with `gh pr edit`. Do not pass
     `--base $TRUNK` or call the flat-PR creation path; either would retarget or replace
     the linked layer.
   - **Explicit stack request with no stack yet:** follow `tbd shortcut stacked-prs` and
     the official `gh-stack` skill.
     Use `gh stack init` or `gh stack add` followed by `gh stack submit --auto`, or use
     `gh stack link` for existing PRs.
     Creating branch-based PRs without one of these formal stack operations does not
     satisfy the request.
   - If creating (not stacked):
     `gh pr create --repo $REPO --head $BRANCH --base $TRUNK --title "..." --body "..."`
   - If updating: `gh pr edit $BRANCH --repo $REPO --title "..." --body "..."` Do not
     add `--base` here unless you actually intend to retarget the PR.
   - After every stacked path, resolve the current `$PR_NUMBER` and repeat the remote
     `gh api "repos/$REPO/stacks?pull_request=$PR_NUMBER"` lookup from step 3. Stop if
     the call fails or returns empty; the formal GitHub stack is not verified.

7. Report the PR URL to the user, summarize the validation plan, and inform them you are
   now waiting for CI.

8. **Wait for CI to pass (CRITICAL):**
   - Run: `gh pr checks $BRANCH --repo $REPO --watch 2>&1`
   - **IMPORTANT**: The `--watch` flag blocks until ALL checks complete.
     Do NOT see “passing” in early output and move on—wait for the **final summary**
     showing all checks passed.
   - If CI fails: analyze the failure, fix the issue, commit and push the fix, then
     restart from this step.
   - Only proceed when you see all checks have passed in the final summary.

9. Confirm to the user that CI has passed and the PR is ready for review.
   The next lifecycle stages have their own shortcuts (see
   `tbd shortcut pr-review-workflows`): `tbd shortcut review-github-pr` reviews and
   publishes a review of the PR, and `tbd shortcut address-pr-review` addresses a review
   the PR receives.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
