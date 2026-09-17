---
title: Agent Policy Grants
description: The single definition of the seven agent policies a project can grant (github-workflows, github-editing, github-merge, github-stacked-prs, subagents, pr-review-requirements, linear)—each policy's values, recommendation, and coverage; the grammar for custom values; the recommended set; answered versus unanswered policies; where grants come from and which source wins; the exact policy block in AGENTS.md; how grants are recorded; and the questions the setup process asks. Load before a GitHub mutation, a merge, a delegation to sub-agents, a Linear sync, or the setup process.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Policy Grants

A **policy grant** records the user’s explicit consent for a class of agent actions, so
agents neither ask again in every session nor act without consent.
Grants are made for the project as a whole and shared by every human and agent working
on the repository. They live in a policy block inside the generated tbd block in
`AGENTS.md`, which is the only record of them; `.tbd/config.yml` holds no copy.

This document is the single definition of the policies.
The policy block, the setup process (`setup-tbd`), the delegation shortcut
(`delegate-to-subagents`), the review workflows (`review-and-merge-prs`,
`pr-review-workflows`), and `stacked-prs` link here rather than restating it, and tests
keep this document, the `tbd policy` schema, and the block renderer in agreement.

**Related**:

- `setup-tbd` (the consolidated setup process that asks the questions below)
- `delegate-to-subagents` (checking and recording the `subagents` grant)
- `pr-review-workflows` and `review-and-merge-prs` (how `pr-review-requirements` and
  `github-merge` shape a review)
- `stacked-prs` and `setup-github-cli` (what `github-stacked-prs` enables)
- `setup-linear` (configuring the selection a `linear` grant names)

## The Policies

| Policy | Values | Recommended | Covers |
| --- | --- | --- | --- |
| `github-workflows` | `granted`, `not-granted` | `granted` | The rest of an end-to-end GitHub workflow beyond branches and PRs, through any tool (`gh`, the GitHub API, or MCP servers): issues, labels, and re-running or cancelling CI runs |
| `github-editing` | `granted`, `not-granted` | `granted` | Branches and PRs short of merging, through any tool (`gh`, the GitHub API, or MCP servers): pushing branches; creating, reviewing, and editing PRs; posting comments, reviews, and disposition replies; watching CI |
| `github-merge` | `not-granted`, `per-request`, `unconditional` | `per-request` | Merging PRs with `gh` once the review requirements are met. `per-request` merges only a PR the user authorized in the current request. `unconditional` merges without per-case authorization; it is recorded only when the user explicitly grants it, and tbd recommends against it |
| `github-stacked-prs` | `granted`, `not-granted` | `granted` | Setting up GitHub-native stacked PRs (the pinned `gh-stack` extension and its agent skill) and creating, submitting, syncing, and merging formal stacks with `gh stack`, following `stacked-prs` |
| `subagents` | `granted`, `not-granted` | `granted` | Using sub-agents according to `delegate-to-subagents` |
| `pr-review-requirements` | `standard`, a custom requirement, or `none` | `standard` | The reviews required before a PR is merged. `standard`: one senior engineering review and one pass addressing all findings for every PR, plus a dedicated review pass for each area of special concern (security, performance, correctness) in which the PR is sensitive. A custom requirement adds kinds or rounds (see Custom Values). `none` requires no review; it is recorded only when the user explicitly grants it, and tbd recommends against it |
| `linear` | `not-granted`, `epics`, or a custom selection | Not recommended by default; ask | Syncing beads with Linear. `epics` syncs open epic beads only, in both directions. A custom selection names a wider set (see Custom Values) and is configured through `setup-linear` |

The two GitHub grants are scoped by what they cover, not by which tool performs the
action: an action on a branch or PR needs `github-editing` whether it runs through `gh`,
the API, or an MCP server, and an action on issues, labels, or CI runs needs
`github-workflows`. Neither GitHub grant covers repository settings, secrets, or
workflow files.

Merging without review requires two explicit grants: `github-merge` of `per-request` or
`unconditional`, and `pr-review-requirements: none`.

Policy names and values are lowercase ASCII. A value not listed here, and not produced
by the grammar below, is unknown, and `tbd doctor` reports it.

## Custom Values

