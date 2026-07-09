---
title: Address PR Review
description: Address an existing PR review from any channel—track every finding as a bead, fix or rebut each, reply with a per-finding disposition map, and get CI green
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut **addresses an existing review** of a pull request: a review that someone
else (agent or human) already published.
It is the counterpart of `tbd shortcut review-github-pr`, which creates and publishes
such reviews.
For the full lifecycle, the channels a review can arrive on, and the review
artifact format, see `tbd shortcut pr-review-workflows`.

The guarantee this workflow provides: **every finding is tracked as a bead and gets an
explicit disposition** (fixed, rebutted, or deferred)—nothing is silently dropped.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo:
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Use `--repo $REPO` on all gh commands

2. **Locate the review(s) to address:**
   - If the user pointed at a specific review (PR number, comment URL, issue number, or
     review-doc path), start there
   - Then sweep all channels for other unaddressed review content on the PR (see
     `tbd shortcut pr-review-workflows` for the channels):
     - Formal reviews: `gh api repos/$REPO/pulls/<PR_NUMBER>/reviews`
     - Inline review comments: `gh api repos/$REPO/pulls/<PR_NUMBER>/comments`
     - PR comments: `gh pr view <PR_NUMBER> --repo $REPO --comments`
     - GitHub issues referencing the PR:
       `gh issue list --repo $REPO --search "<PR_NUMBER>"`
     - In-repo review docs linked from the PR or its comments (e.g. under
       `docs/project/reviews/`)
   - Skip review content already answered by a later “Addressed … in `<commit>`” reply;
     a PR may have accumulated several reviews, so aggregate everything still
     unaddressed

3. **Parse the findings:**
   - Enumerate every finding with its ID, severity, `file:line` references, and
     suggested fix
   - Keep the reviewer’s IDs (R1..RN or 1..N); if a review has none, assign sequential
     IDs so your reply can reference them
   - Respect “False positives / do not fix” sections: these get no code change
   - Non-blocking “Suggestions” are optional: apply the cheap ones, and explicitly defer
     or decline the rest (they still appear in the disposition map)

4. **Create tracking beads:**
   - Parent bead:
     `tbd create "Address review: PR #<NUMBER> — <topic>" --type task --priority P1`
   - One child bead per finding:
     `tbd create "PR #<NUMBER> review <ID>: <finding>" --type bug --parent <parent-id>`
     with `file:line` references and the PR number in the description
   - Dedup first: `tbd search` for existing beads covering the same problem; if one
     exists, append the review context to it instead of creating a duplicate, and use
     that bead in the disposition map

5. **Check out the PR branch:**
   - `gh pr checkout <PR_NUMBER> --repo $REPO`
   - If the base branch has moved substantially, run `tbd shortcut merge-upstream` first
     so fixes land on a current branch

6. **Triage and address each finding, in severity order:**

   For each child bead, mark it in_progress, then choose one disposition:
   - **Fix**: make the change, following `tbd guidelines general-tdd-guidelines`; run
     the affected tests; close the bead
   - **Rebut**: if the finding is factually wrong or the suggested fix would make things
     worse, do NOT change the code; write a specific technical justification for the
     reply in step 8 and close the bead with `--reason`
   - **Defer**: if the finding is real but out of scope for this PR, leave the bead open
     and record where and when it should be handled

   If a finding offers “Fix (pick one):” options, choose one and record which and why.
   Never silently skip a finding.

7. **Verify and push:**
   - Run the full test suite and lint (see project docs for the exact commands)
   - Commit with conventional commit messages and push
   - Run `gh pr checks <PR_NUMBER> --repo $REPO --watch 2>&1` and wait for the **final
     summary**—do not stop at early “passing” output
   - If CI fails: analyze, fix, push, and restart this step

8. **Close the loop—publish the disposition map:**
   - Reply on the same channel the review arrived on, with a comment titled “Addressed
     the review findings in `<commit>`:” followed by one line per finding:
     - `<ID>: fixed — <what changed>`
     - `<ID>: rebutted — <why the finding does not apply>`
     - `<ID>: deferred — tracked as <bead-id>`
   - For formal reviews with inline threads: reply to and resolve each thread
   - For a review carried in a GitHub issue: post the disposition map there and close
     the issue if every finding is resolved
   - For an in-repo review doc: append a dated “Status Addendum” section (never rewrite
     the original findings) and commit it on the repo’s default branch, where the review
     doc lives—not the checked-out PR branch
   - Update the PR description if the fixes changed its scope

9. **Close out tracking:**
   - Close the parent bead once all children are fixed or rebutted (deferred children
     stay open under the parent or re-linked as appropriate)
   - Run `tbd sync`

10. **Report to user:**
    - The disposition map (finding ID → fixed/rebutted/deferred)
    - Beads created, closed, and left open
    - Commit SHAs, CI status, and the PR URL

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
