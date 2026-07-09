---
title: Review GitHub PR
description: Review a GitHub pull request and publish the review to a chosen channel (formal review, PR comment, GitHub issue, or in-repo review doc). To fix the findings, see address-pr-review.
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut **reviews a GitHub pull request and publishes the review** as a durable
artifact. It covers stages 2-3 of the PR review lifecycle (see
`tbd shortcut pr-review-workflows`): it produces and posts the review, and it
deliberately does NOT fix the findings.
Addressing a review is a separate workflow, `tbd shortcut address-pr-review`, often run
by a different agent.

For reviewing **local changes** (uncommitted or branch work) without GitHub integration,
use `tbd shortcut review-code` directly.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **GitHub CLI setup:**
   - Verify: `gh auth status` (if issues, run `tbd shortcut setup-github-cli`)
   - Get repo:
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`
   - Use `--repo $REPO` on all gh commands

2. **Get the PR to review:**
   - If the user provided a PR number or URL, extract the PR number
   - If not specified, ask the user which PR to review
   - Get PR info:
     `gh pr view <PR_NUMBER> --repo $REPO --json number,title,body,author,url,headRefName`

3. **Check CI status:**
   - Run: `gh pr checks <PR_NUMBER> --repo $REPO`
   - Note any failing or pending checks for the review’s CI status section

4. **Check existing review context:**
   - Prior reviews and comments: `gh pr view <PR_NUMBER> --repo $REPO --comments` and
     `gh api repos/$REPO/pulls/<PR_NUMBER>/reviews`
   - Note unresolved findings from earlier reviews so your review references them
     instead of duplicating them
   - If your actual task is to FIX an existing review rather than write a new one, stop
     and run `tbd shortcut address-pr-review` instead

5. **Perform the code review:**
   - Run `tbd shortcut review-code` using the **GitHub PR** scope (diff via
     `gh pr diff <PR_NUMBER> --repo $REPO`)
   - This loads the general and language-specific guidelines and also checks
     documentation consistency (specs, architecture docs)

6. **Compile the review:**
   - Follow the review artifact format from `tbd shortcut pr-review-workflows` (scope,
     verdict, findings with stable IDs and severities, suggestions, false positives, CI
     status)
   - Include any documentation gaps and unresolved earlier review comments
   - Write the review body to a temp file so it can be posted with `--body-file`

7. **Publish the review:**

   Post to the channel the user asked for; default to a formal GitHub review.
   (If the user asked for “report only”, present the review and skip this step.)

   - **Formal GitHub review** (default):
     `gh pr review <PR_NUMBER> --repo $REPO --comment --body-file <file>`
   - **PR comment**: `gh pr comment <PR_NUMBER> --repo $REPO --body-file <file>`
   - **GitHub issue**:
     `gh issue create --repo $REPO --title "Review: PR #<PR_NUMBER> — <topic>" --body-file <file>`,
     then cross-link it with a short PR comment
   - **In-repo review doc**: write the review as a committed doc following the project’s
     conventions (e.g. `docs/project/reviews/review-YYYY-MM-DD-<topic>.md`), commit it
     on the repo’s default branch (not the PR branch), and post a short PR comment
     linking to it

8. **Hand off or stop:**
   - Reviewing ends here—do not start fixing findings in this workflow
   - If the user asked to review AND fix, now run `tbd shortcut address-pr-review` on
     the review you just published
   - Otherwise the published review is the handoff: any agent can later pick it up with
     `tbd shortcut address-pr-review`

9. **Report to user:**
   - Summary and verdict, finding count by severity
   - Where the review was published (URL)
   - CI status and the PR URL

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
