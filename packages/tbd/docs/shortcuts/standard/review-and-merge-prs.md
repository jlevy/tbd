---
title: Review and Merge PRs
description: Orchestrate the PR review lifecycle for one request, per PR. Pin the head, get the PR reviewed at that head (senior plus dedicated reviews), get every finding addressed, decide on another round, check the merge gate, and merge with the repository's merge method. Three modes (fix, merge-ready, merge); sub-agents by role and tier, or one session; several PRs one at a time or in worktrees. Defines the merge gate.
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut **runs the PR review lifecycle end to end for one request**: for each PR
it pins the head, gets the PR reviewed at that head, gets every finding addressed,
decides whether another round is needed, checks the merge gate, and merges when the
request authorizes it.
It is stage 5 of the lifecycle in `tbd shortcut pr-review-workflows`, and it runs stages
2 to 4 through `tbd shortcut review-github-pr` and `tbd shortcut address-pr-review`.

Every artifact follows the review-state contract in `tbd shortcut pr-review-workflows`
(header and marker, lettered finding IDs, dispositions, disposition replies, pinning,
and the discovery sweep).
Read that contract first; this shortcut applies it and does not restate it.
The merge gate (step 5) is defined here, and `pr-review-workflows` points to it.

You are the **coordinator**, the user’s session.
Reviewing and addressing go to sub-agents by the roles and tiers in Roles in
`tbd shortcut pr-review-workflows`, spawned as `tbd shortcut delegate-to-subagents`
describes; without sub-agents, this session does each step in order (see Without
Sub-Agents). Specific guidance from the user overrides every default in this shortcut.

## Modes

The request picks the mode, and the mode picks the last step that runs.
The full routes, and the user guidance that changes the defaults (channel, review kinds,
rounds, working tree, grants), are in Request Vocabulary in
`tbd shortcut pr-review-workflows`.

| Mode | Request | Runs | Done when |
| --- | --- | --- | --- |
| fix | “Review and fix PR #N” | Steps 1 to 4, then 7 | One review round and its addressing are complete, and the user has been asked about another round if one looks necessary |
| merge-ready | “Get PR #N merge-ready” | Steps 1 to 5, then 7 | As in fix mode, and the merge gate passes at the current head; no merge |
| merge | “Make sure PR #N is reviewed and merged” | Steps 1 to 7 | As in merge-ready mode, and the PR is merged |

A request in other words gets the mode whose end state it names; when the end state is
unclear, ask.

## Who Runs Each Step

| Step | Who | Tier |
| --- | --- | --- |
| 1. Prepare | Coordinator, inline; a fast-tier sub-agent only to collect state across several PRs | fast, when delegated |
| 2. Review | One fresh sub-agent per review: the senior review, then each dedicated review, in sequence in the tree | strong |
| 3. Address | One fresh sub-agent per PR, the sole committer on its branch | moderate |
| 4. Another round | Coordinator decides and asks; an approved round is a follow-up review and step 3 again | strong, for the review |
| 5. Merge gate | Coordinator, inline |  |
| 6. Merge | Coordinator, inline |  |
| 7. Close out | Coordinator; a fast-tier sub-agent only for bookkeeping across several PRs | fast, when delegated |

Vendor guidance generally keeps critical-path work in the main session and delegates
side tasks; this workflow delegates the review and the fix on purpose, so that each runs
in fresh context at its tier, and the coordinator waits for them.
Whether to delegate at all, and what stays inline, follows When to Delegate in
`tbd shortcut delegate-to-subagents`: `gh` reads, `tbd policy show`, and the sweep for
one PR run inline, never in a sub-agent, and for a small PR the single-session path
(Without Sub-Agents) is often the better choice even when sub-agents are granted.

## Instructions

Create a to-do list with the following items then perform all of them, for each PR (see
Several PRs when the request names more than one):

