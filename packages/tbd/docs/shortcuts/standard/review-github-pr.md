---
title: Review GitHub PR
description: Review a GitHub pull request at a pinned head and publish the review with its header and marker, as a formal GitHub review by default or on the channel the user chose. Covers senior, dedicated (security, performance, correctness), and follow-up reviews. To fix the findings, see address-pr-review.
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut **reviews a GitHub pull request at a pinned head and publishes the
review** as a durable artifact.
It covers stages 2-3 of the PR review lifecycle: it produces and posts the review, and
it deliberately does NOT fix the findings.
Addressing a review is a separate workflow, `tbd shortcut address-pr-review`, often run
by a different agent.

Every review this shortcut publishes follows the review-state contract in
`tbd shortcut pr-review-workflows` (header and marker, lettered finding IDs, pinning,
channels, discovery sweep, and artifact format).
Read that contract first; the steps below apply it and do not restate it.

For reviewing **local changes** (uncommitted or branch work) without GitHub integration,
use `tbd shortcut review-code` directly.
Specific guidance from the user overrides every default in this shortcut.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo:
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Use `--repo $REPO` on all gh commands

2. **Get the PR and the request:**
   - If the user provided a PR number or URL, extract the PR number
   - If not specified, ask the user which PR to review
   - Get PR info:
     `gh pr view <PR_NUMBER> --repo $REPO --json number,title,body,author,url,headRefName,headRefOid,baseRefName`
   - From the request (or the coordinator’s brief), note:
     - the **review kind**: `senior` by default; `security`, `performance`, or
       `correctness` for a dedicated review; `follow-up` for another round after a
       review was addressed
     - the **channel**: a formal GitHub review by default, or the PR comment, GitHub
       issue, in-repo review doc, or “report only” the user asked for
     - the **reviewer configuration** to record: the requested tier, model, and
       reasoning level from the brief (see `tbd guidelines agent-model-tiers`), or this
       session’s actual model and reasoning level when no one delegated the review

3. **Pin the head:**
   - If a coordinator already pinned the PR (its brief gives the head and merge base),
     confirm `git rev-parse HEAD` equals that head, set `HEAD_SHA` and `BASE_SHA` from
     the brief, and do not switch the tree

   - Otherwise pin it yourself, following Pinning and the Working Tree in
     `tbd shortcut pr-review-workflows`:

     ```bash
     HEAD_SHA=$(gh pr view <PR_NUMBER> --repo $REPO --json headRefOid --jq .headRefOid)
     git status --porcelain            # must be empty before switching the tree
     gh pr checkout <PR_NUMBER> --repo $REPO
     git rev-parse HEAD                # must equal $HEAD_SHA
     git fetch origin <baseRefName>
     BASE_SHA=$(git merge-base origin/<baseRefName> $HEAD_SHA)
     ```

   - If the tree has uncommitted changes, or `HEAD` does not equal `HEAD_SHA` after
     checkout, stop and ask the user rather than reviewing the wrong tree

4. **Check CI status:**
   - Run: `gh pr checks <PR_NUMBER> --repo $REPO`
   - Note any failing or pending checks for the review’s CI status section

5. **Run the discovery sweep:**
   - Find all review content on the PR, as in Discovery Sweep in
     `tbd shortcut pr-review-workflows`:
     - Formal reviews: `gh api --paginate repos/$REPO/pulls/<PR_NUMBER>/reviews`
     - Inline review comments:
       `gh api --paginate repos/$REPO/pulls/<PR_NUMBER>/comments`
     - PR comments: `gh pr view <PR_NUMBER> --repo $REPO --comments`
     - GitHub issues referencing the PR:
       `gh issue list --repo $REPO --search "<PR_NUMBER>"`
     - In-repo review docs linked from the PR or its comments (for example under
       `docs/project/reviews/`)
   - Match reviews and disposition replies with markers (`tbd:review v=1`,
     `tbd:dispositions v=1`) by marker; read content without a marker
   - Record:
     - **letters already used:** the `id` of every review marker, plus the letter prefix
       of finding IDs in reviews without a marker (such as `R` in `R1`)
     - **the current round:** the highest `round` among review markers
     - **open findings:** the findings of every review not yet addressed, so your review
       references them by ID (or by review URL plus ID) instead of duplicating them
   - If your actual task is to FIX an existing review rather than write a new one, stop
     and run `tbd shortcut address-pr-review` instead

6. **Decide the review scope and dedicated reviews:**
   - **Senior or dedicated review:** the scope is the PR diff at the pinned head,
     `git diff $BASE_SHA $HEAD_SHA` (the same diff as `gh pr diff` while the head is
     unchanged). The first round is 1 and includes the dedicated reviews run with the
     senior review; a full re-review in a later round is one more than the current
     round.
   - **Follow-up review** (`kind=follow-up`): pick the review being followed up and read
     its marker’s `head` and `base` and its disposition reply.
     The scope is:
     - the fix commits since the reviewed head:
       `git log --oneline <reviewed-head>..$HEAD_SHA` and
       `git diff <reviewed-head> $HEAD_SHA`; if the branch was rebased or merged its
       base since then, compare with
       `git range-diff <reviewed-base>..<reviewed-head> $BASE_SHA..$HEAD_SHA` and say so
     - the disposition of every Blocker and High finding of that review: a `fixed`
       finding is really fixed and confirmed as claimed, a `rebutted` or `declined`
       finding is justified, and a `deferred` finding has an open bead
     - the whole PR instead only if the user asks for a full re-review
     - the round is one more than the round of the review being followed up
   - **Dedicated reviews:** under the `pr-review-requirements` policy (check
     `tbd policy show`; `standard` applies when nothing is recorded), decide whether the
     PR is sensitive in security, performance, or correctness, using the area lists in
     Review Coverage and Rounds in `tbd shortcut pr-review-workflows`:
     - State which areas apply and why; when it is unclear whether an area applies, ask
       the user
     - If the user asked for a dedicated review (“also do a security review”), or this
       run is a dedicated review, run it as its own review with its own letter and kind
       through this workflow; otherwise recommend the dedicated reviews that apply in
       the report