Two policies accept a structured value beyond their fixed names.
Both use one form: a base name followed by additions, joined by `+`.

```text
value    := base ( "+" addition )*
```

Rules shared by both policies:

- Tokens are lowercase ASCII words; a rounds term is a decimal integer, a space, and a
  word (`2 rounds`).
- When reading, whitespace around `+` is optional.
  When writing, tbd puts one space on each side of `+`.
- Each addition appears at most once, and order carries no meaning.
  tbd writes additions in the canonical order given for each policy.
- A base that takes no additions (`none`, `not-granted`, `custom`) followed by `+` is
  unknown.

### `pr-review-requirements`

```text
value    := "standard" | "none" | "standard" ( "+" addition )+
addition := "security" | "performance" | "correctness" | rounds
rounds   := integer " rounds"          (integer >= 2, decimal digits)
```

- A kind (`security`, `performance`, or `correctness`) makes that dedicated review pass
  required for every PR, not only for a PR that is sensitive in that area.
  Under `standard` alone, the pass runs only when the PR is sensitive in that area, and
  the coordinator asks when that is unclear.
- `N rounds` requires N review rounds for every PR, each a review and an addressing
  pass, run without asking between rounds.
  `standard` alone is one round, with a question before any further round.
  `1 rounds` is unknown, since it restates `standard`.
- `none` takes no additions.
- Canonical order: `security`, `performance`, `correctness`, then rounds.

Valid: `standard`, `none`, `standard + security`, `standard + 2 rounds`,
`standard + security + correctness + 2 rounds`. Unknown: `none + security`,
`standard + 1 rounds`, `standard + security + security`, `standard + 2 round`,
`Standard + Security`.

### `linear`

```text
value := "not-granted" | "epics" | "epics" "+" "specs" | "custom"
```

- `epics`: open epic beads only, in both directions.
  In the integration’s terms, an outbound selection of `kinds: [epic]`, `specs: none`,
  and open statuses, with linked pairs reconciled both ways by `tbd sync`; it does not
  create beads from new Linear issues unless the user asks.
- `epics + specs`: open epics plus beads whose spec is active (a `spec_path` under
  `specs/active/`, which propagates to their descendants).
  This is the integration’s `policy: default`.
- `custom`: whatever selection `.tbd/config.yml` configures under
  `integrations.linear.policy`, set up through `setup-linear`. The block grants the
  sync; the configuration describes the selection.

Valid: `not-granted`, `epics`, `epics + specs`, `custom`. Unknown:
`epics + specs + specs`, `specs`, `custom + epics`, `all`.

## Answered and Unanswered Policies

A policy listed in the block is **answered**, whatever its value.
A policy missing from the block is **unanswered**: agents treat it as `not-granted` (or
`standard` for `pr-review-requirements`) and ask when it matters, and the setup process
asks about it.

When an unanswered policy matters in a task, ask once, before the first action it
covers, and offer to record a standing grant.
Do not ask about policies the task does not touch.

## The Recommended Set

“All recommended” means `github-workflows: granted`, `github-editing: granted`,
`github-merge: per-request`, `github-stacked-prs: granted`, `subagents: granted`, and
`pr-review-requirements: standard`.

Linear is outside the recommended set and is always asked separately; its default
selection when the user wants it is `epics`.

## Where Grants Come From

- **Sources:** the project policy block, as committed on the default branch, is the
  primary record. The setup process and agents steer users to record grants there, so
  every human and agent on the repository shares them.
  The current conversation can override it for one task.
  User-level grants in a user’s own agent instructions or tool-permission settings are a
  fallback for policies the project has not answered.
- **Precedence:** the current conversation overrides recorded grants, in either
  direction, for that task (“you can merge these” grants a merge; “do not merge anything
  today” withdraws one).
  Otherwise an answered project policy decides, whatever its value.
  A user-level grant applies only when the project policy is unanswered.
- **Default branch:** grants are read from the default branch, so an unmerged branch
  that edits the policy block grants nothing until it merges.
  This is the only safeguard the block needs: anyone who can commit to the default
  branch can already change the code and the instructions agents follow.
- **Visibility:** `tbd prime` prints the effective grants and names unanswered policies,
  which reaches Claude Code through the SessionStart hook.
  Check grants before a GitHub mutation, a merge, a delegation, or a Linear sync;
  because not every agent loads `AGENTS.md`, `tbd policy show` is the reliable check.