1. **Prepare:**
   - Verify `gh auth status` (if issues, run `tbd shortcut setup-github-cli`), get the
     repo with
     `REPO=$(git remote get-url origin | sed -E 's#.*/git/##; s#.*github.com[:/]##; s#\.git$##')`,
     and use `--repo $REPO` on all gh commands

   - Read the request: the mode (see Modes), the PR numbers (ask if none), and any
     guidance that changes the defaults.
     Keep the user’s authorizing words verbatim for the briefs

   - Check the grants with a fresh fetch of the default branch, then `tbd policy show`,
     applying the precedence in `tbd guidelines agent-policy-grants` (only the user’s
     own messages override the recorded block):

     ```bash
     git fetch origin "$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo main)"
     tbd policy show
     ```

     The request needs:
     - `github-editing` in every mode, for publishing reviews, pushing fixes, and
       posting replies;
     - `github-merge` in merge mode: `per-request` is satisfied by a request that names
       this PR; with `not-granted` or unanswered, the user confirms before the merge;
       `unconditional` needs nothing more;
     - `subagents` to delegate, checked and recorded as in Check Authorization in
       `tbd shortcut delegate-to-subagents`;
     - `pr-review-requirements` decides the reviews and rounds required: `standard` (the
       default) or a value with additions such as `standard + security` or
       `standard + 2 rounds`

   - Ask for every grant the mode will need in one message, before the first GitHub
     mutation, and offer to record standing grants (Grants in the Review Workflows in
     `tbd shortcut pr-review-workflows`)

   - Track the request:
     `tbd create "PR #<N> (<mode>): <title>" --type task --priority P1` and
     `tbd start <id>`. The addressing agent’s per-finding beads hang under its own
     parent bead (step 4 of `address-pr-review`)

   - Pin the PR, following Pinning and the Working Tree in
     `tbd shortcut pr-review-workflows`:

     ```bash
     git status --porcelain        # must be empty; if not, stop and ask, never switch a dirty tree
     gh pr view <N> --repo $REPO --json title,url,isDraft,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus,reviewDecision
     gh pr checkout <N> --repo $REPO
     git rev-parse HEAD            # must equal headRefOid; record it as HEAD_SHA
     git fetch origin <baseRefName>
     BASE_SHA=$(git merge-base origin/<baseRefName> HEAD)
     ```

   - Record the CI state (`gh pr checks <N> --repo $REPO`) and the stack membership
     (`gh stack view --json` and `gh api "repos/$REPO/stacks?pull_request=<N>"`, as in
     step 5 of `address-pr-review`; a missing `gh stack` means not tracked locally); for
     a stack layer, note the layers below it

   - If `tbd policy show` reports that the working tree `AGENTS.md` differs from the
     default branch at this pinned head, tell the user before step 2: the PR proposes
     policy changes and must not merge them without named confirmation

   - Run the discovery sweep (Discovery Sweep in `tbd shortcut pr-review-workflows`) and
     record the letters used, the current round, the open findings, and any unmarked
     review content. A marked senior review whose `head` equals `HEAD_SHA` is this
     round’s senior review, so step 2 does not publish another; older unaddressed
     reviews and unmarked content are addressed in step 3 together with the new reviews

   - Record for the briefs: the PR number and URL, `HEAD_SHA`, `BASE_SHA`, the base
     branch, the tree path, the CI state, the letters used, the round, and the open
     findings

   - Move on when the tree is clean at `HEAD_SHA` and every grant the mode needs is
     answered