7. **Perform the review:**
   - Use the review engine for the kind, reading all surrounding code from the pinned
     working tree:
     - `senior`: `tbd shortcut review-code` with the **GitHub PR** scope
     - `follow-up`: `tbd shortcut review-code` on the follow-up scope from step 6
     - `security`: `tbd shortcut review-code-security`
     - `performance`: `tbd shortcut review-code-performance`
     - `correctness`: `tbd shortcut review-code-correctness`
   - These load the general, language, and topic guidelines and check documentation
     consistency (specs, architecture docs)
   - Run the test suite and targeted reproduction scripts to uncover bugs, unless the
     user says otherwise
   - Keep scratch files in the session scratch directory, do not commit or push, and
     leave the tree as you found it
   - **Report every finding with its severity** (Blocker, High, Medium, or Low, as
     defined in `tbd guidelines code-review-rules`); do not filter by severity
   - If the PR changes the policy block in `AGENTS.md`
     (`git diff $BASE_SHA $HEAD_SHA -- AGENTS.md` between the `TBD POLICY GRANTS`
     markers), report that as a finding naming each changed policy and value

8. **Compile the review:**
   - Choose a review letter not in the letters already used (step 5), chosen to keep
     reviews distinct across review cycles or components

   - Number findings with the letter (`A1`, `A2`, …); suggestions take IDs from the same
     sequence

   - Start the body with the hidden marker and visible header from Review Header and
     Marker in `tbd shortcut pr-review-workflows`:

     ```markdown
     <!-- tbd:review v=1 id=<letter> kind=<kind> pr=<PR_NUMBER> round=<round> head=<HEAD_SHA> base=<BASE_SHA> -->
     **Review <letter>** (<kind> review, round <round>) · head `<short HEAD_SHA>` · base `<baseRefName>` at `<short BASE_SHA>`
     Reviewer: <tier> tier, requested `<model>` at `<level>` · Channel: <channel>
     Coverage: <reviewed> of <changed> changed files; skipped <what, and why>
     Tests run: <commands and results>
     ```

     Use `senior engineering review` as the visible name of kind `senior`. When no one
     delegated the review, the reviewer line records this session’s actual model and
     reasoning level, and a review of fixes this same session wrote says that it is not
     independent.

   - Follow the header with the sections in Review Artifact Format: summary and verdict,
     findings (ID, severity, `file:line`, and a concrete **Fix:**), suggestions, false
     positives / do not fix, and CI status

   - Include any documentation gaps, and reference open findings from earlier reviews by
     their IDs

   - In a follow-up review, the summary names the review it follows up and its reviewed
     head, and a section lists each Blocker and High disposition checked and whether it
     holds; a disposition that does not hold becomes a finding with the new letter

   - Write the body to a file in the session scratch directory so it can be published
     from that file

9. **Re-check before publishing:**
   - Re-read the head:
     `gh pr view <PR_NUMBER> --repo $REPO --json headRefOid --jq .headRefOid`
   - If it no longer equals `HEAD_SHA`, either pin the new head as in step 3, review the
     new commits, and update the header (head, base, coverage, tests run), or publish
     against the older head and say so in the header
   - Re-check the letter immediately before publishing by repeating the formal review
     and PR comment sweeps from step 5; if another review took the letter, choose a new
     one and renumber the findings

10. **Publish the review:**

    Post to the channel from step 2, with the same header and marker on every channel.
    If the user asked for “report only”, present the review and skip this step.
    Publishing is a PR action that needs the `github-editing` grant (see Grants in the
    Review Workflows in `tbd shortcut pr-review-workflows`).

    - **Formal GitHub review** (default), pinned to the reviewed head with the `COMMENT`
      event and a textual verdict in the body, never GitHub approve or request-changes
      states:

      ```bash
      gh api --method POST repos/$REPO/pulls/<PR_NUMBER>/reviews \
        -f commit_id=$HEAD_SHA -f event=COMMENT -F body=@<file> --jq .html_url
      ```

    - **PR comment**: `gh pr comment <PR_NUMBER> --repo $REPO --body-file <file>`

    - **GitHub issue**:
      `gh issue create --repo $REPO --title "Review <letter>: PR #<PR_NUMBER>, <topic>" --body-file <file>`,
      then cross-link it with a short PR comment

    - **In-repo review doc**: write the review as a doc following the project’s
      conventions (for example `docs/project/reviews/review-YYYY-MM-DD-<topic>.md`),
      commit it on the repo’s default branch (not the PR branch, and without switching
      the pinned tree), and post a short PR comment linking to it.
      A reviewer that must not commit returns the doc to its coordinator to commit.

11. **Hand off or stop:**
    - Reviewing ends here.
      Do not start fixing findings in this workflow.
    - If the user asked to review AND fix, run `tbd shortcut review-and-merge-prs`,
      which addresses the review you just published
    - Otherwise the published review is the handoff: any agent can later pick it up with
      `tbd shortcut address-pr-review`

12. **Report:**
    - To the user: summary and verdict, the review letter and kind, finding count by
      severity, where the review was published (URL), the pinned head and whether it
      moved, CI status, the PR URL, and the dedicated reviews that apply and why (or the
      question about an unclear area)
    - When run by a coordinator: return a condensed summary instead of the full body:
      the letter, kind, round, head, verdict, finding count by severity, the IDs of
      Blocker and High findings, dedicated reviews that apply, and the review URL

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
