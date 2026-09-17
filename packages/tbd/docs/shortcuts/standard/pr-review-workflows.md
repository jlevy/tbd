---
title: PR Review Workflows
description: The PR review lifecycle and the review-state contract every review shortcut uses (pinned review headers and markers, lettered finding IDs, four dispositions, disposition replies), plus request routes, review coverage and rounds, roles, and the merge gate. Start here to pick the right review shortcut.
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This is the **map of the PR review lifecycle** and the **single definition of the
review-state contract**: the stages a code review moves through, which shortcut runs
each stage, and the conventions that let one agent write a review and a different agent
address it later. The other review shortcuts link here rather than restating the
contract.

Read this before writing or addressing any PR review, or whenever you need to pick the
right review shortcut.
Specific guidance from the user overrides every default in this shortcut.

## The Lifecycle

A PR review moves through distinct stages, each with its own shortcut.
Reviewing and addressing are **decoupled on purpose**: they are often done by different
agents in different sessions, and the published review artifact is the handoff between
them.

| Stage | What happens | Shortcut |
| --- | --- | --- |
| 1. Prepare the PR | Work committed and pushed, PR created or updated, CI green | `code-review-and-commit` (commit and push), then `create-or-update-pr-simple` or `create-or-update-pr-with-validation-plan` |
| 2. Review | A reviewer (agent or human) pins the PR head, reviews the diff, and compiles findings with lettered IDs | `review-github-pr` (wraps `review-code`); dedicated reviews use `review-code-security`, `review-code-performance`, or `review-code-correctness` |
| 3. Publish | The review is posted with its header and marker on one channel, a formal GitHub review pinned to the head by default (see below) | final steps of `review-github-pr` |
| 4. Address | An agent (often a different one) picks up the published review, tracks every finding as a bead, gives each finding one of four dispositions, and posts a disposition reply | `address-pr-review` |
| 5. Round and merge | The coordinator decides whether another round looks necessary (asking the user first), checks the merge gate, and merges when authorized | `review-and-merge-prs` |

The core review engine is `tbd shortcut review-code`, which reviews any diff
(uncommitted changes, branch work, or a GitHub PR). `review-code-typescript` and
`review-code-python` are narrower, language-only variants; `review-code` itself loads
the same language guidelines, so use the variants only when a language-scoped review is
explicitly wanted.

Pre-commit reviews (`tbd shortcut precommit-process`) use `review-code` directly and fix
issues immediately—the publish and address stages apply to reviews of pushed PRs, where
the review and the fix are separate pieces of work.

To run several stages for one request, use `tbd shortcut review-and-merge-prs`. To run
the reviewer and addressing roles in sub-agents, follow
`tbd shortcut delegate-to-subagents`.

## Request Vocabulary

Each supported request routes to one shortcut and has a defined end state:

| Request | Shortcut | Done when | Side effects |
| --- | --- | --- | --- |
| “Review PR #N” | `review-github-pr` | One senior engineering review is published at a pinned head (or reported only, if asked), and any dedicated reviews the PR’s sensitive areas call for are recommended | Publishes a review |
| “Address the reviews on PR #N” | `address-pr-review` | Every open finding has a disposition, fixes are confirmed and pushed, required CI is final and green, and disposition replies are posted | Pushes commits; posts replies; beads |
| “Review and fix PR #N” | `review-and-merge-prs` (fix mode) | One review round and its addressing are complete, and the user has been asked about another round if one looks necessary | As above |
| “Get PR #N merge-ready” | `review-and-merge-prs` (merge-ready mode) | As in fix mode, and the merge gate passes at the current head | As above; no merge |
| “Make sure PR #N is reviewed and merged” | `review-and-merge-prs` (merge mode) | As in merge-ready mode, and the PR is merged | As above, plus merge |

User guidance that changes the defaults:

- **Grants:** “you can use sub-agents” or “you can merge these” authorizes that action
  for the task, and a standing grant can be recorded (see
  `tbd guidelines agent-policy-grants`).
- **Channel:** “post it as a PR comment”, “write a review doc”, or “report only”.
- **Review kinds:** “also do a security review”, “also review performance”, or “give the
  sync logic a correctness pass”.
- **Rounds:** “review until clean”, “two rounds”, or “no further rounds”.
- **Working tree:** “review it in a separate worktree” or “use another session”.
- **Several PRs:** several PR numbers in one request run the workflow per PR, under the
  rules for several PRs in `tbd shortcut review-and-merge-prs`.

## Review Coverage and Rounds

