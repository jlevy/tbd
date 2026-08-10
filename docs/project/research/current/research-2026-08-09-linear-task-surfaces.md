# Research: Linear as a Task Surface for Beads and Agents

**Date:** 2026-08-09

**Author:** Research brief (AI-assisted; official Linear developer docs plus live API
probes against a real workspace)

**Status:** Complete for API facts and landscape survey.
Design options are mapped but deliberately not decided.

**Related:**

- [How Coding Agents Listen On and Monitor Issues](research-2026-06-04-agent-issue-monitors.md)
  — trigger and dispatch mechanics; the pattern taxonomy this doc reuses
- [Claude Code Orchestration Interfaces and UIs](research-claude-code-orchestration-and-uis.md)
  — OpenAI Symphony, the reference Linear-polling orchestrator
- [Agent Coordination Kernel](research-agent-coordination-kernel.md) — durable truth vs.
  live coordination
- [API References for Bridge Integrations](api-references-bridge-integrations.md) —
  GitHub and Slack bridge APIs.
  PR #197 adds a Linear §5 to that file; see
  [Corrections](#2-corrections-to-the-pr-197-5-notes) below before merging it.
- PR [#205](https://github.com/jlevy/tbd/pull/205) — the provider-neutral `tbd changes`
  / `tbd watch` primitive this work would consume

* * *

## Overview

This brief answers three questions, in order:

1. What does the Linear API actually support, verified rather than assumed?
2. What is the full option space for using Linear to track tasks, including beads, from
   a CLI?
3. What are the ways tasks can be *visualized* and *manipulated by agents*, and what are
   people actually doing today?

Two further use cases are worked through in place: replacing a hand-maintained root
`TODO.md` with an epic board
([§5.6a](#56a-worked-example-linear-as-the-top-level-todo-replacing-todomd)), and
date-driven recurring tracking at scale
([§8](#8-date-driven-recurring-tracking-at-scale)).

A fourth question arrived mid-research and is answered in
[§8](#8-date-driven-recurring-tracking-at-scale): can Linear track a few hundred
date-driven recurring items per month (earnings by ticker), and at what granularity?

The headline finding is that Linear is an excellent *review and delegation surface* and
a poor *system of record for wide, uniform, recurring datasets*. That distinction drives
most of the recommendations here.

**Method note:** every fact in [§1](#1-verified-api-facts) was probed live against the
`Finterm` workspace on 2026-08-09 using the `LINEAR_API_KEY` in `.env`, not read from
docs alone. Several published facts turned out to be wrong or incomplete.
Probe commands are reproducible from [Appendix A](#appendix-a-reproducible-probes).

* * *

## 1. Verified API facts

### 1.1 Transport and auth

- **Single GraphQL endpoint**, no REST: `https://api.linear.app/graphql`. Introspection
  is enabled (1,132 types, 361 mutations as of the probe).
- **Personal API key**: raw header `Authorization: <API_KEY>`, with no `Bearer` prefix.
  This is the trip-hazard; `Bearer` is for OAuth access tokens only.
- **OAuth2** for multi-user apps, plus `actor=app` mode for agents (see
  [§6.4](#64-linear-native-agent-sessions)).
- Partial success is normal: a GraphQL error can arrive with **HTTP 200**, so a bridge
  must check the `errors` array rather than the status code.

### 1.2 Rate limits, measured

Observed response headers, which **disagree with the published table**:

| Quota | Documented | Observed on this key |
| --- | --- | --- |
| Requests/hour | 5,000 | **2,500** |
| Complexity points/hour | 3,000,000 | 3,000,000 (matches) |

Measured complexity cost per operation, from the `X-Complexity` response header:

| Operation | Points |
| --- | --- |
| `issueDelete` | 2 |
| `issues(first:10)` with state, assignee, labels, parent | 10 |
| Team states + labels | 53 |

**Assessment:** complexity is not the binding constraint at any plausible tbd scale.
The 2,500 requests/hour ceiling is, and it is half what the docs promise, so a poller
must read `X-RateLimit-Requests-Remaining` rather than trusting the documented number.
Rate limiting returns **HTTP 400** with `"code": "RATELIMITED"`, not HTTP 429, so error
handling keyed on 429 will silently mis-classify it.

### 1.3 Pagination

- Default page size **50**; **maximum 250**, enforced by an argument validation error.
  The maximum is *not stated on the pagination docs page* and was found by probing
  `first: 500`.
- Relay-style cursors: read `pageInfo.endCursor`, pass as `after`, loop while
  `hasNextPage`.
- `orderBy: updatedAt` plus an `updatedAt` filter is the incremental-sync primitive.

### 1.4 Entity model, for field mapping

- **Identifiers**: human-facing `TEAMKEY-123` per-team sequence, plus a stable UUID on
  every entity. Store the UUID as the canonical link and display the identifier.
  The sequence does **not** reuse numbers after deletion (verified: deleting `FIN-5` did
  not return the next create to 5).
- **Priority** is a plain integer, and is *not* ordered by severity:
  `0 = None, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low`.
- **Status** is a per-team `WorkflowState` object with a user-editable `name` and a
  machine-meaningful `type`. Mutation requires the target state’s UUID (`stateId`), so a
  bridge must resolve state UUIDs per team and cache them, mapping on `type`, never on
  `name`.
- **`WorkflowState.type` is a `String!` scalar, not a GraphQL enum.** Observed values in
  one default team include `duplicate`, which is absent from the commonly cited
  six-value list. Treat the value set as **open** and fail soft on unknown types.
- **Descriptions** are markdown.
  **Labels** are workspace- or team-scoped objects with UUIDs.
  **Assignee** and **delegate** are both filterable user references.
- Delta-query timestamps are exposed: `updatedAt`, `archivedAt`, `completedAt`,
  `canceledAt`, `triagedAt`, and more, each with a typed comparator in `IssueFilter`.

### 1.5 There are no custom fields

The `Issue` type has **85 fields, none of them user-definable**. The only schema match
for “custom” is `CustomView`, which is a saved filter, not a field.
`Template` is an issue-creation template, not a schema extension.

Any structured per-issue data beyond Linear’s fixed schema must be encoded into the
title, the markdown description, labels, or an attachment.
There is no user-defined typed column.

**Label groups are the workaround, and they are better than they sound.** `IssueLabel`
carries `isGroup: Boolean`, `parent`, and `children`, and `IssueLabelCreateInput`
exposes both `isGroup` and `parentId`, so an agent can create them.
Linear enforces that **only one label from a given group can be applied to an issue at a
time**, with a limit of **250 labels per group**.

A label group is therefore a **single-select enum column in everything but name**. It is
filterable, groupable, and usable as board columns (`issueGrouping` plus
`issueGroupingLabelGroupId`, see [§5.1](#51-what-defines-a-view)). What you still do not
get is free-text, numeric, or date custom fields, so anything you want to *sort
numerically* or *compute on* still has no home.

### 1.6 Writes and idempotency

`issueCreate` accepts a client-generated `id`. This is widely described as making
retries safe. **It does not.** Re-issuing the identical mutation returns:

```json
{"errors":[{"message":"conflict on insert of Issue",
  "extensions":{"code":"INPUT_ERROR","statusCode":400,"userError":true,
  "userPresentableMessage":"Entity Issue with id <uuid> already exists."}}],"data":null}
```

The create is *not* idempotent.
It is **deterministically conflict-detecting**, which is still useful but requires the
caller to treat that specific error as success.
A bridge that retries a timed-out create and treats the 400 as a failure will report
false errors and potentially loop.

**`attachmentCreate` is a true upsert, keyed on `url`, and it is the idempotent write
primitive this API otherwise lacks.** Verified by live test: creating an attachment
twice with the same `url` on the same issue returns the **same attachment id** and
replaces `title`, `subtitle`, and `metadata` in place.
No duplicate is created and no error is raised.

Two further verified properties, both contradicting or exceeding the documentation:

- **`metadata` accepts nested objects and arrays**, despite being documented as taking
  “string and number values”.
  A payload of `{"labels":["backend","auth"],"deps":{"blocks":["tbd-a","tbd-b"]}}`
  round-tripped intact.
- **Arbitrary URL schemes are accepted**, not just `http(s)`. `tbd://bead/tbd-x1y2`
  worked as an attachment key.

Together these make attachments the natural carrier for structured per-bead data that
Linear’s fixed issue schema cannot hold ([§1.5](#15-there-are-no-custom-fields)): a
stable `tbd://bead/<id>` URL is the idempotency key, and `metadata` holds the full field
set. Unlike `issueCreate`, a retried attachment write is safe with no conflict handling.

Batch mutations exist and are useful for bulk work:

- **`issueBatchCreate`** — documented as “Creates a list of issues in one transaction.”
- **`issueBatchUpdate`** — takes one `IssueUpdateInput` plus a list of ids.

### 1.7 Webhooks

- Cover issues, comments, labels, attachments, projects, documents, initiatives, cycles,
  customers, customer requests, and users, plus issue SLA and OAuth revocation events.
- Require a **publicly accessible HTTPS non-localhost URL** answering **HTTP 200 within
  5 seconds**.
- Verified by HMAC-SHA256 of the raw body in the `Linear-Signature` header, with a
  `webhookTimestamp` to reject replays older than roughly 60 seconds.
- Retries are **3 attempts** at 1 minute, 1 hour, and 6 hours, after which the webhook
  can be auto-disabled.

**Assessment:** webhooks are unusable from a laptop or sandboxed CLI. More importantly,
with only 3 retries and auto-disable, **polling is the reconciliation path regardless**.
Poller code written for the pilot is not throwaway scaffolding; it is the durable
correctness layer that a later webhook fast-path sits on top of.

* * *

## 2. Corrections to the PR #197 §5 notes

PR #197 adds a Linear section to `api-references-bridge-integrations.md`. Four of its
claims are contradicted by live probing and should be fixed before that merges.
This file is **not** edited here, to avoid a conflict with that PR.

| Claim in PR #197 §5 | Verified 2026-08-09 |
| --- | --- |
| API key: 5,000 requests/hour | **2,500** observed in `X-RateLimit-Requests-Limit` |
| `WorkflowState.type` is “a typed field drawn from six values” | It is a **`String!` scalar**, and a default team exposes a seventh value, `duplicate` |
| “Idempotent-ish writes … helps make create retries safe” | Duplicate `id` **hard-errors** with `INPUT_ERROR` / `statusCode 400`. Safe only if the caller treats that error as success |
| Pagination limits unstated | Default **50**, hard maximum **250** |

Two additions worth folding in: rate limiting surfaces as **HTTP 400 `RATELIMITED`**,
not 429; and **`issueBatchCreate` / `issueBatchUpdate`** exist.

* * *

## 3. The option space: five topologies

Ordered by increasing coupling.
Each is a real product, not a strawman.

### T1. Linear only, no beads

Agents talk to Linear directly via MCP or a CLI. tbd is not involved.

- **For:** zero new code; Linear stays the single source of truth; humans get the full
  UI.
- **Against:** loses git-native history, offline work, and per-branch issue state.
  Every agent read is a network round trip subject to the 2,500/hour ceiling.
  No `tbd ready` dependency semantics.

### T2. Beads only, Linear as a read-only mirror

tbd remains the source of truth.
A one-way exporter projects a filtered subset into Linear for human visibility.

- **For:** no conflict model needed at all.
  Deletion of the Linear side is non-destructive.
  Trivially safe to pilot and to abandon.
- **Against:** humans cannot act in Linear; edits there are silently overwritten, which
  is confusing unless the mirror is visibly marked read-only.

### T3. Linear as intake, beads as execution

Humans and customers file into Linear.
A promotion step pulls selected issues into beads, where agents execute.
Status flows back one way.

- **For:** matches how the work actually flows.
  Linear’s triage and intake features are genuinely good.
  Only one writer per field, so no merge algebra.
- **Against:** needs a durable link table and a promotion policy.
  Two places to look for “what is open”.

### T4. Bidirectional sync on a linked subset

The design already drafted in `plan-2026-07-20-linear-bead-sync-pilot.md`: a `linked`
field, per-field last-writer-wins on a bounded subset.

- **For:** the full experience; either side can act.
- **Against:** every hard problem at once.
  Field-level conflict resolution, echo suppression, clock skew, and the `WorkflowState`
  mapping. PR #205 explicitly defers this pending extension-namespace merge support
  (`tbd-le2l`, `tbd-z95g`). See
  [§7a](#7a-bidirectional-git-sync-it-has-been-done-and-how) for the git-bug precedent:
  proven possible, but earned with an operation-based CRDT data model, and even then
  limited to a four-field surface.

### T5. Linear as the agent control plane

Linear’s native agent sessions drive work; beads is the durable execution log.
Delegating a Linear issue to the tbd app user wakes an agent.

- **For:** the cleanest human affordance.
  Delegation preserves human ownership by design.
  No custom UI to build.
- **Against:** requires a hosted OAuth app with a public webhook endpoint.
  Not reachable from a laptop pilot.

**Reading:** T2 and T3 are the only options that are safe to pilot without the extension
namespaces PR #205 lists as prerequisites, because neither requires merging concurrent
writes to the same field.

* * *

## 4. CLI surfaces

### 4.1 What already exists

| Tool | Language | Notable |
| --- | --- | --- |
| [schpet/linear-cli](https://github.com/schpet/linear-cli) | Node/Deno | Git and jj aware, infers issue from branch name; `--json`; ships a Claude Code skill |
| [Securiteru/linear-cli](https://github.com/Securiteru/linear-cli) | Go | Static binary, 35+ commands, `--json`, `-q` id-only mode, stdin JSONL batch create |
| [nesszer/linear-cli](https://github.com/nesszer/linear-cli) | Rust | Issues, projects, cycles |
| [evangodon/linear-cli](https://github.com/evangodon/linear-cli) | Node | Older, TUI-leaning |

Both leading tools independently converged on the same agent affordances: `--json`
everywhere, an id-only quiet mode for shell pipelines, and batch create from stdin.
That convergence is a strong signal about what a `tbd bridge` surface should expose.

### 4.2 The four ways an agent can reach Linear from a terminal

1. **Raw GraphQL via `curl`** — zero dependencies, works today, and is what every probe
   in this brief used. Verbose, and pushes schema knowledge into prompts.
2. **A third-party CLI** — ergonomic, but adds a supply-chain dependency subject to the
   14-day cool-off in `SUPPLY-CHAIN-SECURITY.md`.
3. **The official MCP server** — `https://mcp.linear.app/mcp` (Streamable HTTP), with a
   read-only variant at `https://mcp.linear.app/mcp/readonly`. Roughly 21 tools.
   Native support in Claude Code, Cursor, VS Code, Windsurf, Zed.
4. **A `tbd bridge` subcommand** — full control, no new dependency, and the only option
   that can write directly into the bead store.

The **read-only MCP endpoint deserves emphasis**. It makes “let an agent look at Linear”
a genuinely low-risk default, separating read access from write access at the transport
rather than trusting prompt instructions.

* * *

## 5. Visualization surfaces

A taxonomy of every way these tasks could be seen, from zero build cost upward.
[§5.5](#55-worked-example-a-few-dozen-tickers) and
[§5.6](#56-worked-example-mirroring-trading-repo-plan-specs) apply this to two concrete
datasets.

### 5.1 What defines a view

Probed against the live schema, a Linear view is **two separable objects**, and an agent
can create both:

1. **`CustomView`** holds the *filter*: `filterData` (an `IssueFilter`),
   `projectFilterData`, `initiativeFilterData`, plus `name`, `icon`, `color`, and
   `shared`. Created with `customViewCreate`.
2. **`ViewPreferences`** holds the *presentation*, attached to a view via
   `customViewId`. Created with `viewPreferencesCreate`, which takes a `preferences`
   JSON object and, notably, a separate `insights` JSON object for the view’s chart.

`ViewPreferencesValues` exposes roughly 200 knobs.
The ones that matter:

| Knob | Effect |
| --- | --- |
| `layout` | list, board, or timeline |
| `issueGrouping` / `issueSubGrouping` | **two levels** of grouping |
| `issueGroupingLabelGroupId` | group by a **label group**, the single-select workaround from [§1.5](#15-there-are-no-custom-fields) |
| `viewOrdering` / `viewOrderingDirection` | sort axis |
| `issueNesting`, `showSubIssues`, `showParents` | parent/child display |
| `field*` (about 20 of them) | which columns show: `fieldDueDate`, `fieldLabels`, `fieldEstimate`, `fieldProject`, `fieldCycle`, `fieldTimeInCurrentStatus`, and so on |
| `showSnoozedItems`, `showCompletedIssues` | noise control |
| `hiddenColumns`, `columnOrderList` | column layout |

**The practical upshot:** an agent can construct a fully configured, shared, named view
and hand a human a stable URL. That is a much stronger capability than “an agent can
create issues”, and it is the single most underused part of the Linear API for this use
case.

### 5.1a What is *not* API-reachable

`Dashboard` exists as a type, with `widgets`, `issueFilter`, and `projectFilter`, but
**there are no `dashboard*` mutations at all**. Dashboards and Insights charts are
readable and configurable by humans in the UI only.
An agent can set a *view’s* insight parameters through `viewPreferences.insights`, but
it cannot assemble a multi-widget dashboard.

### 5.1b Containers and grouping levels

- **Cycles**: time-boxed, the natural weekly batch.
- **Projects**: `startDate`, `targetDate`, `health`, `lead`, `priority`, `status`,
  **project labels**, and **milestones**. `ProjectFilter` supports about 40 dimensions
  including `hasBlockingRelations` and `nextProjectMilestone`.
- **Initiatives**: the level above projects.
- **Roadmaps**: `Roadmap` plus `RoadmapToProject`, creatable via API.
- **Documents**: `documentCreate` / `documentUpdate` / `documentDelete`, with `content`
  markdown and attachment to a `project`, `initiative`, `team`, `issue`, or `cycle`.
  This is the right home for mirrored spec prose, and is used in
  [§5.6](#56-worked-example-mirroring-trading-repo-plan-specs).
- **Triage / Intake** inbox for unplanned incoming work.

### 5.2 Terminal

- `tbd list`, `tbd ready`, `tbd blocked`, `tbd stale`, `tbd show`, `tbd stats` today.
- `tbd dep` for the dependency graph, which is the one view **Linear cannot render**.
  Linear has parent/sub-issue and blocking relations, but no DAG visualization and no
  equivalent of `tbd ready` computed transitively over blockers.
- Third-party CLIs above for the Linear side.

### 5.3 Generated and custom

- **`packages/tbd/scripts/bead-web.ts` + `bead-web.html`** already exist in this repo as
  an untracked local demo: a live web view driven by the watch infrastructure.
  This is the natural place to prototype a combined view, and it costs nothing external.
- Static HTML or Mermaid dashboards generated from `tbd list --json`.
- A Phoenix-LiveView-style operator dashboard, as Symphony does.

### 5.4 What each surface is actually good at

| Question | Best surface |
| --- | --- |
| “What can I work on right now?” | `tbd ready` (transitive blockers) |
| “What is the team’s status?” | Linear board or cycle |
| “What is blocking this?” | `tbd dep` graph |
| “What changed since I last looked?” | `tbd changes --since` (PR #205) |
| “What needs my decision?” | Linear Triage |
| “How are we trending?” | Linear Insights |

No single surface wins.
That is an argument for T2 or T3, where each side keeps what it is good at, rather than
T4, which tries to make both surfaces equivalent.

### 5.5 Worked example: a few dozen tickers

At a few dozen rather than a few hundred, the
[§8](#8-date-driven-recurring-tracking-at-scale) volume objection disappears.
The question becomes what shape makes the analysis legible.

**Model:** one issue per ticker per earnings event.
Title `AAPL Q3 FY26 earnings`, `dueDate` set to the report date, `snoozedUntilAt` set to
the morning of that date.

**Encode the analysis as label groups**, one group per axis, each single-select:

| Label group | Members | Why a group |
| --- | --- | --- |
| `sector/` | `tech`, `energy`, `financials`, … | board columns by sector |
| `conviction/` | `high`, `medium`, `low`, `pass` | the main triage axis |
| `stage/` | `unreviewed`, `prepped`, `reported`, `analyzed`, `written-up` | pipeline position |
| `outcome/` | `beat`, `inline`, `miss`, `n-a` | post-event, drives review |
| `thesis/` | `confirmed`, `weakened`, `broken`, `unchanged` | what actually matters |

Five groups times a handful of members each is a few dozen label objects total, which is
well inside the 250-per-group limit and does not degrade the label picker.
Contrast this with one label per ticker, which is the anti-pattern.

Then the views a human actually wants, each one constructible by an agent:

| View | Layout | Grouping | Filter |
| --- | --- | --- | --- |
| **This week’s slate** | board | `stage/` | `dueDate` within 7 days |
| **Prep queue** | list, ordered by `dueDate` | `conviction/` | `stage/unreviewed` or `prepped` |
| **Sector board** | board | `sector/` | current cycle |
| **Post-earnings review** | list | `outcome/` | `stage/reported`, sorted by `updatedAt` |
| **Thesis changes** | list | `thesis/` | `thesis/` is `weakened` or `broken` |
| **Calendar** | timeline | none | all, by `dueDate` |

**What still does not work.** Numeric analysis output such as consensus EPS, actual EPS,
surprise percentage, or price reaction has **no typed home**. You cannot sort by
surprise percentage or filter to “surprise greater than 5%”. Options, all imperfect:
bucket it into a label group (`surprise/big-beat`, `surprise/small-beat`, …), which
restores sorting at the cost of precision; put exact figures in the description for
reading; or keep the numbers in the real analysis store and link out with an
`attachment`. In practice, bucket the axis you filter on and link out for the rest.

**Verdict:** for a few dozen tickers this works genuinely well.
The label-group modelling is the whole game, and it is worth doing deliberately up
front, because relabelling several hundred issues later is painful.

### 5.6 Worked example: mirroring trading repo plan specs

The trading repo currently has **110 active plan specs** in
`docs/project/specs/active/`. That is a very different shape from the ticker case: fewer
status transitions, much more prose, and a strong dependency structure.

**The mapping decision is which Linear object a spec becomes**, and there are three
credible answers:

| Spec becomes | Gains | Loses |
| --- | --- | --- |
| **An issue** | Status, assignee, cycle, delegation to agents, sub-issues, relations | Prose is crammed into one description field |
| **A project** | `startDate`/`targetDate`, milestones, health, project updates, timeline and roadmap views, and rolls up child issues | 110 projects is a lot; project lists are not designed for that count |
| **A document** attached to a project or initiative | Full markdown fidelity, real editing | No status, no assignee, not schedulable, weak filtering |

**The shape that actually fits: a hybrid.** One **project per spec** for the dozen or so
specs that are genuinely active workstreams, each with a **document** holding the
mirrored markdown and **issues** for the tasks inside it.
The remaining ~100 specs, which are mostly complete or dormant, mirror as **documents
only**, attached to an initiative per theme.
Documents cost nothing to hold, keep full prose, and are searchable, and you promote one
to a project when work restarts.

Views over that, all of which are `projectFilterData` plus `projectLayout`:

| View | Layout | Grouping | Filter |
| --- | --- | --- | --- |
| **Active workstreams** | board | `health` | `state` is started |
| **Roadmap** | timeline | initiative | has `targetDate` |
| **Stalled** | list | `lead` | `updatedAt` older than 30 days, state started |
| **Blocked** | list | none | `hasBlockedByRelations` is true |
| **By theme** | board | initiative | all |

Two honest caveats. First, `projectGroupingDateResolution` and the timeline views assume
projects have real dates; 110 specs mostly do not, and inventing dates to populate a
Gantt chart produces a chart nobody trusts.
Second, **the spec dependency graph does not survive the trip.** Linear has project
relations (`hasBlockingRelations`, `hasDependsOnRelations`) and issue blocking
relations, but renders neither as a graph and has no transitive readiness computation.
`tbd ready` and `tbd dep` stay strictly better for “what is actually unblocked”, which
is the strongest argument for keeping beads as the source of truth and treating Linear
as the review surface.

**Direction:** mirror specs **one way**, from repo to Linear.
Specs are authored in the repo next to the code, reviewed in git, and their canonical
form is a markdown file.
Round-tripping edited prose back through `documentUpdate` buys little and risks
clobbering. Status and priority are the only fields worth considering for a return path,
and even those are better handled by promoting a spec to a project and tracking status
on the project.

### 5.6a Worked example: Linear as the top-level TODO, replacing `TODO.md`

The proposal: stop maintaining a root `TODO.md` and let Linear hold the prominent and
in-flight epics, especially those tied to plan specs already in git, tracked across all
branches and linked to their PRs.

**This is the strongest Linear use case in this brief**, and the numbers are why.

#### Why the cardinality is right

Measured in this repo on 2026-08-09:

| Population | Count |
| --- | --- |
| Total beads | 1,312 |
| Active (open, in progress, blocked, deferred) | 217 |
| **Active epics** | **21** |
| Active epics carrying a `spec_path` | **14** |

That is a **10:1 filter from active work to epics**, landing on roughly two dozen items.
It sits exactly in the comfortable band from
[§8.5](#85-recommendation-and-the-reasoning-behind-it), fits the free tier with room to
spare, and every item is something a human genuinely committed to.
This is the exception-promotion principle applied to the repo’s own work rather than to
tickers, and here the promotion rule is already computable:
`kind == epic AND status is active`. No new classification is needed.

#### The asymmetry that actually matters: beads are cross-branch, specs are not

The request is to track epics “across all branches”.
Half of that is already true, and the other half is the real design problem.

- **Beads are already branch-independent.** They live on the `tbd-sync` branch, shared
  by the main checkout and every linked worktree.
  An epic is visible from any branch today.
- **Specs are branch-local.** Verified: `docs/project/specs/active/` holds **15** specs
  on `claude/watch-infrastructure` and **11** on `main`. Four specs on this branch do
  not exist on `main` at all.

So `spec_path` is a **path into a branch-local file**, and a bead can carry a
`spec_path` that does not resolve on the branch you happen to be standing on.
Any projection of epics into Linear inherits this: a naive mirror produces links that
404 depending on who clicks them and when.

**The fix is to project a permalink, not a path.** When mirroring, resolve `spec_path`
against the branch where the spec actually lives and emit a
`https://github.com/<org>/<repo>/blob/<sha-or-branch>/<path>` URL. A commit SHA is
stable forever but goes stale as the spec evolves; a branch ref stays current but breaks
when the branch merges or is deleted.
**Recommendation: branch ref while the epic is in flight, rewritten to the merge commit
SHA when the epic closes.** This is also the honest motivation for a `spec/` label group
carrying the branch name, so a Linear view can group epics by which branch their spec
lives on.

#### What Linear adds that tbd does not have

**PR linkage is the clearest gap.** The tbd `IssueSchema` has **no PR or branch field**.
The only place such a link could live today is the generic `extensions` record, which is
exactly the field blocked by whole-object LWW ([§7c.5](#7c5-the-actual-gaps)).

Linear supplies this natively and well:

- `attachmentLinkGitHubPR(issueId, url, linkKind, title)` for explicit linking,
  alongside `attachmentLinkGitHubIssue` and `attachmentLinkURL`.
- The native GitHub integration auto-links by **branch name**, and can transition status
  on PR merge.
- With Releases ([§5.7](#57-surfaces-beyond-the-issue-tracker)), status can transition
  on *deploy* rather than merge, so a top-level board could show what is actually live.

This is a genuinely favourable trade: Linear provides PR and branch plumbing that tbd
would otherwise have to build and maintain, and it is plumbing tbd has deliberately not
built.

#### Shape

**One-way projection, epic to Linear issue.** This is
[T2](#3-the-option-space-five-topologies) and needs none of
[§7b.2](#7b2-what-a-second-non-git-replica-breaks)’s machinery, because nothing is ever
imported back.

- **Epic becomes a Linear issue**, not a project.
  Twenty-one projects would overwhelm the project list, and projects are heavyweight
  objects built for date-bounded workstreams.
  Promote only the two or three largest in-flight epics to projects if they need
  milestones.
- **Do not mirror child beads.** The entire value is the 10:1 filter.
  Child counts and a link back to `tbd show <id>` are enough.
- **Label groups** ([§1.5](#15-there-are-no-custom-fields)): `branch/` for the branch
  the work lives on, `spec/` for has-spec versus no-spec, `stage/` for the epic’s own
  lifecycle.
- **Description** carries the generated block: spec permalink, child bead counts, `tbd`
  command to open it locally, and the ready/blocked summary.
- **Attachments** carry the PR links.

Views this produces, none of which `TODO.md` can offer: board grouped by `branch/` to
see what is in flight where; list filtered to epics with no open PR; list of epics whose
spec is on a branch not yet merged; and anything sorted by staleness via `updatedAt`.

#### Compared with the alternatives

`TODO.md` is not the only incumbent worth beating.
Three options, honestly compared:

|  | Hand-maintained `TODO.md` | **Generated `TODO.md`** | Linear epic board |
| --- | --- | --- | --- |
| Stays current | No, drifts immediately | **Yes, derived from beads** | Yes, if the projector runs |
| In git, greppable, offline | Yes | **Yes** | No |
| Merge conflicts | **Yes, constantly** | Only if committed on many branches | None |
| Cross-branch view | No, branch-local | Branch-local unless generated on main | **Yes** |
| PR links | Manual | Possible, but tbd has no PR field | **Native** |
| Status, assignee, comments | No | No | **Yes** |
| Team can see it without the repo | No | No | **Yes** |
| New moving parts | None | A generator | A projector plus credentials |

**The generated `TODO.md` deserves serious consideration and is probably the first thing
to build.** It removes the actual pain of `TODO.md`, which is hand-maintenance and merge
conflicts, at a fraction of the cost of a Linear bridge, and it keeps the artifact in
git where specs and code already live.
`tbd list --kind epic --status open` plus a template is most of it.

The Linear board wins on exactly two axes, and they are the two the `TODO.md` format can
never win: **a cross-branch view that does not depend on which branch you checked out**,
and **visibility for people who do not clone the repo**. If neither of those matters,
generate the file.

#### Recommendation

**Build the Linear projection; defer the generated file.** See
[§9.0](#90-agreed-priority-order) for the decided order.
The generated `TODO.md` is a reasonable idea whose output format is not yet settled, and
shipping a second generated to-do surface alongside beads risks agents disagreeing about
which list is authoritative.
The cross-branch view and visibility-without-a-clone are the two things only Linear
provides, and they are the reasons this use case exists.

The projector is one-way, idempotent by external id
([§1.6](#16-writes-and-idempotency)), and safe to run from any agent because it never
imports.

The one piece worth building on the tbd side regardless is **a PR link field**, or the
`extensions` namespace fix that would let one live there.
It is useful for the generated file, for the Linear projection, and for `tbd watch`
consumers independently.

### 5.7 Surfaces beyond the issue tracker

Linear in 2026 is substantially more than an issue tracker, and several of these
surfaces are more interesting for the use cases in this brief than the issue list is.
The authoritative inventory is the **`ViewType` enum, which has 70 values**. Grouped by
what they actually do:

**Work containers and planning**

- `project`, `projects*`, `projectDocuments`, `projectLabel`
- `initiative`, `initiativeOverview`, `initiatives*` (planned, proposed, completed,
  canceled) — the layer above projects
- `roadmap`, `roadmaps`, `roadmapAll/Backlog/Closed` — `Roadmap` and `RoadmapToProject`
  are creatable via API
- `cycle`, `completedCycle` — time-boxed batches
- `dashboards` — multi-widget, **read-only via API**
  ([§5.1a](#51a-what-is-not-api-reachable))

**Customer and revenue (a CRM-shaped surface)**

`customers`, `customer`, `embeddedCustomerNeeds`, `projectCustomerNeeds`. Backed by
`Customer`, `CustomerNeed`, and `CustomerTier`, with `customerCount`,
`customerImportantCount`, revenue, tier, and size available as **filter and sort
dimensions on issues and projects**.

This is the closest Linear comes to a typed numeric column, and it is worth noting for
[§5.5](#55-worked-example-a-few-dozen-tickers): the “who is asking for this and what are
they worth” axis is first-class, while “what was the earnings surprise” is not.
If a ticker-tracking model ever needs one genuine numeric dimension for prioritization,
the customer-revenue machinery is the only pre-built place it fits, and using it that
way would be a deliberate abuse of the abstraction.

**Code review and shipping**

- `reviews`, `myReviews`, `createdReviews` — a PR-review inbox, “sorted by proximity to
  shipping”. Backed by `Diff`, `DiffFile`, `PullRequestReviewTool`; reviews sync back to
  GitHub.
- `release`, `releaseOverviewIssues`, `releasePipelines`, `continuousPipelineReleases`,
  `scheduledPipelineReleases`. Backed by `Release`, `ReleasePipeline`, `ReleaseChannel`,
  `IssueToRelease`. **Business and Enterprise plans only** (15 pipelines on Business,
  unlimited on Enterprise).
  Continuous pipelines complete a release per deploy; scheduled pipelines add release
  dates and freezable stages.
  Issue status can transition on *release* events, so “Done” can mean reached production
  rather than merged.
- `automations` — backed by `GitAutomationState` and `GitAutomationTargetBranch`.

**Intake, attention, and agents**

- `triage` — plus `TriageResponsibility` and triage rules for routing
- `inbox`, `inboxPriority`, `inboxOther`, `focus`
- `feedAll`, `feedCreated`, `feedFollowing`, `feedPopular`, with `FeedItem`,
  `FeedItemFilter`, and `FeedSummarySchedule`. Note `feedItemFilterData` is a
  first-class filter slot on `CustomViewCreateInput`, alongside issue, project, and
  initiative filters.
- **`agents`** — a dedicated view for agent work, backed by `AgentSession`,
  `AgentActivity`, and `AgentAutomation*` types including usage-limit scopes.
  `showCompletedAgentSessions` is a view preference.

**Other**

`search`, `splitSearch`, `archive`, `quickView`, `label`, `subIssues`, `teams`,
`workspaceMembers`, `userProfile`, `myIssues*`, `issueIdentifiers`.

**Why this matters for the decisions in this brief**

1. **There is a dedicated agents view.** If tbd agents ever register as Linear app users
   ([§6.4](#64-linear-native-agent-sessions)), the operator dashboard discussed in
   [§7b.5](#7b5-the-alternative-tbd-serves-the-live-view-itself) partly exists already.
   That materially strengthens the T5 option and weakens the case for building agent
   observability from scratch, *if* hosting is acceptable.
2. **The customer/revenue surface is the only pre-built numeric prioritization axis**,
   which is a real, if awkward, answer to the missing-custom-fields problem.
3. **Releases could carry trading-repo spec status**, since issues can transition on
   deploy rather than merge.
   This is plan-gated and probably overkill, but it is the feature that would make
   Linear reflect what is actually live.
4. **The feed and focus surfaces are attention management**, which is precisely what
   [§8.5](#85-recommendation-and-the-reasoning-behind-it) argues the
   several-hundred-ticker firehose would destroy.
   They are worth understanding before deciding to flood them.

One caution on currency: Linear’s changelog describes an agent **“Loops”** capability
for recurring scheduled agent work, which would be directly relevant to recurring
earnings tracking.
**No `Loop` type appears in the introspected schema**, so it is either
very new, UI-only, or not yet API-exposed.
Verify before designing against it.

* * *

## 6. Agent manipulation surfaces

### 6.1 Poll and act

An agent loop reads `issues(filter:{updatedAt:{gt:$since}})`, acts, writes back.
Works from anywhere, no public endpoint, and is the reconciliation path even when
webhooks exist. This is what PR #205’s `tbd watch` provides on the bead side.

### 6.2 Webhook-driven

Low latency, but needs hosting and public HTTPS, and per [§1.7](#17-webhooks) cannot be
the only mechanism because of the 3-retry auto-disable.

### 6.3 MCP tool calls

The agent treats Linear as a tool namespace.
Best for interactive human-in-the-loop sessions; weaker for unattended runs, where
explicit CLI calls are more auditable and more easily replayed.

### 6.4 Linear-native agent sessions

Linear’s first-class answer to “assign an issue to an agent”:

- Agents install as **app users** via OAuth with `actor=app`, and **do not consume
  billable seats**.
- Assigning an issue to an agent sets it as **`delegate`**, not `assignee`, so human
  ownership is preserved.
  `delegate` is a filterable field on `IssueFilter`.
- An **`AgentSession`** is created automatically on mention or delegation, with state
  visible in the Linear UI.
- The agent must emit a **`thought` activity within 10 seconds** to acknowledge, and
  receives context via `promptContext`.
- Optional scopes `app:assignable` and `app:mentionable`. Note that `actor=app`
  integrations **cannot also request `admin` scope**.

This is the highest-quality trigger surface Linear offers, and it is where the ecosystem
is converging. It is also the one that most requires hosted infrastructure.

* * *

## 7. How people typically do this

Three patterns dominate, and they map cleanly onto the taxonomy in
[research-2026-06-04-agent-issue-monitors.md](research-2026-06-04-agent-issue-monitors.md).

**Pattern A: hosted daemon polls the tracker.** The reference implementation is
[openai/symphony](https://github.com/openai/symphony): a long-running service that reads
work from Linear, creates a per-issue isolated workspace, and runs Codex in app-server
mode inside it. Its architecture is worth copying in outline.
Policy lives in a version-controlled `WORKFLOW.md` where the prompt *is* the
configuration; there is no persistent database, with recovery driven entirely by tracker
plus filesystem state; multi-turn continuation re-checks issue state after each turn;
and there is stall detection with exponential backoff.
Symphony’s “Integration Layer” naming is the source of the constraint language in PR
#205.

**Pattern B: vendor-native delegation.** Linear ships an
[agents integration directory](https://linear.app/integrations/agents): delegate to
Codex from Linear, turn issues into PRs with Cursor cloud agents, or hand off to Devin.
The lifecycle is uniform across vendors: ticket, cloud sandbox, autonomous edit, PR,
human review. Zero build cost, at the price of the vendor owning the loop.

**Pattern C: CLI plus skill, human-triggered.** A developer runs an agent locally; the
agent uses a Linear CLI or MCP to read and update.
This is what `schpet/linear-cli` shipping a Claude Code skill is optimizing for, and it
is the lowest-ceremony option.

* * *

## 7a. Bidirectional git sync: it has been done, and how

Bidirectional sync between a git-native store and a SaaS tracker is not hypothetical.
It has been built, it works, and the way it was built constrains how tbd should approach
it.

### 7a.1 The prior art

**[git-bug](https://github.com/git-bug/git-bug) is the direct precedent.** Its own docs
state that bridges “are bi-directional, incremental, and speedy gateways to third-party
platforms,” with `git bug bridge push` and `git bug bridge pull`. Supported: **Jira,
GitHub, GitLab, Launchpad**. The stated benefits are exactly the ones tbd wants: offline
editing, instant browsing, a local archive if the platform goes away, and portability
between platforms.

**Two-way tracker sync is also a mature commercial category**: Unito, Exalate, OpsHub,
getint, and stacksync all sell it, several supporting Linear.
Field-level directionality rules are the standard product feature, for example status
owned by one side, labels by the other, description last-write-wins.

**Linear’s own GitHub integration is bidirectional** for the narrow slice it covers: PR
status, branch linking, commit references, and comments.

So the honest statement is not that this is undone.
It is that **bidirectional sync is common between two SaaS trackers, rare between a
git-native store and a SaaS tracker, and in the agent-orchestration ecosystem
specifically the convention has settled on one system of record.**

### 7a.1a git-bug’s two distinct sync layers

git-bug’s “synchronization” is **two different mechanisms with different guarantees**,
and conflating them is the main way to misread the precedent.

**Layer 1: peer sync over git remotes.** `git bug push` / `git bug pull` move
`refs/<namespace>/<id>` like any other git ref.
Because entities are append-only operation DAGs, divergence is resolved by *merging the
DAG*, not by choosing a winner.
The replay order is deterministic:

1. Load all commits and their `OperationPack`s.
2. **Validate the clocks against the DAG**: a parent’s Lamport clock may not be greater
   than or equal to its child’s, and a commit violating this is *refused*. This is what
   makes the ordering tamper-resistant rather than merely conventional.
3. Order operations by Lamport clock, breaking genuine ties (concurrent edits) by the
   **lexicographic order of the `OperationPack` id**, which is a content hash.

Clock values are stored as *tree entry names* (`create-clock-14`, `edit-clock-137`)
pointing at the empty blob, so they cost no network transfer.
Entity ids are `hash(first operation)`, and operation ids are `hash(json(op))`, giving
content-addressed identity throughout.
**Result: conflict-free, byte-deterministic convergence with no resolution policy.**

**Layer 2: bridge sync against a SaaS API.** This is a conventional importer/exporter
pair and gets none of layer 1’s guarantees.
The mechanism worth stealing is **how the binding and echo suppression are stored**: the
remote id is written as *metadata on the operation itself*, not into a side checkpoint
file.

- Bugs resolve by `CreateMetadata[metaKeyGithubUrl]` / `metaKeyGithubId`.
- Before importing any remote event, the importer calls
  `ResolveOperationWithMetadata(metaKeyGithubId, id)`; a hit means “this is our own
  echo” and it is skipped.
  **Echo suppression is therefore a durable property of the data, not a timestamp
  heuristic.**
- Identities map through `ResolveIdentityImmutableMetadata(metaKeyGithubLogin, login)`.
- The exporter emits a closed event set that matches the feature matrix exactly:
  `ExportEventBug`, `Comment`, `CommentEdition`, `StatusChange`, `TitleEdition`,
  `LabelChange`, plus `Nothing`, `Warning`, `RateLimiting`, `Error`.

**This is the single most directly applicable lesson for tbd.** Storing the external-id
binding *on the entity, in a namespaced metadata map* is precisely what `tbd-z95g`
(generic extension read/write) and `tbd-le2l` (merge extension namespaces independently)
would provide, and PR #205 already names external-ID bindings under extensions as the
right shape. git-bug is independent confirmation that this is the correct decomposition.

Two further design notes from the bridge docs, both cautionary: **one bridge equals one
project**, because git-bug has no “project” concept and so cannot decide where to export
a new issue; and the Jira bridge simply **drops fields with no git-bug equivalent**
(assignee, sprint, story points) rather than attempting to model them.

### 7a.2 Why git-bug can do it, and why that matters for beads

This is the part worth internalizing.
git-bug does not store issue *state* and then try to merge it.
From its
[data model design doc](https://github.com/git-bug/git-bug/blob/master/doc/design/data-model.md):

> As entities are stored and edited in multiple processes at the same time, it’s not
> possible to store the current state like it would be done in a normal application.
> If two processes change the same entity and later try to merge the states, we wouldn’t
> know which change takes precedence or how to merge those states.

Its answer is an **operation-based CRDT**. An entity is an append-only series of
`Operation`s, batched into `OperationPack`s, stored as git blobs under a tree, chained
as commits, and published under `refs/<namespace>/<id>`. Current state is *computed* by
replaying operations.
Ordering uses **Lamport logical clocks** rather than wall-clock timestamps, explicitly
because “you can’t rely on the time provided by other people.”

The consequence: **concurrent edits merge by construction.** Two people editing the same
issue offline produce two operation sets that both apply.
There is no field-level conflict to resolve, because fields are never overwritten, only
appended to.

**This is the structural difference from tbd/beads today.** Beads stores committed
snapshots and resolves divergence with last-writer-wins per field.
LWW is fine for a single writer and lossy the moment two writers touch the same field.
That is precisely why PR #205 gates the Linear pilot behind `tbd-le2l` (merge extension
namespaces independently rather than whole-object LWW) and `tbd-z95g`. Those beads are
not incidental plumbing; they are the beginning of the same realization git-bug started
from.

### 7a.3 The catch, from git-bug’s own feature matrix

Bidirectional does not mean complete.
git-bug’s
[feature matrix](https://github.com/git-bug/git-bug/blob/master/doc/feature-matrix.md)
shows what its bridges actually carry:

| Field | GitHub | GitLab | Jira |
| --- | --- | --- | --- |
| bug, comments, status, labels, title edition | ✅ | ✅ | ✅ |
| comment editions | ✅ | ❌ | ✅ |
| **assignee** | ❌ | ❌ | ❌ |
| **milestone** | ❌ | ❌ | ❌ |
| **media/files** | ❌ | ❌ | ❌ |
| boards | ❌ | ❌ | ❌ |

After years of work by a mature project with the *right* data model, bridges carry
title, status, labels, and comments, and **not assignee or milestone**. Identity mapping
is called out as intrinsically limited, since the remote platform requires real
accounts.

### 7a.3a There is no Linear bridge, and the maintainers are moving away from bridges

Checked directly against the repository on 2026-08-09. `bridge/` contains exactly
**`github`, `gitlab`, `jira`, `launchpad`**. There is no Linear bridge.

[Issue #1489](https://github.com/git-bug/git-bug/issues/1489), “Support for bridge to
Linear? (+Offer to build)”, was opened 2025-10-12 by a contributor volunteering to write
one in Go. It is **still open** with two comments.
The maintainer’s reply is the informative part:

> I have thoughts on what the future of git-bug might look like (relevant: *bridges as
> external binaries*), and I’m rather hesitant to add *more* bridges at the moment.

The referenced [vision document](https://github.com/git-bug/git-bug/discussions/1391)
(2025-04, ~12,500 words) makes “**Bridges should be external**” one of four headline
goals, on the reasoning that in-repo bridges “detract from the core feature set” and
break the build when vendors change their APIs.
The contributor proposed a Linear bridge as a HashiCorp `go-plugin` proof of concept,
possibly written in TypeScript to use Linear’s official SDK. Nothing has landed.

**Read-across for tbd:** the project with the strongest data model for this concluded
that maintaining vendor bridges in-tree is a liability and wants them out of process.
That is the same instinct as PR #205’s insistence on keeping provider code, schema
fields, and imports out of core, arrived at independently after real operational pain.

### 7a.3b The agent gap

git-bug’s use cases have **not** changed with agent usage, and the evidence is unusually
clean. Across the 12,500-word 2025 vision document:

| Term | Occurrences |
| --- | --- |
| `agent` | **0** |
| `AI` | **0** |
| `LLM` | **0** |
| `MCP` | **0** |
| `bot` | **0** |

A repository-wide issue search returns **zero** MCP results; the `agent` matches are all
`ssh-agent` and unrelated.
The project is demonstrably active (about 10k stars, pushed 2026-07, releases through
v0.10.1) and its roadmap is entirely **human** UX: verb-first CLI redesign, external
bridges, replacing the JavaScript web UI, a `bubbletea` TUI redesign, and a
client/server architecture.

Its stated use cases remain the 2018-era ones, and they are all *human offline-first*
arguments: work offline including editing, near-instant browsing, choice of CLI/TUI/web
interface, a near-complete local archive if the platform becomes inaccessible, and
freedom to move platforms because issues follow the repo.

**This is the sharpest contrast in this brief.** git-bug is a mature git-native tracker
with the correct merge semantics and essentially no agent story.
tbd/beads is an agent-first tracker with weaker merge semantics.
The two projects are strong in exactly complementary places, which is worth knowing
before reinventing either half.

One genuine convergence is worth flagging: the vision document’s **client/server
architecture** goal, a long-running lightweight server backing thin CLI, TUI, and web
clients across multiple repositories, is independently the same conclusion as the
`tbd serve` option in [§7b.5](#7b5-the-alternative-tbd-serves-the-live-view-itself).

### 7a.4 So is it worth doing?

Yes. The benefits git-bug lists are real and are exactly what beads plus Linear would
gain. But three things follow from the evidence:

1. **The data model is the prerequisite, not the integration.** Attempting bidirectional
   sync on top of snapshot LWW reproduces the merge problem git-bug’s design doc opens
   by describing. Do `tbd-le2l` and `tbd-z95g` first, and consider whether the durable
   representation should be operation-based rather than snapshot-based.
   That is a much larger question than a Linear bridge and should be decided on its own
   merits.
2. **Scope the field set deliberately and narrowly.** git-bug’s matrix is the realistic
   target, not a disappointing one.
   Title, status, labels, and comments round-trip.
   Assignee and identity are the hard part.
3. **Bidirectional is worth it when both sides genuinely author.** For the two datasets
   in [§5.5](#55-worked-example-a-few-dozen-tickers) and
   [§5.6](#56-worked-example-mirroring-trading-repo-plan-specs), only one side really
   authors: analysis state is generated, and specs are authored in the repo.
   One-way plus a narrow return path for status captures most of the value at a fraction
   of the risk.

**In summary:** bidirectional git-to-tracker sync is proven, valuable, and structurally
demanding. The successful implementation earned it with a CRDT data model and still
restricts itself to four fields.
That is an argument for sequencing, not for avoidance.
[§7b](#7b-design-analysis-any-agent-syncs-agent-presence-and-a-served-live-view) refines
this: a CRDT is *sufficient* but not *necessary*; what is necessary is a recorded common
base, which tbd’s sync branch already provides.

* * *

## 7b. Design analysis: “any agent syncs”, agent presence, and a served live view

This section answers a design question directly: is there a *fundamental* flaw in
letting any agent trigger bidirectional Linear sync opportunistically, the way any agent
runs `tbd sync` against the sync branch today, with conflict policies like the ones
beads already has?

**Short answer: no fundamental flaw, but the analogy to today’s sync hides three
properties of git that make opportunistic sync safe, and all three must be deliberately
reconstructed.** Two of them can be.
The third cannot, and shapes the design.

### 7b.1 Why “any agent runs `tbd sync`” is safe today

Concurrent `tbd sync` from many agents works because git provides, for free:

1. **Compare-and-swap.** A push fails unless it is a fast-forward of what you last saw.
   Two concurrent syncers cannot silently overwrite each other; the loser is *forced* to
   pull, re-merge, and retry.
2. **Pure, replayable retry.** The retried operation is a recomputation over local data.
   Running it twice costs nothing and changes nothing external.
3. **A recorded common base.** The sync branch history preserves the last state both
   replicas agreed on, so divergence is a *three-way* problem (base, ours, theirs) with
   losers archived in the attic rather than destroyed.

Conflicts under this regime are *data* conflicts: annoying, visible, recoverable.

### 7b.2 What a second, non-git replica breaks

Putting Linear in the loop removes each property in turn:

1. **No CAS on Linear writes.** `issueUpdate` applies unconditionally; there is no “fail
   if the issue changed since I read it.”
   Two agents syncing concurrently interleave writes and the loser’s write is simply
   gone, with no signal that it lost.
2. **Retry has side effects.** A sync that crashes between writing to Linear and
   committing its checkpoint to the sync branch will, on retry, re-apply external
   writes. With non-idempotent creates ([§1.6](#16-writes-and-idempotency)) that means
   duplicates; there is **no atomic transaction spanning git and Linear**, and there
   cannot be. This is the one property that cannot be reconstructed, only compensated.
3. **Echo and oscillation.** The bridge’s own write bumps `updatedAt`, which the next
   poll sees as a remote change.
   Worse, if the field mapping does not round-trip exactly (markdown normalization,
   status name asymmetries), each sync rewrites the other side and the pair *oscillates
   forever*. Echo suppression by timestamp is fragile; the robust form is
   **snapshot-diff convergence**: import by diffing Linear against the last-imported
   snapshot, and require the mapping to be a fixpoint (exporting then importing a value
   yields the same value, after normalization).
4. **Cross-system LWW is ill-defined.** Comparing a Linear server timestamp with a git
   author timestamp compares two clocks.
   “Which side changed relative to the recorded base” is well-defined; “which change is
   newer” is not.
5. **Credential sprawl.** Every agent that can trigger sync holds a workspace-writable
   API key inside its sandbox, sharing one identity and one rate-limit budget, and a
   prompt-injected agent can write to the whole workspace.
   Personal keys act as the full user; a dedicated app identity
   ([§6.4](#64-linear-native-agent-sessions)) narrows both blast radius and enables
   actor-based echo filtering.

### 7b.3 The resolution: opportunistic single-writer, and three-way merge instead of LWW

None of the above says “don’t.” It says the concurrency model must be **opportunistic
single-writer**: any agent may *volunteer* to sync, but only one syncs at a time.

- **The lease lives in git.** Acquiring the sync role is a CAS-protected commit on the
  sync branch (tbd already maintains a sync lock; PR #205’s harness snapshots its
  presence). Git itself serializes the volunteers, which preserves the “any agent runs
  sync” UX exactly, the same way git push serializes `tbd sync` today.
- **Write-ahead intent.** The elected syncer commits its planned external writes (with
  client-generated UUIDs) *before* touching Linear, then applies, then commits the
  checkpoint. Crash recovery replays intents; duplicate-id errors are treated as success
  per [§1.6](#16-writes-and-idempotency).
  This is the standard compensation for the missing cross-system transaction, and it
  degrades to at-least-once with idempotent application, which is the same contract PR
  #205 already documents for watch workers.
- **Conflict policy becomes three-way, not LWW.** Because the sync branch records the
  last-synced snapshot of the Linear subset, every sync has base, bead-side, and
  Linear-side versions of each field.
  Fields changed on one side only merge silently; fields changed on both sides since
  base are *true* conflicts, resolved by per-field ownership policy (status owned by
  beads, labels by Linear, description by policy) with the loser archived attic-style.
  This is strictly stronger than timestamp LWW and needs no clock agreement.
  tbd already merges beads this way against git’s merge base
  ([§7c](#7c-storage-layer-comparison-git-bug-vs-tbd)); what is missing is a
  *bridge-maintained* base for the Linear side, plus `tbd-le2l`’s namespace-level merge
  of `extensions`.

This also sharpens [§7a.4](#7a4-so-is-it-worth-doing): git-bug’s CRDT is *one* way to
get mergeability, chosen because git-bug is peer-to-peer multi-master.
A hub-and-spoke bridge with a recorded base can use classic three-way state merge (the
Unison model) instead, which is far less invasive to tbd’s existing snapshot format.
**The real prerequisite is not a CRDT; it is a recorded base plus field-level merge, and
half of that already exists.**

### 7b.4 Agents announcing themselves in beads

The related idea: every agent stamps its identity on the bead it works on, plus a link
to its session or workspace, so `tbd watch` makes agent activity observable and this
presence information syncs outward to Linear like any other field.

This is sound, and it is the
[Agent Coordination Kernel](research-agent-coordination-kernel.md) model with watch as
the transport. The discipline that makes it work:

- **Claim before write, one writer per bead.** Presence works precisely because the
  agent that claims a bead is the only writer of its presence fields, so no merge
  algebra is ever exercised.
  This is field ownership again, applied within beads.
- **Coarse-grained only in the durable store.** Claimed, started, PR link, done: yes.
  Per-minute progress: no.
  High-frequency updates churn the sync branch into commit noise and make `tbd changes`
  reports unreadable. Live progress belongs on a live channel: the served page below, or
  Linear agent-session activities in a T5 world.
- **Don’t use shared notes for it.** PR #205 already documents `--notes` as
  single-writer replaceable state; presence belongs in dedicated fields (or an extension
  namespace once `tbd-z95g` lands), with child beads or external comment IDs for
  multi-writer history.

### 7b.5 The alternative: tbd serves the live view itself

Instead of mirroring into Linear for visibility, `tbd serve` renders a live page (SSE or
polling over the watch primitive), which the untracked `bead-web.ts` prototype already
sketches.

| Dimension | Served live page | Linear mirror |
| --- | --- | --- |
| Sync complexity | **None: renders the source of truth** | Everything in §7b.2 |
| Fidelity | Perfect, including the dependency DAG and `ready` semantics Linear cannot render | Lossy (no custom fields, mapped states) |
| Credentials / rate limits | None | API keys in agent sandboxes, 2,500 req/h |
| Team access | Localhost unless someone hosts it | **A URL anyone in the workspace opens today** |
| Mobile, notifications, inbox, triage | None unless built | **Native, already excellent** |
| Human workflows (assign, comment, prioritize) | Read-mostly unless tbd grows write UI | **Native** |
| Cost trajectory | Slowly rebuilding a tracker UI | Slowly rebuilding a sync engine |
| Failure mode | Page down, truth intact | Divergence, duplicates, echo |

The last two rows are the real decision.
Both paths accrete complexity, but they accrete it in different places: the served page
spends effort on *presentation* with zero risk to data; the mirror spends effort on
*distributed-systems correctness* to buy Linear’s presentation and workflow for free.

### 7b.6 Verdict

These are complements, not rivals, and they sequence naturally:

1. **Now:** promote the `bead-web` prototype into a real `tbd serve` for the
   agent-operations view (DAG, ready, presence, live changes).
   Zero sync risk, consumes only the shipped watch primitive.
2. **Next:** one-way mirror into Linear for human review
   ([T2/T3](#3-the-option-space-five-topologies)), which needs none of §7b.2’s machinery
   because Linear-side edits are never imported.
3. **Then, if both sides genuinely author:** bidirectional on the opportunistic
   single-writer design above, gated on `tbd-le2l`/`tbd-z95g`, with the narrow git-bug
   field set and per-field ownership policies.

The “any agent syncs” UX survives in all three stages; what changes underneath is that
stage 3 serializes the volunteers through a git-held lease instead of letting them race.

* * *

## 7c. Storage layer comparison: git-bug vs tbd

Read from both codebases on 2026-08-09, not from summaries.

*Aside on the framing: GitHub itself stores issues in a relational database, not in git.
Nothing in a GitHub repo’s object store contains issue data.
The only two systems here that put issues in git are git-bug and tbd.*

### 7c.1 The fundamental split: operations vs snapshots

|  | git-bug | tbd |
| --- | --- | --- |
| **Unit of storage** | `Operation` (an edit event) | Entity snapshot (current state) |
| **What git holds** | Append-only DAG of `OperationPack`s | A file per entity, rewritten in place |
| **Location** | `refs/<namespace>/<id>`, one ref per entity | One branch, `tbd-sync`, checked out in a hidden worktree |
| **Format** | JSON blobs behind git plumbing | Markdown + YAML front matter, readable on disk |
| **Current state** | *Computed* by replaying operations | *Read* directly from the file |
| **Entity id** | `hash(first operation)`, content-addressed | ULID, plus a random 4-char base36 short id in `mappings/ids.yml` |
| **Ordering** | Lamport clocks, DAG-validated | Wall-clock `updated_at` |
| **Merge** | Deterministic replay, conflict-free by construction | Three-way field merge with per-field strategies |
| **Data loss on conflict** | Impossible: nothing is overwritten | Possible: LWW discards a value, archived to `attic/` |
| **History** | Intrinsic: the operation log *is* the history | Extrinsic: git commit history of the file |

The single sentence version: **git-bug stores what happened; tbd stores what is true
now.** Everything below follows from that.

On tbd’s merge specifically: `mergeIssues(base, local, remote)`
(`packages/tbd/src/file/git.ts:587`) is a genuine three-way merge, and the sync path
(`git.ts:1931`) resolves a real git merge base via `git show <baseSha>:<path>` before
calling it. Fields changed on only one side merge silently.
LWW applies **only** as the tie-break when both sides changed the same field, and the
discarded value is written to `attic/` with both versions and timestamps.

### 7c.2 What tbd’s model buys

- **Direct file access.** `ripgrep` searches issues with no git plumbing.
  git-bug needs a whole `cache` layer (`BugCache`, `BugExcerpt`) between the UI and
  storage precisely because computing state means replaying a DAG. tbd’s read path is
  `open()`.
- **Agent-legible on disk.** An agent can read, diff, and patch a bead file with
  ordinary tools. Operation logs require a client library to make sense of.
- **Human-editable in any editor**, the Jekyll/Hugo front-matter convention.
- **Cheap conflict avoidance.** File-per-entity means concurrent work on *different*
  beads is a trivial git merge and never reaches the field merge at all.
- **Debuggability.** When something is wrong you can look at it.
  Operation-log corruption is far harder to inspect.
- **A simpler write path.** Atomic temp-file rename, no clock allocation, no DAG
  validation.

### 7c.3 What git-bug’s model buys

- **Conflict-free merges, by construction rather than by policy.** No losers, so no
  attic is needed.
- **No dependence on clock agreement.** tbd’s LWW tie-break compares `updated_at` across
  machines; skewed clocks silently pick the wrong winner, and the loser is archived
  rather than lost, but the *merged result is still wrong*.
- **Full edit history and attribution per field**, with signed authorship.
  tbd has commit history, but the sync branch’s commits are machine-generated batches,
  so “who changed this field and why” is weaker.
- **Tamper resistance.** Refusing commits whose Lamport clocks violate the DAG bounds
  ordering; wall-clock timestamps can be freely asserted.
- **Concurrent multi-master by default.** No lock.
  tbd needs a repo-scoped `data-sync.lock` and a single shared hidden worktree to
  serialize mutations.

### 7c.4 What tbd has that git-bug does not

Worth stating plainly, because the merge-semantics comparison flatters git-bug:

- **Dependencies as a first-class graph** with `blocks` relations, `tbd ready` computing
  transitive readiness, and `tbd blocked`. git-bug has no dependency model at all, and
  its feature matrix lists no milestone support.
- **`tbd changes --since` and `tbd watch`** (PR #205): a deterministic diff and a
  blocking wake primitive.
  git-bug has no equivalent, and no agent story ([§7a.3b](#7a3b-the-agent-gap)).
- **Specs, labels, workspaces, attic recovery, and doctor repair** as shipped surface.
- **Recovery-oriented design**: the outbox workspace preserves work when sync fails, and
  `attic/` records exactly what a merge discarded, with local/remote versions and
  timestamps.

### 7c.5 The actual gaps

Given the correction above, three real gaps remain, and they are narrower and more
tractable than “adopt a CRDT”:

1. **`extensions` merges as one opaque LWW blob.** `FIELD_STRATEGIES` in `git.ts:454`
   sets `extensions: 'lww'`, so two writers touching *different* namespaces inside
   `extensions` still collide and one namespace is discarded wholesale.
   This is exactly what `tbd-le2l` names, and it is the blocker for putting external-ID
   bindings there ([§7a.1a](#7a1a-git-bugs-two-distinct-sync-layers)), because a Linear
   binding and a different provider’s binding would clobber each other.
2. **LWW tie-break depends on wall clocks.** Within a single field where both sides
   changed, `updated_at` decides.
   A per-field Lamport counter, or explicit ownership policy, would remove the clock
   dependency without changing the storage model.
3. **The three-way merge has no cross-system analogue yet.** For beads, git supplies the
   base. For a Linear bridge, nothing does: the bridge must record its own last-synced
   snapshot to get a base, which is the design in
   [§7b.3](#7b3-the-resolution-opportunistic-single-writer-and-three-way-merge-instead-of-lww).

### 7c.6 Assessment

**tbd’s model is the right one for its goals, and the gaps do not require adopting
git-bug’s.** Operation logs are the correct answer for peer-to-peer multi-master
collaboration among humans with unreliable clocks, which is git-bug’s actual problem.
tbd’s problem is agents and humans sharing a repo through a hub, where file legibility
and search speed matter more than conflict-free multi-master, and where a lock is
acceptable because writers are co-located.

Snapshots trade merge purity for legibility.
For an agent-first tracker, legibility is the higher-value side of that trade: an agent
can read a bead file, and `ripgrep` is worth more than a theoretically superior merge
that never fires because file-per-entity already avoided the conflict.

The one lesson genuinely worth importing is **metadata-keyed external binding**
([§7a.1a](#7a1a-git-bugs-two-distinct-sync-layers)): store remote ids on the entity and
use their presence for echo suppression.
That needs gap 1 fixed and nothing else.

* * *

## 8. Date-driven recurring tracking at scale

The concrete case: a few hundred tickers report earnings each month.
Roughly a dozen to twenty per week are genuinely worth attention.
Should all of them be tracked in Linear, and at what granularity?

### 8.1 What Linear gives you for dates

- **`dueDate`** is a date with no time component.
  Verified writable via `issueUpdate`.
- **`snoozedUntilAt`** removes an issue from view until a timestamp.
  This is the closest thing to “wake me on the reporting date”.
- **Cycles** are time-boxed containers, a natural fit for a weekly batch.
- **Templates** plus recurring issue support exist, though driving creation from a cron
  job with `issueBatchCreate` is more controllable and more testable.
- **SLA fields** exist but are aimed at support response times, not calendar events.

Mechanically, dates are well supported.
The problem is not dates.

### 8.2 The scaling arithmetic

| Constraint | Value | Binding? |
| --- | --- | --- |
| Free plan issues per team | **250** | **Yes, immediately.** `subscription` is `null` on this workspace, so it is on the free plan |
| Paid plan issue count | Effectively unlimited | No |
| API requests/hour | 2,500 observed | No. 300 issues via `issueBatchCreate` is a handful of calls |
| Max page size | 250 | No, but a 300-item month needs 2 pages |
| Custom fields | **None exist** | **Yes.** See below |

The API is not the limit.
**Two things are:** the free-tier 250-issue cap, and the total absence of custom fields.

### 8.3 There is no spreadsheet-like table

To answer the question directly: **no, Linear has no table or database view with
user-defined columns.** There is no equivalent of a Notion database or an Airtable grid.
Confirmed against the live schema in [§1.5](#15-there-are-no-custom-fields), not just
the docs.

The practical consequence for ticker tracking is that fields you would want as columns,
such as report date, consensus EPS, surprise percentage, sector, or market cap, have
nowhere typed to live.
Your options are all lossy:

- **In the title** (`AAPL 2026-08-14 earnings`): sortable only as text, and pollutes
  search.
- **In labels**: one label per ticker means several hundred label objects, which
  degrades every label picker in the workspace for every user.
  This is an anti-pattern.
  Labels work well for a handful of *facets* such as `sector:tech` or `beat` or `miss`,
  and badly as identity.
- **In the markdown description**: readable by humans and agents, invisible to filters
  and sorting.
- **As an attachment**: holds a link to the real record, which is the honest option.

If the data is genuinely tabular, the tabular store belongs somewhere else, and Linear
should hold only the items that need a human decision.

### 8.4 Granularity options

| Option | Volume/month | Assessment |
| --- | --- | --- |
| **A.** One issue per ticker per event | ~300 | Exceeds the free tier in month one. Notification volume makes the workspace unusable for its actual purpose. 90%+ close with no action taken, which trains everyone to ignore the tracker |
| **B.** One issue per shortlisted ticker | ~60 to 80 | Comfortable. Each issue is a real decision someone committed to. Requires a selection step upstream |
| **C.** One issue per weekly review batch | ~4 to 5 | Very low overhead. The ticker list lives in the description as a checklist. Loses per-ticker assignment, status, and history |
| **D.** Two-tier: full list external, promote exceptions | ~20 to 40 | Complete coverage *and* a clean tracker. Costs one promotion rule |
| **E.** Project per month, issue per ticker | ~300 | Same volume problem as A, with better grouping. Does not fix the underlying issue |

### 8.5 Recommendation and the reasoning behind it

**Option D, falling back to B.**

The governing principle is that **a Linear issue should represent something a human
committed to and will close.** Cardinality is not the real problem; a paid workspace
handles 300 issues per month without complaint.
The problem is *signal ratio*. If 280 of 300 issues close automatically with no human
action, the tracker stops being a list of commitments and becomes a log, and people stop
reading logs.

The full several-hundred-ticker list is **reference data**, not a task list.
It belongs in whatever store already holds ticker fundamentals, or in beads if agents
need to reason over it with dependencies.
Linear then receives only the promoted items: the shortlist chosen ahead of the week,
plus anything the automated pass flags as an exception, such as a surprise beyond a
threshold, a guidance change, or a failed data fetch.

This also sidesteps both hard constraints at once.
Promoted volume stays well inside even the free tier, and the promoted items are few
enough that encoding their metadata in the description costs nothing, because nobody
needs to sort 20 items by a column.

**If you want the full list in Linear anyway**, the workable shape is: one **project per
month**, issues created in a single `issueBatchCreate`, `dueDate` set to the report
date, `snoozedUntilAt` set to the morning of that date so the workspace stays quiet
until each one is actually relevant, and a **custom view** filtered to this week and
created via `customViewCreate` so review has a single stable URL. Budget for a paid
plan, and expect to prune aggressively.
This is a legitimate choice; it is just a heavier one than the value usually justifies.

**Rough answer to “what is a reasonable maximum”:** for items a human reviews
individually, a few dozen per week is comfortable and a few hundred per week is not.
The limit is human review bandwidth, roughly 50 to 100 open items per person before
triage quality collapses, and it is reached long before any API or plan limit.

* * *

## 9. Recommendations

### 9.0 Agreed priority order

This is the decided shape of the work, in order.
It supersedes the sequencing sketched in [§7b.6](#7b6-verdict).

**P1. Local web UI over local beads.** `bead-web.ts` / `bead-web.html` becomes a
supported way to see all local beads at any time.
No network, no credentials, no sync risk.
It renders the source of truth and is the only item here with no distributed-systems
exposure. It also covers the views Linear structurally cannot
([§5.4](#54-what-each-surface-is-actually-good-at)): the dependency DAG and transitive
`ready`.

**P2. Simple synchronization with an explicit conflict escape hatch.** The target is
that sync is uneventful essentially always, and that the rare genuine conflict is
*never* silently resolved.
On conflict:

1. Archive the losing value to the local git attic, as tbd already does
   ([§7c.1](#7c1-the-fundamental-split-operations-vs-snapshots)).
2. **Post a comment on the Linear side** recording the divergence, so the conflict is
   visible where the human is looking and an agent can resolve it later.

Both halves are verified to work.
`commentCreate` returns a comment id and a deep link
(`.../issue/FIN-6/...#comment-<id>`), and **`commentResolve` / `commentUnresolve`
exist**, so a conflict comment has a native handled/unhandled lifecycle.
That is a better fit than a label, because it carries the payload, the timestamp, and
the resolution state together.

The design that keeps conflicts rare rather than merely survivable is
[§7b.3](#7b3-the-resolution-opportunistic-single-writer-and-three-way-merge-instead-of-lww):
opportunistic single-writer via a git-held lease, write-ahead intents, and a
bridge-maintained base so most divergence merges silently as a one-sided change.

**P3. A clean overview of major work in Linear.** Epics, plus anything explicitly linked
to an external item, plus manual opt-ins.
Per-project configuration decides the selection set; the default is
`kind == epic AND status active`, which is 21 items in this repo today
([§5.6a](#56a-worked-example-linear-as-the-top-level-todo-replacing-todomd)). Epics may
carry linked issues and planned specs; specs project as **permalinks**, not paths, for
the branch-locality reason in that section.

**Deferred: generated `TODO.md`.** Reasonable idea, wrong time.
The format is not settled, it is another artifact to maintain, and a second generated
to-do surface risks confusing agents about which list is authoritative.
Revisit once the Linear overview has proven what the useful summary actually contains.

### 9.0a Nested epics

**Verified by live test: Linear supports arbitrary sub-issue nesting.** A four-level
chain (`FIN-6 → FIN-7 → FIN-8 → FIN-9`) was created and read back through nested
`children` without error or warning; `Issue.parent` and `Issue.children` are plainly
recursive. Initiatives nest too, via `subInitiatives` / `parentInitiative`. All test
issues were deleted afterwards.

So the Linear side is not the constraint.
Two cautions, one on each side:

- **tbd has no cycle or depth validation on `parent_id`.** A search of the source found
  no depth limit and no cycle check.
  If nested epics become a supported pattern, that guard is worth adding first, because
  a parent cycle would break tree rendering in the P1 web UI and could produce unbounded
  recursion in any projector that walks ancestors.
- **Linear’s *display* flattens deep hierarchies even though its data model does not.**
  Views expose `issueNesting`, `showSubIssues`, and `showParents`, but a board grouped
  by status shows issues, not a tree.
  Depth beyond two levels is real in the data and mostly invisible in the UI.

**Recommendation: support nested epics in tbd, but project at most two levels into
Linear.** Mirror the epic and, where it exists, one level of sub-epic.
Deeper structure stays in beads where `tbd dep` and the P1 web UI can actually render
it. This costs nothing, since P3 deliberately does not mirror child beads anyway, and it
avoids building a Linear hierarchy nobody can see.

### 9.1 Technical recommendations

1. **Do not couple any of this to PR #205.** That PR is correct to land the
   provider-neutral primitive alone.
   Everything here consumes `format_version: 1`.
2. **Pilot T2 or T3, not T4.** Both avoid field-level merge entirely, so neither needs
   `tbd-le2l` or `tbd-z95g` first.
   §7 is evidence that bidirectional sync is rare in practice for good reasons.
3. **Poll, do not webhook, for the pilot.** Not just because a laptop has no public
   HTTPS endpoint, but because the 3-retry auto-disable makes polling the mandatory
   reconciliation path anyway.
4. **Treat `WorkflowState.type` as an open string set**, map on `type` and never on
   `name`, and cache per-team state UUIDs.
5. **Treat the duplicate-id create error as success.** This is a two-line detail that
   will otherwise produce false failures under retry.
6. **Read rate-limit headers rather than trusting documented quotas**, which are off by
   2x, and handle `RATELIMITED` on HTTP 400 rather than 429.
7. **For the earnings use case, keep the full list out of Linear** and promote
   exceptions. See [§8.5](#85-recommendation-and-the-reasoning-behind-it).
8. **Prototype the combined view in the existing `bead-web.ts`** before considering
   anything hosted. It is already wired to the watch infrastructure.

* * *

## 10. Open questions

1. **Which topology does the project actually want?** T2, T3, and T5 imply very
   different products. This brief deliberately does not choose.
2. **Does the ticker workflow want beads at all**, or a plain database?
   Beads earns its place only if dependencies between tickers matter.
3. **Would a hosted tbd Linear agent** (`actor=app`,
   [§6.4](#64-linear-native-agent-sessions)) be worth building, given it needs
   infrastructure this project does not currently have?
4. **Is the observed 2,500/hour limit** a free-plan restriction or a documentation
   error? Worth re-probing on a paid workspace.
5. **Does `issueBatchCreate` accept client-generated ids**, and does it fail the whole
   transaction on one duplicate?
   Not probed, and it matters for bulk retry safety.

* * *

## Appendix A: Reproducible probes

All probes are read-only except where noted.
`LINEAR_API_KEY` is read from `.env`, which is gitignored.

```bash
set -a; . ./.env; set +a
q() { curl -s -D /tmp/h.txt -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" -H "Authorization: $LINEAR_API_KEY" -d "$1"; }

# Identity, org, teams; then read rate-limit headers
q '{"query":"{ viewer{id name} organization{name urlKey} teams(first:10){nodes{id key name}} }"}'
grep -i -E "x-ratelimit|x-complexity" /tmp/h.txt

# Per-team workflow states: the mapping table a bridge must cache
q '{"query":"{ team(id:\"<TEAM_UUID>\"){ states(first:20){nodes{id name type position}} } }"}'

# WorkflowState.type is String!, not an enum
q '{"query":"{ __type(name:\"WorkflowState\"){ fields{ name type{ kind name ofType{kind name} } } } }"}'

# No user-definable fields on Issue (85 total)
q '{"query":"{ __type(name:\"Issue\"){ fields{ name } } }"}'

# Max page size: errors with "first must not be greater than 250"
q '{"query":"{ issues(first:500){ nodes{ id } } }"}'

# Incremental sync primitive
q '{"query":"query($since:DateTimeOrDuration!){ issues(filter:{updatedAt:{gt:$since}},first:250,orderBy:updatedAt){ pageInfo{hasNextPage endCursor} nodes{id identifier title priority updatedAt state{name type}} } }","variables":{"since":"2026-08-01T00:00:00Z"}}'
```

**Write probes (mutating).** The round-trip below was executed against team `FIN` on
2026-08-09 and **fully cleaned up**: `FIN-5` was created, updated, and deleted, leaving
the team at its original 4 issues.
Note that the `FIN-5` identifier is now permanently consumed.

```bash
# Create with a client-generated id; run twice to observe the conflict error
q '{"query":"mutation($id:String,$teamId:String!,$title:String!){ issueCreate(input:{id:$id,teamId:$teamId,title:$title}){ success issue{id identifier url state{name type}} } }","variables":{"id":"<UUID>","teamId":"<TEAM_UUID>","title":"[tbd test] probe"}}'

# dueDate and priority are writable
q '{"query":"mutation($id:String!){ issueUpdate(id:$id,input:{dueDate:\"2026-08-14\",priority:2}){ success issue{identifier dueDate priority}} }","variables":{"id":"<UUID>"}}'

# Cleanup
q '{"query":"mutation($id:String!){ issueDelete(id:$id){ success } }","variables":{"id":"<UUID>"}}'
```

* * *

## References

### Official Linear documentation

- [GraphQL API](https://linear.app/developers/graphql)
- [Rate limiting](https://linear.app/developers/rate-limiting)
- [Pagination](https://linear.app/developers/pagination)
- [Webhooks](https://linear.app/developers/webhooks)
- [Agents platform](https://linear.app/developers/agents)
- [TypeScript SDK](https://linear.app/developers/sdk) (`@linear/sdk`)
- [MCP server](https://linear.app/docs/mcp) and the
  [launch changelog](https://linear.app/changelog/2025-05-01-mcp)
- [Releases](https://linear.app/docs/releases) ·
  [Labels and label groups](https://linear.app/docs/labels)
- [Custom views](https://linear.app/docs/custom-views),
  [Customer requests](https://linear.app/docs/customer-requests),
  [Intake](https://linear.app/intake),
  [Concepts](https://linear.app/docs/conceptual-model)
- [Agents integration directory](https://linear.app/integrations/agents)

### Tools

- [openai/symphony](https://github.com/openai/symphony) and its
  [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- [schpet/linear-cli](https://github.com/schpet/linear-cli) ·
  [Securiteru/linear-cli](https://github.com/Securiteru/linear-cli) ·
  [nesszer/linear-cli](https://github.com/nesszer/linear-cli) ·
  [evangodon/linear-cli](https://github.com/evangodon/linear-cli)

### Bidirectional sync prior art (§7a)

- [git-bug](https://github.com/git-bug/git-bug):
  [bridge usage](https://github.com/git-bug/git-bug/blob/master/doc/usage/third-party.md)
  ·
  [data model design](https://github.com/git-bug/git-bug/blob/master/doc/design/data-model.md)
  ·
  [architecture](https://github.com/git-bug/git-bug/blob/master/doc/design/architecture.md)
  ·
  [feature matrix](https://github.com/git-bug/git-bug/blob/master/doc/feature-matrix.md)
  ·
  [Jira bridge design](https://github.com/git-bug/git-bug/blob/master/doc/design/bridges/jira.md)
- git-bug governance and direction:
  [issue #1489, Linear bridge offer](https://github.com/git-bug/git-bug/issues/1489) ·
  [discussion #1391, a vision for the future of git-bug](https://github.com/git-bug/git-bug/discussions/1391)
- Commercial two-way tracker sync: [Unito](https://unito.io/integrations/jira-github/) ·
  [Exalate](https://exalate.com/integrations/jira-github/) ·
  [OpsHub](https://www.opshub.com/gitlab-integrations/gitlab-jira-integration/) ·
  [getint](https://www.getint.io/blog/jira-gitlab-integration-guide)
- [Linear GitHub integration](https://linear.app/integrations/agents) — bidirectional
  for PR status, branches, commits, comments

### tbd source read for §7c

- `packages/tbd/src/file/git.ts` — `mergeIssues`, `FIELD_STRATEGIES`, attic entries
- `packages/tbd/docs/tbd-design.md` §2 (File Layer), §3.3 (sync algorithm), §3.5 (merge
  rules), §3.6 (attic)

### Internal

- PR [#205](https://github.com/jlevy/tbd/pull/205) — `tbd changes` / `tbd watch`
- PR [#197](https://github.com/jlevy/tbd/pull/197) — earlier Linear research and pilot
  plan
- `plan-2026-07-20-linear-bead-sync-pilot.md` (on
  `origin/claude/linear-bead-sync-plan-tct4hn`)