2. **Review (strong tier):**
   - Decide the dedicated reviews: those the policy value requires, those the user asked
     for, and, under `standard`, one for each area the PR is sensitive in, judged from
     the changed files and the PR description against the area lists in Review Coverage
     and Rounds in `tbd shortcut pr-review-workflows`. State which apply and why; when
     unclear, ask the user.
     Add any the senior review recommends in its report

   - For each review, the senior review first and then each dedicated review, spawn a
     fresh strong-tier reviewer (Assign Tiers and Spawn in `delegate-to-subagents`) with
     a brief per Write a Self-Contained Brief there: run `tbd shortcut review-github-pr`
     with the review kind; the pinned inputs (PR, `HEAD_SHA`, `BASE_SHA`, tree path,
     letters used, round); the channel; the tier, model, and reasoning level to record
     in the header; that it may run tests but does not commit or push and leaves the
     tree as it found it; and the condensed report from step 12 of `review-github-pr`

   - Reviews run in sequence in the tree, because they share it and each may run tests;
     do not change the tree while a reviewer works in it

   - Verify each review before starting the next: it exists, carries its marker with the
     expected `id`, `kind`, `pr`, `round`, and `head=HEAD_SHA`, and is bound to that
     head:

     ```bash
     gh api --paginate repos/$REPO/pulls/<N>/reviews \
       --jq '.[] | select(.body | contains("<!-- tbd:review v=1 id=<letter> ")) | {commit_id, html_url}'
     ```

     `commit_id` must equal `HEAD_SHA`. On another channel, check the artifact where the
     report says it is. Re-read `headRefOid`; if the head moved, re-pin and re-scope
     (Handle Failure in `delegate-to-subagents`)

   - Record per review: letter, kind, round, URL, findings by severity, and the Blocker
     and High IDs

3. **Address (moderate tier):**
   - Spawn one fresh moderate-tier addressing agent for the PR, the sole committer on
     its branch, with a brief: run `tbd shortcut address-pr-review` for the letters of
     this round and any other unaddressed content the sweep found; the pinned inputs
     (PR, `HEAD_SHA`, tree path, review letters and URLs); that it commits and pushes to
     the PR branch and posts the disposition replies, and does not run `tbd sync`
     (reserved for the coordinator); the escalation rule; the interruption brief from
     Brief Delegated Agents for Interruption in
     `tbd guidelines agent-run-operations-rules`; and the condensed report from step 10
     of `address-pr-review`
   - On an escalation (a design decision, a Blocker or High finding it would rebut or
     decline, or two conflicting findings): decide, delegate the question to a
     strong-tier sub-agent, or ask the user, then continue the same sub-agent with the
     answer
   - Verify before moving on (Verify Every Claim in `delegate-to-subagents`):
     - the reported head is the PR head and is on the remote:
       `gh pr view <N> --repo $REPO --json headRefOid` and
       `git ls-remote origin <headRefName>` agree;
     - the fix commits contain the claimed changes:
       `git log --oneline $HEAD_SHA..<new-head>` and `git diff $HEAD_SHA <new-head>`;
     - required checks are final and green at the new head: `gh pr checks <N>` shows
       none pending, and `gh run list --repo $REPO --commit <new-head>` concluded
       `success`;
     - a disposition reply for every review of this round lists every finding: repeat
       the sweep;
     - every inline comment posted since the pinned head is answered (thread reply or
       listed under its URL in the PR-comment disposition reply);
     - every deferral’s bead is open: `tbd show <id>`;
     - the tree is clean at the new head: `git status --porcelain` and
       `git rev-parse HEAD`
   - Re-pin: `HEAD_SHA` is now the new head

4. **Decide on another round (coordinator):**
   - Rounds required up front (the user’s “two rounds”, or the policy’s `N rounds`) run
     without asking
   - Otherwise check the signals in Review Coverage and Rounds in
     `tbd shortcut pr-review-workflows`; an update from the base branch that resolved a
     conflict is also a signal (see Several PRs).
     If any signal applies, tell the user which and ask.
     In fix mode the request is done once the question is asked (step 7); in the other
     modes wait for the answer, because the gate needs it
   - An approved round: a fresh strong-tier reviewer publishes a follow-up review
     (`kind=follow-up`, new letter, round plus one) of the fix commits since the
     reviewed head and of the Blocker and High dispositions, or a full re-review when
     the user asks for one; verify it as in step 2, address it as in step 3, then return
     to this step
   - Fix mode ends here