**Coverage.** All code is reviewed at least once.
The `pr-review-requirements` policy (see `tbd guidelines agent-policy-grants`) sets what
a PR needs before it merges.
Under `standard`, the recommended value and the default when nothing is recorded, every
PR gets one senior engineering review (`review-github-pr`, which runs `review-code` with
the general, language, and topic guidelines) and one pass addressing all of its
findings, and more when the user requests.

**Dedicated reviews.** Under `standard`, a PR that is sensitive in an area of special
concern also gets a dedicated review pass for each such area:

- **Security:** authentication and authorization, secrets, parsing untrusted input,
  network exposure, sandboxing and permissions, file-system mutation, and dependency or
  build-time execution changes.
- **Performance:** hot paths, large data volumes, latency-sensitive paths, and memory or
  resource use.
- **Correctness:** intricate logic where a subtle error is costly and hard to detect,
  such as concurrency and locking, data integrity and persisted formats, migrations,
  sync and merge algorithms, and numerical calculations.

Each runs its own shortcut, built on `review-code` with a focused checklist and the
relevant topic guidelines: `tbd shortcut review-code-security`,
`tbd shortcut review-code-performance`, or `tbd shortcut review-code-correctness`. State
which areas apply and why.
When it is unclear whether a PR is sensitive in an area, ask the user.
Each dedicated review is its own published review with its own letter, and its findings
are addressed like any other review’s.

**Reviewers report every finding with its severity** (Blocker, High, Medium, or Low, as
defined in `tbd guidelines code-review-rules`); they do not filter by severity.

**Additional rounds.** After a review is addressed, the coordinator checks whether
another round looks necessary.
Signals:

- the fix commits are large relative to the reviewed diff, or change code the review did
  not cover;
- a fix changed design, public behavior, persisted data, or security-relevant code;
- a Blocker or High finding was rebutted or declined;
- the addressing agent escalated a finding, or two findings conflicted;
- CI needed repeated fix attempts;
- new review content arrived while the review was being addressed.

If any signal applies, tell the user why and ask before starting another round.
An approved round is a follow-up review (`kind=follow-up`, new letter) that reviews the
fix commits since the reviewed head and re-checks the dispositions of Blocker and High
findings, unless the user asks for a full re-review.
Rounds the user requested up front run without asking again.

Fix commits made while addressing a review are confirmed by the addressing agent’s tests
(see Dispositions); they are reviewed again only in an additional round.

## Review-State Contract

Every review shortcut uses this contract, so “what is still open on this PR?” has one
answer.

### Review Header and Marker

Every published review starts with a hidden marker that agents can match exactly and a
visible header:

```markdown
<!-- tbd:review v=1 id=A kind=senior pr=306 round=1 head=<40-hex> base=<40-hex> -->
**Review A** (senior engineering review, round 1) · head `abc1234` · base `main` at `def5678`
Reviewer: strong tier, requested `<model>` at `<level>` · Channel: formal review
Coverage: 14 of 16 changed files; skipped 2 generated files
Tests run: `pnpm test` (pass); reproduction script for A2 (fails as described)
```

- `id` is the review’s letter, unique within the PR. The publisher picks a letter not
  already used on the PR, chosen to keep reviews distinct across review cycles or
  components, and re-checks immediately before publishing.
- `kind` is `senior`, `security`, `performance`, `correctness`, or `follow-up`.
- `head` is the full SHA reviewed; `base` is the merge base with the base branch.
- `round` counts review rounds on the PR.
- The reviewer line records the requested tier, model, and reasoning level (see
  `tbd guidelines agent-model-tiers`), because a sub-agent cannot reliably report its
  own configuration.
- `Coverage` states what was reviewed as a denominator (files reviewed out of files
  changed) and names what was skipped.
- `Tests run` lists what the reviewer executed and the results.

### Finding IDs

Finding IDs are the review letter plus a number (`A1`, `A2`, `B1`), unique within the
PR. Because each review has its own letter, IDs stay distinct across review cycles and
components. Reviews without a marker keep their own IDs and are referenced by review URL
plus ID.

### Dispositions

Every finding receives exactly one disposition:

| Disposition | Meaning | Required evidence |
| --- | --- | --- |
| `fixed` | The problem is corrected, as suggested or equivalently | Commit SHA, what changed, and how the addressing agent confirmed it: an automated test following the standard testing guidelines where the problem is repeatable, or, when automation is very difficult, a manual test script or runbook |
| `rebutted` | The finding is technically incorrect: the problem does not exist, or the suggested fix would make things worse | Specific technical justification with evidence |
| `declined` | Not acted on, even if valid in isolation: it goes against other project guidelines, reflects a misunderstanding of the PR’s scope, or is not worth the change | Reason, citing the guideline, the PR’s stated scope, or the cost |
| `deferred` | Valid and worth doing, but outside this PR | Open bead ID and what it waits on (not a date) |

