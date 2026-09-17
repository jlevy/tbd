---
title: Review Code
description: Comprehensive code review for uncommitted changes, branch work, or GitHub PRs
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This is the **core code review** shortcut.
It performs a comprehensive review of code changes using all general and
language-specific guidelines.

It is the review *engine*: it produces findings but does not publish or fix them.
For where it sits in the PR review lifecycle (publishing reviews, addressing them), see
`tbd shortcut pr-review-workflows`.

## Scope Options

This shortcut supports three review scopes:

| Scope | What it reviews | How diff is obtained |
| --- | --- | --- |
| **Uncommitted changes** | Staged + unstaged local changes | `git diff` + `git diff --cached` |
| **Branch work** | All commits ahead of target + uncommitted | `git diff <target>...HEAD` + uncommitted |
| **GitHub PR** | Changes in a pull request, at its pinned head | `git diff <merge-base> HEAD` with the pinned head checked out |

For **GitHub PR** scope the diff alone is not enough: any surrounding code you read
comes from the working tree, so review with the pinned PR head checked out there.
Otherwise design judgments and `file:line` references can describe the wrong code.
How the head is pinned is defined in Pinning and the Working Tree in
`tbd shortcut pr-review-workflows`.

When the PR is one layer of a stack, the PR diff shows only that layer’s changes,
because the PR’s base is the branch below it rather than the trunk.
That narrow diff is the correct review scope, not a sign the change is incomplete.

For **GitHub PR** reviews with follow-up actions (commenting, CI checks), use
`tbd shortcut review-github-pr` instead—it wraps this shortcut and adds GitHub workflow.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Determine scope:**
   - If the user specified a scope, use it
   - If reviewing for precommit, use **Uncommitted changes**
   - If a PR number/URL was provided, use **GitHub PR**
   - Otherwise, ask the user which scope to review

2. **Get the diff:**
   - **Uncommitted changes:**
     ```bash
     git diff          # Unstaged changes
     git diff --cached # Staged changes
     ```
   - **Branch work** (default target: `origin/main`):
     ```bash
     git fetch origin main
     git diff origin/main...HEAD  # Committed changes on this branch
     git diff                     # Plus unstaged changes
     git diff --cached            # Plus staged changes
     ```
   - **GitHub PR:** the PR head must be pinned and checked out in the working tree, with
     its `headRefOid` and merge base recorded.
     If it is not, pin it first as in `tbd shortcut pr-review-workflows`, and stop and
     ask the user if the tree has uncommitted changes.
     ```bash
     git rev-parse HEAD           # Must equal the pinned headRefOid
     git diff <merge-base> HEAD   # The PR diff at the pinned head
     ```

3. **Identify files and languages:**

   - List the files changed
   - Note which languages are present (TypeScript, Python, etc.)

4. **Load general guidelines:**

   - Run `tbd guidelines code-review-rules` (severity vocabulary, risk ordering, and
     what makes a finding actionable)
   - Run `tbd guidelines general-coding-rules`
   - Run `tbd guidelines general-comment-rules`
   - Run `tbd guidelines error-handling-rules`
   - If reviewing test code, also run `tbd guidelines general-testing-rules`

5. **Load language-specific rules based on files changed:**

   - For TypeScript/JavaScript files:
     `tbd guidelines typescript-rules typescript-lint-format-rules`
   - For Python files: `tbd guidelines python-rules`
   - For Rust files:
     `tbd guidelines rust-rules rust-lint-format-rules rust-code-review-rules`
   - Load each language present in the diff
   - Add the topic guidelines the diff touches, in any language (full table in
     `code-review-rules`): `filesystem-rules` (paths, traversal, file mutation),
     `ci-and-gates-rules` (build config, CI, hooks, gate scripts),
     `release-engineering-rules` (artifacts, publishing, version identity),
     `supply-chain-hardening` (dependencies added or upgraded),
     `backward-compatibility-rules` (public API or persisted data shape)

6. **Run tests and reproductions:**

   Unless the user says otherwise, run the test suite on the reviewed code, and write
   targeted reproduction scripts to confirm or rule out suspected defects as the review
   proceeds. Record what ran and the results (for PR scope, in the review header’s
   `Tests run` line).

   - Keep scratch files in the session scratch directory, not in the repository.
   - Do not commit or push.
   - Leave the working tree as you found it (`git status --porcelain` shows the same
     result at the end as at the start); any fixes happen in the final step, after the
     review.

7. **Perform comprehensive senior engineering review:**

   - Assess overall design, architecture, and maintainability and if there are alternate
     significantly better approaches
   - Suggest use of additional libraries or tools that are appropriate
   - Check adherence to general coding rules
   - Verify comment quality and appropriateness
   - Check error handling patterns
   - Apply language-specific best practices
   - Call out antipatterns and code smells, especially code duplication or quick hacks
   - Look for security issues (injection, XSS, etc.)

8. **Check documentation consistency:**

   - If changes affect behavior documented in specs (`docs/project/specs/active/`), note
     any needed updates
   - If changes affect the project’s development docs (e.g. `docs/development.md` or
     `docs/contexts/development.md`), note any needed updates
   - If changes affect architecture (`docs/project/architecture/`), note any needed
     updates

9. **Compile the review:**

   Write a structured review following the review artifact format in
   `tbd shortcut pr-review-workflows`, so a later agent can address it: for PR scope the
   review header and marker, then the verdict, findings with IDs lettered per review
   (`A1`, `A2` in review A; `B1` in review B) and a severity (Blocker/High/Medium/Low),
   `file:line` references, and a concrete **Fix:** suggestion each, non-blocking
   suggestions, and false positives confirmed benign.
   Report every finding with its severity; do not filter by severity.
   Add two engine-specific sections:

   - **Design assessment**: Review architecture and pros/cons/alternatives, how this
     design fits relative to other possible approaches, its strengths and weaknesses
     relative to alternatives
   - **Documentation**: Any docs that need updating

10. **Determine next action:**

    - If the user specified what to do next, follow those instructions
    - If this is a precommit review, proceed to fix any issues found
    - If this review is of a pushed PR, publishing and fixing are separate lifecycle
      stages: `tbd shortcut review-github-pr` publishes the review, and
      `tbd shortcut address-pr-review` addresses a published review
    - Otherwise, present the review and ask:
      - **Fix issues**: Create tbd beads for the findings and begin fixing
      - **Report only**: Just output the review (no changes)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
