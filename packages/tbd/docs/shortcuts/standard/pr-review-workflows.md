---
title: PR Review Workflows
description: The PR review lifecycle—how reviews are created, published (formal review, PR comment, GitHub issue, or review doc), and addressed, and which shortcut runs each stage. Start here to pick the right review shortcut.
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This is the **map of the PR review lifecycle**: the stages a code review moves through,
which shortcut runs each stage, and the conventions that let one agent write a review
and a different agent address it later.

Read this before writing or addressing any PR review, or whenever you need to pick the
right review shortcut.

## The Lifecycle

A PR review moves through distinct stages, each with its own shortcut.
Reviewing and addressing are **decoupled on purpose**: they are often done by different
agents in different sessions, and the published review artifact is the handoff between
them.

| Stage | What happens | Shortcut |
| --- | --- | --- |
| 1. Prepare the PR | Work committed and pushed, PR created or updated, CI green | `code-review-and-commit` (commit and push), then `create-or-update-pr-simple` or `create-or-update-pr-with-validation-plan` |
| 2. Review | A reviewer (agent or human) reviews the diff and compiles structured findings | `review-github-pr` (wraps `review-code`) |
| 3. Publish | The review is posted as a durable artifact on one channel (see below) | final steps of `review-github-pr` |
| 4. Address | An agent (often a different one) picks up the published review, tracks every finding as a bead, and fixes, rebuts, or explicitly defers each | `address-pr-review` |

The core review engine is `tbd shortcut review-code`, which reviews any diff
(uncommitted changes, branch work, or a GitHub PR). `review-code-typescript` and
`review-code-python` are narrower, language-only variants; `review-code` itself loads
the same language guidelines, so use the variants only when a language-scoped review is
explicitly wanted.

Pre-commit reviews (`tbd shortcut precommit-process`) use `review-code` directly and fix
issues immediately—the publish and address stages apply to reviews of pushed PRs, where
the review and the fix are separate pieces of work.

## Review Channels

A published review can live in any of these places.
The same artifact format (below) applies on every channel, and `address-pr-review` must
check all of them:

- **Formal GitHub review** on the PR (`gh pr review --comment`). Often a single long
  review body. Verdicts are usually textual (e.g. “Verdict: approve with nits”) rather
  than GitHub approve/request-changes states, since reviewer and author may share one
  account.
- **Plain PR comment**: one long review posted as an issue comment on the PR.
- **GitHub issue**: a review written up as its own issue and cross-linked from a PR
  comment. Used when the review spans multiple PRs or needs its own discussion thread.
- **In-repo review doc**: a file committed to the repo’s **default branch** (not the PR
  branch), such as `docs/project/reviews/review-YYYY-MM-DD-<topic>.md`, linked from a PR
  comment. Treated as an immutable audit trail: update it by appending dated addenda
  (also on the default branch), never by rewriting findings.

## Review Artifact Format

A review must be parseable later by an agent who was not there when it was written.
Every published review includes:

- **Scope**: what was reviewed (PR number, diff range, file count) and how.
- **Summary and verdict**: brief assessment with an explicit textual verdict.
- **Findings**: numbered with stable IDs (1..N or R1..RN), each with a severity
  (Blocker/High/Medium/Low), `file:line` references, and a concrete **Fix:** suggestion.
  Use “Fix (pick one):” when several reasonable options exist.
- **Suggestions**: optional, non-blocking improvements, clearly separated from findings.
- **False positives / do not fix**: things checked and confirmed benign, so the
  addressing agent does not “fix” them.
- **CI status**: state of checks at review time.

## The Two-Agent Handoff

The common flow these shortcuts support:

1. Agent A runs `tbd shortcut review-github-pr` on PR #N, compiles findings in the
   artifact format, and publishes them to one channel (stages 2-3).
2. Agent B—often a different agent in a later session—runs
   `tbd shortcut address-pr-review` for PR #N: it locates the published review(s),
   creates a parent bead plus one child bead per finding, fixes, rebuts, or defers each,
   and closes the loop with an “Addressed” reply and green CI (stage 4).

Nothing is lost between the two agents because findings carry stable IDs in the artifact
and are tracked as beads while being addressed.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
