---
title: Stacked PRs
description: When to use formal GitHub PR stacks, how they align with beads, and how to link and verify them with gh stack; chained branch bases alone do not count
category: git
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
A **stack** is an ordered chain of branches on a trunk, where each branch has one PR
based on the branch below it and the PRs are linked as a formal stack on GitHub.
A reviewer sees only that layer’s diff, so three 200-line PRs replace one 600-line PR.
The branch-base chain is necessary for layered diffs, but it is not formal stack
membership by itself.

This shortcut covers **when to stack, how stacking interacts with tbd, and the critical
noninteractive commands and postconditions for agent sessions**. It does not replace the
official `gh-stack` command reference.

## Mechanics Live in the Official Skill

GitHub ships `gh stack` (the `github/gh-stack` extension) with an official agent skill.
That skill is the authority on driving the tool, and it is far more precise than a
summary here could be: it spells out which subcommands hang forever under a PTY, the
exact flags that avoid prompts, exit codes, conflict recovery, and `--json` parsing.

Check that it is installed before doing stack work:

```bash
gh extension list | grep 'gh stack'   # expect: gh stack  github/gh-stack  v0.1.0
gh skill list --agent codex | grep gh-stack   # under Claude Code, use --agent claude-code
```

If either is missing and `github-stacked-prs` is granted, install both pinned via the
ensure script for the current agent:

```bash
bash .codex/ensure-gh-cli.sh --with-stack          # Codex
bash .claude/scripts/ensure-gh-cli.sh --with-stack # Claude Code
```

Without the grant, do not install them unless the user agrees when asked, even when a PR
someone else stacked needs them.
`tbd guidelines agent-policy-grants` defines the policy, and `tbd policy show` reports
its current value.

Local tracking and formal GitHub membership are separate states.
`gh stack view --json` reports the current *locally tracked* stack; `gh stack link` can
create a formal remote stack without creating local tracking.
For an existing PR, verify authoritative remote membership with:

```bash
REMOTE_STACK_NUMBER=$(gh api "repos/$REPO/stacks?pull_request=$PR_NUMBER" \
  --jq '.[0].number // empty')
```

Stop if the API call fails; do not treat an unavailable check as “not stacked.”
A nonempty result verifies formal membership.
An empty result means the PR is not yet part of a formal GitHub stack, even if its base
points at another feature branch.

If the skill is unavailable and you must proceed anyway, the four rules that matter
most, because breaking them hangs an agent session indefinitely:

- `gh stack view --json`, never bare `gh stack view` (bare opens a blocking TUI).
- `gh stack submit --auto`, never bare `submit` (bare prompts for every PR title).
  `--auto` creates new PRs as drafts and preserves existing review state.
  Add `--open` only when the user explicitly asks to mark every new and existing PR
  ready for review.
- `gh stack merge <target> --yes`. Plain `gh pr merge` cannot merge a stack, and a bare
  number is read as a stack number before a PR number.
- Pass branch names to `init`, `add`, and `checkout`. Bare forms prompt.

Two recovery paths need additional postconditions even when the command invocation is
otherwise non-interactive:

- Before adopting a remote-only stack with `gh stack checkout <PR URL>`, check whether
  any target branch belongs to a different local stack.
  From a non-shared branch in the conflicting stack, run `gh stack unstack --local`,
  then return and retry the checkout.
  The official skill documents an unbypassable prompt when local and remote stack
  compositions conflict, so stop if you cannot prove the checkout is conflict-free.
- Capture and inspect combined output from `gh stack sync`. A divergent non-interactive
  sync can print `Sync aborted — no changes were made` and exit 0. Treat that message as
  failure, resolve the divergence using the official skill, retry, and verify the
  resulting stack with `gh stack view --json` before continuing.

## When to Stack

Stacking is **opt-in**. It is one workflow among several, and a single well-scoped PR is
the right default for most changes.
Do not restructure someone’s work into a stack because stacks are available.

**Create stacks only under the `github-stacked-prs` grant** (see
`tbd guidelines agent-policy-grants`). When it is granted, follow this shortcut when a
change is best split into dependent PRs or the user asks for a stack.
When it is not granted, do not create or submit a stack: propose separate PRs instead,
and stack only if the user then confirms they want one for this task.
Either way, a PR someone else already stacked still follows the stack rules in this
shortcut when you review or address it.

