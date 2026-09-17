---
title: Address PR Review
description: Address existing PR reviews from any channel. Track every finding as a bead, give each one of four dispositions (fixed, rebutted, declined, deferred) with its evidence, post a marked disposition reply per review, and get CI green
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut **addresses an existing review** of a pull request: a review that someone
else (agent or human) already published.
It is the counterpart of `tbd shortcut review-github-pr`, which creates and publishes
such reviews. For the full lifecycle and the **review-state contract** (review markers,
lettered finding IDs, the four dispositions and their evidence, disposition replies, and
the discovery sweep), see `tbd shortcut pr-review-workflows`. This shortcut follows that
contract and does not restate all of it.

The guarantee this workflow provides: **every finding is tracked as a bead and gets
exactly one disposition** (fixed, rebutted, declined, or deferred) with its required
evidence, and every review gets a marked disposition reply that lists all its findings.
Nothing is silently dropped.

When a coordinator runs this shortcut through a sub-agent (see
`tbd shortcut review-and-merge-prs` and `tbd shortcut delegate-to-subagents`), you are
the **addressing agent**: the sole committer on the PR branch, working in the tree, at
the head, and on the review letters the brief names.
You escalate the decisions listed in step 6 and end with the condensed coordinator
report (step 10).

## Instructions

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo:
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Use `--repo $REPO` on all gh commands

2. **Locate the review(s) to address:**
   - If the user or the coordinator’s brief pointed at a specific review (review letter,
     PR number, review or comment URL, issue number, or review-doc path), start there
   - Then run the discovery sweep from `tbd shortcut pr-review-workflows` for other
     review content on the PR:
     - Formal reviews: `gh api --paginate repos/$REPO/pulls/<PR_NUMBER>/reviews`
     - Inline review comments:
       `gh api --paginate repos/$REPO/pulls/<PR_NUMBER>/comments`
     - PR comments: `gh pr view <PR_NUMBER> --repo $REPO --comments`
     - GitHub issues referencing the PR:
       `gh issue list --repo $REPO --search "<PR_NUMBER>"`
     - In-repo review docs linked from the PR or its comments (for example under
       `docs/project/reviews/`), including their status addenda
   - **Match by marker.** A review carries `<!-- tbd:review v=1 id=<letter> ... -->`,
     and a disposition reply carries
     `<!-- tbd:dispositions v=1 review=<letter> head=<40-hex> -->`. A review is
     addressed when a later disposition reply for its letter lists every one of its
     findings. Reply titles do not matter: a reply titled “Addressed …” without a marker
     does not address a marked review, and a marked reply needs no particular title
   - Content without a marker is matched by reading: an unmarked review is addressed
     when a later reply clearly gives every one of its findings a disposition
   - A PR may have accumulated several reviews; aggregate every review not yet
     addressed. If a brief names specific review letters, address those, and report any
     other unaddressed review content the sweep found rather than silently ignoring it

3. **Parse the findings:**
   - Enumerate every finding and every suggestion with its ID, severity, `file:line`
     references, and suggested fix
   - **Marked reviews:** keep the lettered IDs (`A1`, `A2`, `B1`). Suggestions take IDs
     from the same sequence and receive dispositions the same way as findings
   - **Unmarked reviews:** keep the reviewer’s own IDs (R1..RN or 1..N) and reference
     each finding by review URL plus ID, since those IDs are not unique on the PR; if a
     review has no IDs, assign sequential IDs in reading order and say so in the reply
   - A partially addressed review (an earlier disposition reply that does not list every
     finding) is still open: carry forward the dispositions that still hold, so the new
     reply lists every finding
   - Respect “False positives / do not fix” sections: those items were confirmed benign,
     so they get no code change and no disposition
   - Note any two findings that conflict (fixing one would undo or contradict the
     other); they are escalated in step 6

4. **Create tracking beads:**
   - Parent bead:
     `tbd create "Address PR #<NUMBER> review <letter>: <topic>" --type task --priority P1`
     (name every review letter the parent covers)
   - One child bead per finding or suggestion:
     `tbd create "PR #<NUMBER> <ID>: <finding>" --type bug --parent <parent-id>` with
     `file:line` references, the severity, the PR number, and the review URL in the
     description. For an unmarked review, put the review URL next to the ID in the title
     as well
   - If the brief names existing beads for these findings, use them instead of creating
     new ones
   - Dedup first: `tbd search` for existing beads covering the same problem; if one
     exists, append the review context to it instead of creating a duplicate, and use
     that bead in the disposition reply