Automated tests follow `tbd guidelines general-tdd-guidelines`. Manual test scripts and
runbooks follow `tbd shortcut new-qa-playbook`.

### Disposition Replies

A disposition reply carries its own marker and lists every finding of the review:

```markdown
<!-- tbd:dispositions v=1 review=A head=<40-hex> -->
**Dispositions for review A** at `abc1234`
- A1: fixed in `abc1234`: <what changed>; confirmed by <test name>
- A2: rebutted: <why the finding does not apply, with file:line evidence>
- A3: declined: <guideline, scope, or cost reason>
- A4: deferred: tracked as <bead-id>, waiting on <dependency>
```

A review is addressed when a later disposition reply for its letter lists every finding.
Reply titles do not matter.

### Pinning and the Working Tree

Before a review starts, the coordinator records the PR’s `headRefOid` and merge base and
checks out that head in the working tree:

```bash
gh pr view <PR_NUMBER> --repo $REPO --json headRefOid,baseRefName
git fetch origin <baseRefName>
git merge-base origin/<baseRefName> <headRefOid>
git status --porcelain            # must be empty before switching the tree
gh pr checkout <PR_NUMBER> --repo $REPO
git rev-parse HEAD                # must equal the recorded headRefOid
```

If the tree has uncommitted changes, stop and ask the user rather than switching it.
By default the reviewer is a sub-agent working in that same tree.
A separate worktree or session is used when the user asks for one, or when several PRs
are handled in parallel (see `tbd shortcut review-and-merge-prs`).

The reviewer is encouraged to run the test suite and targeted reproduction scripts to
uncover bugs, unless the user says otherwise.
It keeps scratch files in the session scratch directory, does not commit or push, and
leaves the tree as it found it.
Before publishing, it re-reads `headRefOid`. If the head moved, it reviews the new
commits and updates the header, or publishes against the older head and says so.

### Review Channels

The default channel is a **formal GitHub review** published through the reviews API
(`POST repos/$REPO/pulls/<PR_NUMBER>/reviews`) with `commit_id` set to the pinned head,
so GitHub ties the review to that commit and marks inline comments outdated when the
code changes. Publish it with the `COMMENT` event and a textual verdict (for example
“Verdict: approve with nits”) rather than GitHub approve or request-changes states,
since reviewer and author may share one account.

If the user prefers another channel, the review goes there, with the same header and
marker:

- **Plain PR comment**: one long review posted as an issue comment on the PR.
- **GitHub issue**: a review written up as its own issue and cross-linked from a PR
  comment. Used when the review spans multiple PRs or needs its own discussion thread.
- **In-repo review doc**: a file committed to the repo’s **default branch** (not the PR
  branch), such as `docs/project/reviews/review-YYYY-MM-DD-<topic>.md`, linked from a PR
  comment. Treated as an immutable audit trail: update it by appending dated addenda
  (also on the default branch), never by rewriting findings.
  A short current-status block at the top may link to the addenda.

If the user asks to “report only”, the review is returned to the user and not published.

### Discovery Sweep

Reviewing and addressing use one procedure to find review content on a PR:

- Formal reviews: `gh api --paginate repos/$REPO/pulls/<PR_NUMBER>/reviews`
- Inline review comments: `gh api --paginate repos/$REPO/pulls/<PR_NUMBER>/comments`
- PR comments: `gh pr view <PR_NUMBER> --repo $REPO --comments`
- GitHub issues referencing the PR: `gh issue list --repo $REPO --search "<PR_NUMBER>"`
- In-repo review docs linked from the PR or its comments (for example under
  `docs/project/reviews/`)

Reviews and disposition replies with markers are matched by marker; content without a
marker is matched by reading.
The open findings on a PR are the findings of every review not yet addressed.

### Review Artifact Format

A review must be parseable later by an agent who was not there when it was written.
After the header and marker, every published review includes:

- **Summary and verdict**: brief assessment with an explicit textual verdict.
- **Findings**: each with its lettered ID, a severity (Blocker/High/Medium/Low),
  `file:line` references, and a concrete **Fix:** suggestion.
  Use “Fix (pick one):” when several reasonable options exist.
- **Suggestions**: optional, non-blocking improvements, clearly separated from findings.
  They take IDs from the same sequence as the findings and receive dispositions the same
  way; `declined` fits a suggestion that is not worth the change.