**If the user asks for a stacked PR, produce an actual stack.** When they say “stacked
PR”, “stack this”, “layer these”, or “dependent PRs”, the deliverable is a real stack:
branches chained bottom to top, each PR based on the branch below, linked as a stack on
GitHub. Creating one flat PR, or only setting each PR’s base to the branch below, is a
silent failure to deliver what was asked.
Use `gh stack init` or `gh stack add` followed by `gh stack submit --auto` for a locally
tracked stack, or `gh stack link` for existing PRs.
Then verify every PR through the remote `stacks?pull_request=$PR_NUMBER` API lookup and
confirm each PR’s base is the branch below it, not the trunk.

**Offer a stack when the change plainly decomposes.** Suggest it once, in a sentence,
and accept the answer:

- A refactor or extraction that a feature then builds on.
- A schema, migration, or type change beneath the code that consumes it.
- A dependency bump or config change that unblocks the real work.
- Work spanning several unrelated concerns, which a large diff often but not always
  indicates.

**Do not offer a stack** for a single-concern change, a small fix, work the user framed
as one PR, or anything urgent enough that serialized review would hurt.
Once the user declines, drop it and do not raise it again that session.

## Layer Discipline

When a stack is warranted, the split has to earn the extra process:

- **One concern per layer.** If you cannot state a layer’s purpose in a sentence, the
  split is wrong.
- **Foundations at the bottom.** Each layer depends only on layers below it.
- **Every layer stands alone.** It should build, pass tests, and be independently
  revertible. A layer that only makes sense with the one above belongs merged into it.
- **Order by dependency, not by chronology.**
- **Create the stack before writing the code** where you can.
  Splitting a finished branch afterwards is materially harder than starting with the
  layers.
- **Edit the layer that owns the code.** Never commit a lower layer’s fix on the top
  branch. Check out that layer, commit, rebase the layers above, then return.

Prefer fewer, larger layers over many tiny ones.
Each layer costs a PR, a CI run, and a review cycle.

## Stacks and Beads

A stack and a bead tree describe the same decomposition, so keep them aligned:

- One parent bead for the whole change, one child bead per layer.
- Order the children with `--depends-on` to mirror the stack order, bottom first.
- Record the branch name and PR number on each child bead as its layer lands.
- Close a child when its layer merges, not when the whole stack merges.

## How the Other Shortcuts Change

| Shortcut | On a stacked branch |
| --- | --- |
| `create-or-update-pr-simple` / `-with-validation-plan` | Do **not** target the trunk. For a locally tracked stack, use `gh stack submit --auto`. For a remote-only linked stack, push the owning branch and use `gh pr edit` without `--base`. Add `--open` only when the user explicitly asks to mark the whole stack ready. Verify formal membership through the remote stack API after either path. |
| `code-review-and-commit` | Commit to the owning layer (see Layer Discipline), then rebase the layers above. |
| `review-github-pr` | Review only that layer’s diff, which is what GitHub already shows. Name the layer in each finding. |
| `address-pr-review` | Fix on the owning layer, then `gh stack rebase --upstack` before trusting CI on the upper PRs. |
| `merge-upstream` | Do not merge the trunk into a stacked branch. Use `gh stack sync`, which rebases and force-pushes (`--force-with-lease`) the whole chain. |

## Landing a Stack

Merge bottom to top, and let the tooling do it:

```bash
gh stack merge <pr-number> --yes    # that PR and every unmerged PR below it
gh stack sync --prune               # reconcile local state, drop merged branches
```

A bare number is resolved as a **stack** number first and only then as a PR number, so
on a repo where those ranges still overlap, confirm the target with
`gh stack view --json` for a locally tracked stack or the remote stack API for a
remote-only linked stack before merging.

The merge is all-or-nothing: if any PR in the set cannot merge, none do.
Under `per-request`, a stack merge needs the request to name, or the user to confirm,
every layer the merge will include; otherwise stop and ask, since the lower layers
cannot be excluded. After a squash merge on the trunk, `gh stack sync` detects it and
rebases the remaining layers; do not rebuild the stack by hand.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