- **Validation:** `tbd doctor` reports a malformed block, unknown values, and a working
  tree block that differs from the default branch.
- **Permissions:** a grant never bypasses a tool permission or sandbox.
  If a permission layer blocks a granted action, ask for that specific permission.

## Recording Grants

- **At setup:** the consolidated setup process asks about unanswered policies and
  records the user’s explicit answers, for example with
  `tbd setup --auto --policies=recommended` or `tbd policy set linear epics`.
  Non-interactive setup without policy flags records nothing.

- **Later:** `tbd policy show` lists answered and unanswered policies with their
  effective values. `tbd policy grant <policy>` records the policy’s recommended value,
  `tbd policy revoke <policy>` records its not-granted value, and
  `tbd policy set <policy> <value>` records any valid value; the table below gives each
  policy’s `grant` and `revoke` values.
  Only `set` records the values tbd recommends against (`github-merge: unconditional`
  and `pr-review-requirements: none`), and only when the user explicitly grants them.
  To make a policy unanswered again, delete its line by hand.

- **Agents record only explicit grants.** An agent records a grant only when the user
  explicitly grants it in the conversation; it never infers a grant from memory or from
  earlier sessions. When the user authorizes sub-agents, record `subagents` with
  `tbd policy grant subagents` and tell the user (see `delegate-to-subagents`). For the
  other policies, record a standing grant when the user asks for one or agrees to one.
  Authorizing a single merge never records a merge grant.

- Agents change the block only through `tbd policy`; people may also edit it by hand.
  Recording a grant is an ordinary commit to `AGENTS.md`, and the agent tells the user.

| Policy | `grant` records | `revoke` records |
| --- | --- | --- |
| `github-workflows` | `granted` | `not-granted` |
| `github-editing` | `granted` | `not-granted` |
| `github-merge` | `per-request` | `not-granted` |
| `github-stacked-prs` | `granted` | `not-granted` |
| `subagents` | `granted` | `not-granted` |
| `pr-review-requirements` | `standard` | Not applicable: use `set` |
| `linear` | `epics` | `not-granted` |

## The Policy Block

The block lives inside the generated tbd block in `AGENTS.md`, immediately before its
`<!-- END TBD INTEGRATION -->` marker.
The rest of the tbd block reads the same in every project; only the policy block
differs.

```markdown
<!-- BEGIN TBD POLICY GRANTS v=1 -->
### Agent Policy Grants

The user granted these policies explicitly for this project. A user instruction in the
current conversation overrides them. For what each policy means, run
`tbd guidelines agent-policy-grants`; to change them, run `tbd policy`.

- `github-workflows`: granted
- `github-editing`: granted
- `github-merge`: per-request
- `github-stacked-prs`: granted
- `subagents`: granted
- `pr-review-requirements`: standard
- `linear`: not-granted

Recorded 2026-09-16.
<!-- END TBD POLICY GRANTS -->
```

Line by line:

- **Markers:** `<!-- BEGIN TBD POLICY GRANTS v=1 -->` and
  `<!-- END TBD POLICY GRANTS -->`, each on its own line.
  `v=1` is the version of this block syntax, the one this document defines.
  tbd neither reads nor rewrites a block with a version it does not know; it reports it
  and asks for an upgrade.
- **Heading:** `### Agent Policy Grants`, nested under the tbd block’s `## tbd`.
- **Prose:** the fixed paragraph shown above.
  When reading, tbd ignores every line between the markers that is not a grant line;
  when writing, it regenerates the prose, so text added by hand there is lost.
- **Grant lines:** one per policy: a bullet, the policy name in backticks, a colon, a
  space, and the value to the end of the line, with surrounding whitespace trimmed.
  A policy name matches `[a-z][a-z0-9-]*`. tbd writes the seven policies in the order of
  the table above, then any names it does not recognize in the order found.
- **Recorded line:** `Recorded YYYY-MM-DD.`, the date the block was last written.
  tbd rewrites it on every write; update it when editing by hand.

The form of a grant line, with `<policy>` and `<value>` as placeholders:

```text
- `<policy>`: <value>
```