5. **Merge gate (merge-ready and merge modes):**

   This is the authoritative merge gate.
   Check every condition at the moment of merging, from fresh reads, not from state
   recorded earlier. Immediately before `tbd policy show`, run
   `git fetch <remote> <default-branch>` (read-only) so the ref is not stale:

   - The `pr-review-requirements` policy is met: under `standard`, a senior engineering
     review at a pinned head and a pass addressing all its findings, plus each dedicated
     review the PR’s sensitive areas call for, plus any rounds the user requested or
     approved. Check: the letters recorded in steps 2 and 4 cover every required kind and
     round, and each was verified bound to the head it names.
   - Every finding has a disposition, and every deferral has an open bead.
     Check: the sweep shows a disposition reply per letter that lists every finding, and
     `tbd show` on each deferral’s bead.
   - No review content newer than the last disposition reply is unaddressed.
     Check: repeat the sweep now.
   - The PR does not change the policy block
     (`git diff $BASE_SHA $HEAD_SHA -- AGENTS.md` shows no change between the
     `TBD POLICY GRANTS` markers), or the user confirmed each changed policy and value
     by name in this request; a merge never records a grant the user did not make.
     Check: `git diff $BASE_SHA $HEAD_SHA -- AGENTS.md` and the request.
   - Any question to the user about another round has been answered.
     Check: the conversation; an unanswered question fails the gate.
   - The head is unchanged since the final CI run, and required checks are final and
     green for that head.
     Check: `gh pr view <N> --repo $REPO --json headRefOid` equals `HEAD_SHA`;
     `gh pr checks <N> --repo $REPO` shows every required check passed and none pending;
     `gh run list --repo $REPO --commit $HEAD_SHA` runs concluded `success`.
   - GitHub reports the PR mergeable, with no blocking review state.
     Check:
     `gh pr view <N> --repo $REPO --json isDraft,mergeable,mergeStateStatus,reviewDecision`
     gives `mergeable` `MERGEABLE`, `mergeStateStatus` `CLEAN`, and `reviewDecision`
     other than `CHANGES_REQUESTED`. `BEHIND` means the base moved and `DIRTY` (or
     `mergeable` `CONFLICTING`) means conflicts: the addressing agent updates the PR
     from its base (`tbd shortcut merge-upstream`, or `gh stack sync` for a stack), CI
     must pass again at the new head, and a conflict resolution returns to step 4.
     `BLOCKED` is a branch-protection block (step 6). A draft is marked ready
     (`gh pr ready <N> --repo $REPO`) in merge mode only, since the user asked for the
     merge; in merge-ready mode report that it is a draft.
   - For a stack layer, every layer below has merged.
     Check: `gh stack view --json` shows no open layer below this one, and the PR’s
     `baseRefName` is the trunk.
   - In merge mode, the `github-merge` policy permits this merge: the user’s request
     named this PR (`per-request`), or the user confirmed it when asked (`not-granted`
     or unanswered), or an effective `unconditional` grant exists.
     Check: `tbd policy show` and the request.
     A confirmation covers one PR in one request and is never carried to another PR.

   Merge-ready mode ends here: report that the gate passes at `HEAD_SHA`, or which
   conditions fail and what would satisfy them (step 7).