5. **Check out the PR branch:**
   - If a coordinator already checked out the pinned head, work in that tree: confirm
     `git status --porcelain` is empty and `git rev-parse HEAD` equals the head SHA in
     the brief, and stop and report if either check fails; the stack checks below still
     apply

   - Set `$PR_NUMBER` to the PR selected in step 2, then run
     `gh pr checkout "$PR_NUMBER" --repo "$REPO"`

   - Resolve the checked-out branch and PR metadata:

     ```bash
     BRANCH=$(git branch --show-current)
     PR_URL=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json url --jq .url)
     ```

     Stop if either command fails.

   - Check local stack tracking with `gh stack view --json`. Exit 0 with a stack
     containing `$BRANCH` means the branch is locally tracked.
     Exit 2 means only that it is not tracked locally.
     For any other nonzero exit, including a missing `gh stack`, stop and run
     `tbd shortcut setup-github-cli`.

   - Check the authoritative formal membership on GitHub:

     ```bash
     REMOTE_STACK_NUMBER=$(gh api \
       "repos/$REPO/stacks?pull_request=$PR_NUMBER" \
       --jq '.[0].number // empty')
     ```

     Stop if this API call fails; do not treat an unavailable check as proof that the PR
     is unstacked. A nonempty result means the PR belongs to a formal GitHub stack, even
     when the local check exits 2.

   - If the PR belongs to a remote-only formal stack, apply the official skill’s
     checkout-conflict preflight before `gh stack checkout "$PR_URL"`: if any target
     branch is tracked in a different local stack, switch to a non-shared branch in that
     stack and run `gh stack unstack --local`, then return to this branch.
     If you cannot prove the checkout is conflict-free or safely remove the conflicting
     local tracking, stop instead of invoking a command that can prompt indefinitely.
     Stop if checkout fails or a subsequent `gh stack view --json` does not contain
     `$BRANCH`; do not merge or reconstruct the chain by hand.

   - If either the local or remote check identifies a stack, the checkout lands you
     mid-stack. Land each fix on the layer that owns the code, never on whichever layer
     happens to be checked out.
     If the stack needs the latest trunk, run `gh stack sync`, not `merge-upstream`; it
     force-pushes (`--force-with-lease`) the whole chain.
     Capture and inspect the sync’s combined output: a divergent non-interactive sync
     can print `Sync aborted — no changes were made` and exit 0. Treat any
     `Sync aborted` output as failure, resolve the divergence using the official skill,
     retry, and require a final `gh stack view --json` containing `$BRANCH`. After
     committing, run `gh stack rebase --upstack` so the layers above pick up the change.
     CI on the upper PRs means nothing until that rebase happens.

   - Only when local tracking is absent and `$REMOTE_STACK_NUMBER` is empty may you run
     `tbd shortcut merge-upstream` if the base branch has moved substantially.

6. **Triage and address each finding, in severity order:**

   For each child bead, claim it with `tbd start <id>`.

   **Escalate first.** Stop and escalate to the coordinator (or to the user, when no
   coordinator delegated this work) instead of deciding alone when:
   - a fix requires a design decision;
   - you would rebut or decline a Blocker or High finding;
   - two findings conflict.

   Report the finding IDs, the options, and your recommendation, and leave the escalated
   bead open. The coordinator decides, delegates the question to a strong-tier sub-agent,
   or asks the user. You may address the other findings meanwhile, but do not post the
   disposition reply for that review until the escalation is decided.

   Otherwise give the finding exactly one of the four dispositions defined in
   `tbd shortcut pr-review-workflows`, with its required evidence:
   - **`fixed`**: the problem is corrected, as suggested or equivalently.
     Make the change and confirm it: where the problem is repeatable, with an automated
     test following `tbd guidelines general-tdd-guidelines` (it fails before the fix and
     passes after); when automation is very difficult, with a manual test script or
     runbook written with `tbd shortcut new-qa-playbook` and run.
     Evidence: the commit SHA, what changed, and the test or runbook that confirmed it.
     Close the bead
   - **`rebutted`**: the finding is technically incorrect: the problem does not exist,
     or the suggested fix would make things worse.
     Do NOT change the code.
     Evidence: a specific technical justification, such as `file:line` references, test
     output, or a reproduction.
     Close the bead with `--reason`
   - **`declined`**: not acted on, even if valid in isolation, because it goes against
     other project guidelines, reflects a misunderstanding of the PR’s scope, or is not
     worth the change (a common fit for suggestions).
     Evidence: the reason, citing the guideline, the PR’s stated scope, or the cost.
     Close the bead with `--reason`
   - **`deferred`**: valid and worth doing, but outside this PR. Evidence: the open bead
     ID and what the work waits on (another PR, a design decision, a dependency), not a
     date. Leave the bead open, or link it to an existing open bead that covers the work

   If a finding offers “Fix (pick one):” options, choose one and record which and why.
   Never silently skip a finding or suggestion.

