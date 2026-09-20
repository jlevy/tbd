---
title: Setup tbd
description: Set up tbd in a new project, and review the setup after every tbd upgrade. Install or upgrade the CLI, run setup, ask the user once about each unanswered agent policy grant (offering all recommended, with Linear asked separately), record the answers in AGENTS.md, set up the gh authentication, stack tooling, and Linear sync the grants need, then verify and report
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Use this to set up tbd in a new project, and again after every tbd upgrade in a project
that already uses it.
The output of `tbd setup` ends by pointing here, and “Set up tbd” is the request that
runs it. Re-running it is safe: setup is idempotent, and each run asks only about
policies that are still unanswered.

Operate tbd for the user throughout: run the commands yourself, and ask the user only
for decisions (the prefix and the policy answers) and for authentication that must come
from them (a `gh` login or token, a personal Linear key).

A **policy grant** records the user’s consent for a class of agent actions, for the
project as a whole: every human and agent working on the repository shares it.
`tbd guidelines agent-policy-grants` defines each policy, its values, and its
recommendation. Read its Setup Questions section before step 4, and take each meaning
from there rather than from memory.

## 1. Install or Upgrade the CLI

```bash
npm install -g get-tbd@latest   # Installs or upgrades
tbd --version
```

This is also the fix when tbd refuses with “This repository requires a newer version of
tbd”.

## 2. Run Setup

- **New project** (no `.tbd/config.yml`): ask the user for the issue prefix (2 to 8
  letters recommended), then run `tbd setup --auto --prefix=<prefix>`. Never guess the
  prefix. If the repository has a `.beads/` directory, ask whether to import it with
  `tbd setup --from-beads` instead.
- **Existing project or upgrade:** run `tbd setup --auto` with no prefix.
  It applies any format migration, refreshes the agent files, and writes the policy
  block in `AGENTS.md` back unchanged.

Commit the diff setup reports.
Do not pass `--policies` here: grants are recorded in step 5, after the user answers.
If setup stops on a policy block it cannot read (malformed, or a newer block version),
its message names the fix; resolve that first.

## 3. Review Policies

```bash
tbd policy show
```

It lists the answered policies with their values, and the unanswered policies with the
value agents assume until one is recorded and the recommendation.
The lists come from `AGENTS.md` on the default branch.
A policy recorded in the working tree but not yet merged appears under “Working tree
AGENTS.md differs”: it is a proposal, not an effective grant.
Show pending values separately and ask the user to confirm them before they authorize
any action. Skip that question only when the same answer is explicit in the current
conversation; a file or earlier session is not evidence of consent.

A new project has every policy unanswered.
An upgraded project may have any number unanswered, for example a policy added by the
new release, or none.

## 4. Ask About Unanswered Policies

Ask in one message, for the project as a whole (all agents on the repository, not only
this session).
Include only the unanswered policies, each with its recommendation and the
one-line meaning from Setup Questions.
On an upgrade, also list the answered policies and their values for review; offer to
change one only when the user asks.
If every policy is answered by an effective grant or an explicit answer in the current
conversation, show those authorized values and go to step 6. Pending working-tree values
alone do not satisfy this condition.

Accept any of these answers:

- **“Yes, all recommended automations and review policies”:** the recommended value for
  every unanswered policy except `linear`.
- **Individual answers**, such as “all but merging” or “two review rounds”.
- **“Not now”**, for any policy: it stays unanswered, and the next run asks again.

Ask about Linear as its own question, even when the user accepts all recommended
policies: Linear is not on by default and is outside the recommended set.
Ask whether the user uses Linear and wants tbd to sync beads with it; if so, the default
syncs open epic beads only, in both directions.
If `tbd integration status --offline` shows Linear already enabled in `.tbd/config.yml`,
it keeps syncing whatever the grant says; ask the user to record the value that matches
the configured selection.

A compact template, in the guideline’s order; keep only the unanswered policies, the
Linear question only if `linear` is unanswered, and the last line only if some policies
are answered:

```text
tbd is set up. A few policy questions for this project. The answers are recorded in
AGENTS.md and apply to every agent working on this repository.

1. github-workflows (recommended: granted): <meaning>
2. github-editing (recommended: granted): <meaning>
3. github-merge (recommended: confirm-session): <meaning>
4. github-stacked-prs (recommended: granted): <meaning>
5. subagents (recommended: granted): <meaning>
6. pr-review-requirements (recommended: standard): <meaning>

Reply “yes, all recommended automations and review policies”, answer by number, or
say “not now” to any of them and I will ask again next time.

Separately: do you use Linear and want tbd to sync beads with it? If yes, the default
syncs open epic beads only, in both directions.

Already recorded, for your review: <policy: value, ...>
```

## 5. Record the Answers

Record only what the user explicitly answered:

| Answer | Command |
| --- | --- |
| All recommended | `tbd setup --auto --policies=recommended` |
| A policy’s recommended value | `tbd policy grant <policy>` |
| A policy’s revoke value, the value an unanswered policy takes | `tbd policy revoke <policy>` |
| Any other valid value | `tbd policy set <policy> <value>`, for example `tbd policy set pr-review-requirements "standard + 2 rounds"` |
| Linear: yes | `tbd policy set linear epics`, or the selection the user chose |
| Linear: no | `tbd policy revoke linear` |
| Not now | Nothing |

`--policies=recommended` records the recommended value for every unanswered policy
except `linear` and leaves answered policies unchanged.
Record any individual answers first, then run it for the rest; if the user said “not
now” to any policy, use `tbd policy grant` for each accepted policy instead.
Record `github-merge: never`, `github-merge: autonomous`, or
`pr-review-requirements: none` only when the user explicitly asks for that value.
`github-merge` takes four values rather than granted or not: name them when the user
asks what the choices are (`never`, `confirm-every`, `confirm-session`, `autonomous`),
and use `tbd policy set github-merge <value>` for anything other than the recommended
one or the revoke value.

Commit `AGENTS.md` and tell the user what was recorded.
Grants are read from the remote’s copy of the default branch when the repository has one
(`origin/main` as of the last fetch), so a commit on `main` takes effect after
`git push`, and other clones see it after they fetch.

## 6. Set Up What the Grants Need

Use only effective default-branch grants or explicit answers from the user in the
current conversation for the actions below.
A newly confirmed answer authorizes this setup task before its policy commit merges; an
unconfirmed working-tree proposal does not.
Reuse answers already given in this conversation rather than asking again in a linked
setup shortcut.

- **Any GitHub grant** (`github-workflows`, `github-editing`, `github-merge`, or
  `github-stacked-prs` with a value other than `not-granted`): run `gh auth status`. If
  `gh` is missing, too old, or not authenticated, follow
  `tbd shortcut setup-github-cli`. Authentication comes from the user (`gh auth login`,
  or `GH_TOKEN` set before the session); never ask for a token in chat.
- **`github-stacked-prs: granted`:** install the stack tooling as step 3 of Fresh
  Machine Setup in `tbd shortcut setup-github-cli` describes (the agent’s
  `ensure-gh-cli.sh` with `--with-stack`). Skip it without the grant.
- **`linear` granted:** follow `tbd shortcut setup-linear` with the `epics` selection,
  unless the user chose another.
  It configures the repository and walks the user through adding their personal
  `LINEAR_API_KEY` locally.

If the user defers an authentication step, note it for the report and continue.

## 7. Verify and Report

```bash
tbd doctor
tbd policy show
```

Fix or report anything `tbd doctor` flags.
Until the policy commit is pushed to the remote’s default branch, both commands report
the working tree grants as pending; that is expected.
A working-tree block that differs from the default branch at a pinned PR head is a
proposed grant change: tell the user before reviewing or merging, and do not treat it as
expected once the question is whether to merge.

Tell the user, briefly:

- What is granted, with each value.
- What remains unanswered, and that the next run of this process, or the first task that
  needs one, asks about it.
- Authentication still to set up: `gh` for GitHub grants, the personal Linear key for
  Linear.
- That grants take effect once `AGENTS.md` is committed and pushed to the remote’s
  default branch (other clones see it after they fetch), and whether that has happened.
- On an upgrade, what setup changed (a format migration or refreshed agent files).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