6. **Merge (merge mode only):**
   - Use the repository’s merge method.
     Read what it allows:
     `gh api repos/$REPO --jq '{merge_commit: .allow_merge_commit, squash: .allow_squash_merge, rebase: .allow_rebase_merge}'`.
     If exactly one method is allowed, use it; if several, use the one the project’s
     contributing docs name, and ask when they name none.
     Never `--admin`, and never `--auto` as a way past a pending check

   - Merge at the gated head, so a head that moved after the gate fails instead of
     merging unreviewed commits:

     ```bash
     gh pr merge <N> --repo $REPO --<merge|squash|rebase> --match-head-commit $HEAD_SHA
     ```

   - For a formal stack, `gh stack merge` is all-or-nothing
     (`tbd shortcut stacked-prs`): the gate must pass for every layer first, then
     `gh stack merge <target> --yes`. Under `per-request`, a stack merge needs the
     request to name, or the user to confirm, every layer the merge will include;
     otherwise stop and ask, since the lower layers cannot be excluded.

   - A branch-protection block (`mergeStateStatus` `BLOCKED`, or a refusal naming a
     required approval, a required check, or a merge queue the author’s account cannot
     satisfy) is reported to the user with what is required and who can give it; it is
     never bypassed

   - Verify: `gh pr view <N> --repo $REPO --json state,mergedAt,mergeCommit` shows
     `MERGED` and the merge commit SHA

   - With several PRs, re-pin the remaining ones after each merge (see Several PRs)

7. **Close out:**
   - Clean up as in Clean Up in `delegate-to-subagents` (worktrees with
     `git worktree remove <path>`, idle sub-agents), and return the shared tree to the
     branch it was on
   - Close the request beads (`tbd close <id> --reason "..."`) and run `tbd sync`; never
     kill a running sync
   - Report per PR: the mode and end state; each review’s letter, kind, round, and URL;
     the disposition of every finding, with the bead ID for each deferral; the rounds
     run, and the questions asked and their answers; the tier, model, and reasoning
     level requested for each delegated task (or this session’s own, without
     sub-agents); the CI run IDs at the final head; the merge commit, or the gate result
     in merge-ready mode, or the pushed head in fix mode; any branch-protection block;
     and anything not verified

## Several PRs

- **One at a time by default.** The shared tree holds one PR head at a time, so run
  steps 1 to 6 for each PR in the order given (bottom-up for a stack) before starting
  the next.

- **Worktrees for parallel work.** When the user asks for parallel work or authorizes
  sub-agents for several PRs in one request, each PR gets its own worktree, shared by
  that PR’s reviewer and addressing agent (Split the Work by Role and Order in
  `delegate-to-subagents`). Create it from the main tree, which stays on its own branch
  and never has a PR branch checked out, because git refuses to check one branch out in
  two worktrees:

  ```bash
  git worktree add <path> --detach      # for example ../<repo>-pr-<N>, outside the repository
  cd <path> && gh pr checkout <N> --repo $REPO && git rev-parse HEAD   # must equal headRefOid
  ```

  Pin and sweep each PR in its worktree (step 1), and brief each sub-agent with its
  worktree path. Bead data is shared across worktrees; the coordinator syncs once, at the
  end.

- **Merges one at a time.** In merge mode, each PR passes steps 5 and 6 in turn.
  After each merge the base has moved: re-pin every remaining PR (step 1), and if GitHub
  reports it `BEHIND` or conflicting, the addressing agent updates it from the base and
  CI must pass again at the new head; a conflict resolution is a signal for another
  round (step 4).

- **Overlapping files.** When the request’s PRs touch the same files, each reviewer’s
  brief says so, and the PRs merge in dependency order with the later one re-addressed
  after the earlier merges.

- **Remove each worktree** when its PR is done, as in Clean Up in
  `delegate-to-subagents`.

## Without Sub-Agents

Without sub-agents, because `subagents` is not granted, the platform has none, or the
work is too small to split, this session performs every step in order with the same
artifacts (Single-Agent Fallback in `tbd shortcut delegate-to-subagents`): run
`tbd shortcut review-github-pr` for each review, then `tbd shortcut address-pr-review`,
in the shared tree, one PR at a time.
The review header records this session’s actual model and reasoning level, and a review
of fixes this same session wrote says that it is not independent.
The verification in each step still applies to your own artifacts: run the same commands
before moving on.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