- **False positives / do not fix**: things checked and confirmed benign, so the
  addressing agent does not “fix” them.
- **CI status**: state of checks at review time.

## Roles

| Role | Tier | Changes | Publishes |
| --- | --- | --- | --- |
| Coordinator | The user’s session | Checks out the PR; beads for the overall request | Runs the merge, in merge mode |
| Reviewer | strong | No commits; may run tests and scratch scripts | Its senior engineering review |
| Dedicated reviewer | strong | Same as the reviewer | Its security, performance, or correctness review |
| Addressing agent | moderate | Commits to the PR branch (sole committer); beads | Disposition replies |
| Administrator | fast | Beads; no code | Administrative work large enough to justify a sub-agent, such as bookkeeping across several PRs; the coordinator does small administrative steps inline |

Tiers are defined in `tbd guidelines agent-model-tiers`.

The addressing agent escalates to the coordinator when a fix requires a design decision,
when it would rebut or decline a Blocker or High finding, or when two findings conflict.
The coordinator decides, delegates the question to a strong-tier sub-agent, or asks the
user.

## Merge Gate

In the merge-ready and merge modes of `tbd shortcut review-and-merge-prs`, the
coordinator checks the merge gate at the moment of merging:

- the `pr-review-requirements` policy is met: under `standard`, a senior engineering
  review at a pinned head and a pass addressing all its findings, plus each dedicated
  review the PR’s sensitive areas call for, plus any rounds the user requested or
  approved;
- every finding has a disposition, and every deferral has an open bead;
- no review content newer than the last disposition reply is unaddressed;
- any question to the user about another round has been answered;
- the head is unchanged since the final CI run, and required checks are final and green
  for that head;
- GitHub reports the PR mergeable, with no blocking review state;
- for a stack layer, every layer below has merged;
- in merge mode, the `github-merge` policy permits this merge: the user’s request named
  this PR (`per-request`), or the user confirmed it when asked (`not-granted`), or an
  effective `unconditional` grant exists.

Merge with the repository’s merge method, never `--admin`. A branch-protection block
(for example, a required approval that the author’s account cannot give) is reported to
the user, not bypassed.

## Grants in the Review Workflows

Check the effective grants with `tbd policy show`. Policy values, grant sources, and
precedence are defined in `tbd guidelines agent-policy-grants`.

- Publishing reviews, pushing fixes, and posting disposition replies require
  `github-editing` or `github-workflows`; without either, ask once before the first
  GitHub mutation in a task.
- Merge mode requires `github-merge`. With `per-request`, the user’s “reviewed and
  merged” request is the authorization for the PRs it names.
  With `not-granted`, ask before merging.
- Delegation requires `subagents` (see `tbd shortcut delegate-to-subagents`).
- `pr-review-requirements` decides which reviews the orchestrated workflow runs and what
  the merge gate checks (see Review Coverage and Rounds).

## The Two-Agent Handoff

The common flow these shortcuts support:

1. Agent A runs `tbd shortcut review-github-pr` on PR #N at a pinned head, compiles
   findings in the artifact format, and publishes them with the header and marker to one
   channel (stages 2-3).
2. Agent B, often a different agent in a later session, runs
   `tbd shortcut address-pr-review` for PR #N: it runs the discovery sweep, creates a
   parent bead plus one child bead per finding, gives each finding one of the four
   dispositions, and closes the loop with a disposition reply and green CI (stage 4).

Nothing is lost between the two agents because findings carry lettered IDs in the
artifact, are tracked as beads while being addressed, and are matched to their review by
marker.
With sub-agents, the coordinator runs this handoff as the reviewer and addressing
roles above; see `tbd shortcut delegate-to-subagents`.

### Single-Agent Fallback

Without sub-agents, one session performs every step in order, with the same artifacts.
The review header records the session’s actual model and reasoning level, and a review
of fixes the same session wrote says that it is not independent.

## Stacked PRs

When a PR is one layer of a stack, the lifecycle above still applies, one layer at a
time, with three adjustments:

- **Review scope is the layer.** GitHub shows only that layer’s diff, since the base is
  the branch below it.
  Review that, and say which layer a finding belongs to; a finding about lower-layer
  code belongs on that lower PR.
- **Fixes land on the owning layer**, then `gh stack rebase --upstack` so the layers
  above pick up the change.
  Until that rebase, CI on the upper PRs is stale.
- **Verdicts are per layer.** A blocker on a lower layer blocks everything above it,
  because `gh stack merge` is all-or-nothing.

See `tbd shortcut stacked-prs` for when stacking is worth it.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