A block is **malformed** when a marker is missing or the version is unknown, a grant
line does not match the form above, a policy is listed twice, the block sits outside the
tbd block, or `AGENTS.md` holds more than one block.
`tbd doctor` reports it; until it is fixed, agents treat every policy as unanswered and
tell the user.

**Persistence.** `tbd setup` reads the existing block before regenerating the tbd block
and writes it back unchanged, including policy names it does not recognize, which may
come from a newer release.
Setup never adds, removes, or changes a grant without an explicit flag or command.
A tbd release without grant support refuses to rewrite the tbd block (its begin marker
carries a newer integration format) and stops with an upgrade message, so an old release
cannot delete grants.

## Grants in the Workflows

- **Review and addressing:** publishing reviews, pushing fixes, and posting disposition
  replies are PR actions and require `github-editing`; re-running CI or editing issues
  and labels along the way requires `github-workflows`. Without the grant an action
  needs, ask once before the first GitHub mutation in a task.
- **Merging:** requires `github-merge`. With `per-request`, the user’s “reviewed and
  merged” request is the authorization for the PRs it names.
  With `not-granted`, ask before merging.
- **Review coverage:** `pr-review-requirements` decides which reviews the orchestrated
  workflow runs and what the merge gate checks (see `pr-review-workflows`).
- **Delegation:** requires `subagents`. Before the first delegation in a task, check the
  conversation, then the project block, then a user-level grant if the project has not
  answered; if it is not granted and it is not clear the user would want sub-agents, ask
  once. A request for depth or thoroughness is not authorization.
- **Stacked PRs:** with `github-stacked-prs: granted`, the setup process installs the
  stack tooling (`ensure-gh-cli.sh --with-stack`, as `setup-github-cli` describes), and
  agents follow `stacked-prs` when a change is best split into dependent PRs or the user
  asks for a stack. With `not-granted`, agents neither install the tooling nor create or
  submit stacks, and propose separate PRs instead; they still follow the stack rules in
  `address-pr-review` and `pr-review-workflows` when a PR someone else stacked is under
  review.
- **Linear:** agents set up, enable, or run Linear sync only under a `linear` value
  other than `not-granted`, over the selection that value names.
  The grant is consent for agents, not a switch inside tbd: a project whose
  `.tbd/config.yml` already enables the Linear integration keeps syncing, and the setup
  process asks the user to record the matching grant.

## Setup Questions

The setup process asks about unanswered policies in one message, for the project as a
whole (all agents on the repository), giving each recommendation and meaning.
For an upgraded project it also shows the current grants for review, and offers to
change an answered policy only when the user asks.

- `github-workflows` (recommended: `granted`): agents may run the rest of a GitHub
  workflow end to end through `gh`, the API, or MCP servers: issues, labels, and
  re-running or cancelling CI runs.
- `github-editing` (recommended: `granted`): agents may push branches and create,
  review, edit, and comment on PRs and watch CI through any tool, but not merge.
- `github-merge` (recommended: `per-request`): agents may merge a PR the user named in
  the current request once its review requirements are met; `unconditional` merges
  without per-case authorization and is not recommended.
- `github-stacked-prs` (recommended: `granted`): agents may install the `gh stack`
  tooling and create, submit, sync, and merge formal stacks when a change is best split
  into dependent PRs.
- `subagents` (recommended: `granted`): agents may delegate to sub-agents following
  `delegate-to-subagents`.
- `pr-review-requirements` (recommended: `standard`): every PR gets one senior
  engineering review and one addressing pass, plus a dedicated security, performance, or
  correctness review when it is sensitive in that area; a custom value adds kinds or
  rounds.

Accept “yes, all recommended automations and review policies”, which records the
recommended set; individual answers; or “not now”, which leaves a policy unanswered
until the next run.

Ask about Linear separately: does the user use Linear and want tbd to sync beads with
it? “No” records `linear: not-granted`. “Yes” records `linear: epics`, which syncs open
epic beads only, in both directions, unless the user chooses `epics + specs` or a custom
selection configured through `setup-linear`.

After recording the answers, note what the grants need: `gh` authentication for any
GitHub grant (`setup-github-cli`), the stack tooling for `github-stacked-prs`, and
Linear authentication and configuration for `linear` (`setup-linear`).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