7. **Verify and push:**
   - Run the full test suite and lint (see project docs for the exact commands)
   - Commit with conventional commit messages and push; record each fix commit’s SHA for
     its `fixed` line
   - Record the new head SHA:
     `gh pr view <PR_NUMBER> --repo $REPO --json headRefOid --jq .headRefOid` must equal
     `git rev-parse HEAD`
   - Run `gh pr checks <PR_NUMBER> --repo $REPO --watch 2>&1` and wait for the **final
     summary**; do not stop at early “passing” output
   - Record the CI run IDs for that head:
     `gh run list --repo $REPO --commit <head-sha> --json databaseId,name,conclusion`
   - If CI fails: analyze, fix, push, and restart this step

8. **Close the loop: publish the disposition replies:**

   Post one disposition reply per review, on the same channel the review arrived on, in
   the marked format from `tbd shortcut pr-review-workflows`. `head` is the full head
   SHA from step 7, and the reply lists every finding and suggestion of the review,
   including dispositions carried forward from an earlier reply:

   ```markdown
   <!-- tbd:dispositions v=1 review=A head=<40-hex> -->
   **Dispositions for review A** at `abc1234`
   - A1: fixed in `abc1234`: <what changed>; confirmed by <test name>
   - A2: rebutted: <why the finding does not apply, with file:line evidence>
   - A3: declined: <guideline, scope, or cost reason>
   - A4: deferred: tracked as <bead-id>, waiting on <dependency>
   ```

   - For an unmarked review, which has no letter for the marker, use the same line
     format, name the review URL in the heading, and keep the reviewer’s IDs in each
     line
   - Write each reply body to a file in the session scratch directory and post it with
     `--body-file`
   - For a formal review or a PR comment: post the reply as a PR comment
     (`gh pr comment <PR_NUMBER> --repo $REPO --body-file <file>`); for formal reviews
     with inline threads, also reply to each thread with its ID and disposition and
     resolve it
   - For a review carried in a GitHub issue: post the reply there
     (`gh issue comment <ISSUE_NUMBER> --repo $REPO --body-file <file>`) and close the
     issue if no finding is deferred
   - For an in-repo review doc: append a dated “Status Addendum” section containing the
     marked reply (never rewrite the original findings) and commit it on the repo’s
     default branch, where the review doc lives, not the checked-out PR branch
   - Record each reply URL
   - Update the PR description if the fixes changed its scope

9. **Close out tracking:**
   - Close the parent bead once every child has a disposition and the replies are
     posted: `fixed`, `rebutted`, and `declined` children are closed, and `deferred`
     children stay open (under the parent or re-linked as appropriate)
   - Run `tbd sync`, unless the coordinator’s brief reserves syncing for the coordinator

10. **Report:**

    To the user, report:
    - the dispositions per review letter (finding ID to fixed, rebutted, declined, or
      deferred);
    - beads created, closed, and left open;
    - escalations and how they were resolved;
    - commit SHAs, CI status, reply URLs, and the PR URL.

    To a coordinator, return only this condensed report, not the reply bodies:
    - PR URL, the review letters addressed, and the review URLs;
    - the new head SHA (full) and the fix commit SHAs;
    - the CI run IDs and their final status;
    - the disposition reply URLs;
    - per finding ID, its disposition, with the bead ID for each deferral;
    - parent and child bead IDs, and which are left open;
    - open escalations, and any unaddressed review content the sweep found outside the
      brief;
    - the changed files, and anything not verified.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
