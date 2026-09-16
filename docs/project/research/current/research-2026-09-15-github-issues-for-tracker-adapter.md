# Research: GitHub Issues and Pull Requests for a tbd Tracker Adapter

**Date:** 2026-09-15

**Author:** Research brief (AI-assisted; official GitHub documentation plus live GraphQL
schema introspection against api.github.com)

**Status:** Complete as a dated provider-facing API survey and a mapping onto tbd’s
current integration model.
It records open design questions for the GitHub adapter; it decides none of them.

**Origin:** Salvaged from PR [#83](https://github.com/jlevy/tbd/pull/83)
(`claude/external-issue-linking-1rGfb`, head `4795e47f`, February 2026), which proposed
a standalone `external_issue_url` feature.
That design is superseded by the tracker integration framework and was dropped; see
[§1](#1-what-was-salvaged-and-what-was-dropped).
The provider facts were re-verified on 2026-09-15 and several had changed.

**Related:**

- [External tracker integrations](../../specs/active/plan-2026-08-10-external-tracker-integrations.md):
  the adapter seam, policy, bridge layout, and the Phase 3 GitHub work map
- [External sync and traceability](../../specs/active/plan-2026-08-14-external-sync-and-traceability.md):
  `docs` and `refs`, and why a GitHub *reference* is not a GitHub *integration*
- [Tracker state model and Linear mapping](../../specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md):
  `resolution`, `hold`, and the slot vocabulary
- [Actor axis and identity mapping](../../specs/active/plan-2026-08-18-actor-axis-and-identity.md):
  `assignee` versus `delegate`, and per-provider identity binding
- [Linear as a task surface](research-2026-08-09-linear-task-surfaces.md): the same
  exercise for the first provider, including live-probed corrections to published docs
- [API references for bridge integrations](api-references-bridge-integrations.md):
  January 2026 GitHub App, webhook, and Slack reference notes.
  Its GitHub sections are older than this brief; prefer the facts here where they
  disagree.

**Beads:** `tbd-1ae2` (Phase 3 epic), `tbd-lmo9` (transport and adapter), `tbd-tnks`
(issue lifecycle), `tbd-v75l` (PR associations), `tbd-v1u1` (live gate), `tbd-xbkm`
(docs).

* * *

## Overview

tbd implements the full tracker lifecycle for Linear only.
GitHub has config-schema and provider-registry scaffolding, and `buildAdapter()` rejects
it because no adapter exists (`packages/tbd/src/cli/lib/integration-runner.ts:73-75`).
This brief is the provider-facing input for writing that adapter: what GitHub’s issue
model actually is today, which parts REST and GraphQL each cover, what polling and rate
limits cost, and where GitHub’s shape does not fit the seam Linear defined.

Three findings drive most of the design work below:

1. **GitHub has no client-supplied identifier on create.** Linear’s `issueCreate`
   accepts a client UUID and rejects duplicates, which is what lets tbd journal a
   create, commit the provisional link, and replay safely after a crash.
   Neither REST nor GraphQL offers an equivalent, so crash-safe creation needs a
   different mechanism ([§9.3](#93-creates-are-not-idempotent)).
2. **GitHub’s issue model grew the pieces tbd already had.** Sub-issues, issue types,
   issue dependencies, and org-level structured issue fields are all now first-class and
   API-addressable. The February research described a “minimal” model; that is no longer
   accurate.
3. **`state` plus `state_reason` is a lossless terminal axis and an empty open axis.**
   tbd’s `resolution` maps onto GitHub exactly; the open-end slots (`todo`, `backlog`,
   `paused`, `blocked`, `in_review`) have no GitHub column unless a Project is in play,
   so they must ride labels or be dropped ([§10.2](#102-slots-and-the-state-model)).

## Verification Method and Coverage

Every fact below was checked on **2026-09-15** by one of three methods, named per
section:

- **docs:** fetched from docs.github.com on 2026-09-15. Endpoint pages render for API
  version `2026-03-10` unless noted.
- **introspection:** live GraphQL schema introspection through
  `gh api graphql -f query='{ __type(name:"…"){…} }'` against api.github.com.
  This is the schema as served, not a doc page about it.
- **changelog:** dated entries on github.blog/changelog, used only for when a capability
  shipped.

Nothing here was probed by mutating a repository.
Behaviors that need a write to confirm are listed in
[§12](#12-what-could-not-be-verified) rather than asserted.
The bounded live pilot under `tbd-v1u1` is where they get settled.

**REST API versioning (docs).** The current version is `2026-03-10`, released
2026-03-12; `2022-11-28` remains the default for requests that send no
`X-GitHub-Api-Version` header and is supported until 2028-03-10. Two breaking changes in
`2026-03-10` touch this work: the singular `assignee` property is removed from issue
payloads in favor of `assignees`, and `merge_commit_sha` is removed from pull request
objects. A client that pins nothing gets `2022-11-28`, so pinning is a decision to make
once, in the transport layer, rather than a default to inherit.

* * *

## 1. What Was Salvaged and What Was Dropped

PR #83 designed a standalone feature: one inheritable `external_issue_url` string on the
bead, `tbd sync --external`, and `gh api` subprocesses for transport.
The tracker integration framework that shipped afterwards answers the same need
differently, so the design and its code are superseded.
Only the provider-facing research was worth keeping, and only after re-verification.

| PR #83 element | Disposition | What replaces it |
| --- | --- | --- |
| Top-level inheritable `external_issue_url` | **Dropped** | `extensions.<provider>` for tracker identity and `refs` for references (`packages/tbd/src/lib/schemas.ts:161-230`, `:282`) |
| Link inheritance and parent-to-child propagation | **Dropped** | Link identity is per bead; hierarchy is projected through `parentId` by the mirror. `spec_path` remains the inherited linkage |
| `tbd sync --external`, `--external-issue`, `tbd list --external-issue` | **Dropped** | `tbd integration link/unlink`, `tbd integration sync --push`/`--pull --external`, and the planned `tbd list --linked` |
| `gh api` via `execFile` as transport | **Dropped** | REST over native `fetch`; `gh auth token` survives only as the third credential source (`integrations/core/credentials.ts:137-142`) |
| `use_gh_cli` config gate | **Dropped** | `integrations.github.enabled` plus `target.repo` (`integrations/core/registry.ts:76-90`) |
| Status map: `deferred`→`not_planned`, `blocked`→no change | **Dropped** | The `resolution` and `hold` axes and the slot vocabulary ([§10.2](#102-slots-and-the-state-model)) |
| Two-step label create, ignoring 422 | **Dropped as a recipe** | `labels.mirror` and `labels.create` policy. The 422 claim itself is unverified ([§12](#12-what-could-not-be-verified)) |
| Third-party sync-tool survey, Projects workflow advice, agent-tooling commentary | **Dropped** | Not provider facts; the issues-only-plus-linked-PRs recommendation it reached is already the shape of `tbd-v75l` |
| Issue, PR, label, milestone, sub-issue, issue-type, and Projects data model | **Kept, re-verified** | [§2](#2-the-issue-model)–[§8](#8-authentication) |
| URL-parsing test cases and the manual QA script | **Kept by reference**, not copied | [§11](#11-salvaged-artifacts-at-4795e47f) |

Two facts PR #83 asserted are now wrong rather than stale: `duplicate` as a
`state_reason` is documented, not undocumented, and GitHub does have custom issue fields
([§2.5](#25-issue-fields-structured-metadata)).

* * *

## 2. The Issue Model

### 2.1 Core Issue Fields

**Method: docs, plus introspection for the GraphQL names.**

An issue belongs to exactly one repository.
There is no organization-level issue.
REST create accepts `title`, `body`, `assignees`, `labels`, `milestone`, `type`,
`parent_issue_id`, and `issue_field_values` (`[{field_id, value}]`). REST update accepts
those plus `state`, `state_reason`, and `duplicate_issue_id`. Setting `type` and
`labels` requires push access.

Response objects carry `number`, `node_id`, `state`, `state_reason`, `type`,
`sub_issues_summary`, `parent_issue_url`, `issue_dependencies_summary`, timestamps, and
`pull_request` when the item is a PR.

Two identity rules matter for a link store:

- **Issues and pull requests share one number space** per repository, and the Issues API
  serves both for labels, assignees, comments, and state.
- **A transferred issue answers 301** at its old number, and a deleted issue answers 410
  where the caller has read access.
  `number` is therefore display data, not identity, exactly as Linear’s `FIN-123` is.

### 2.2 State and `state_reason`

**Method: docs (REST), introspection (GraphQL).**

`state` is `open` or `closed`. `state_reason` is `completed`, `not_planned`,
`duplicate`, `reopened`, or `null`, and the docs say it is “Ignored unless state is
changed”. `duplicate_issue_id` names “the ID of the issue to mark as the canonical
duplicate when state_reason is duplicate”.

GraphQL is the same axis under different names.
`IssueClosedStateReason` introspects as exactly `COMPLETED`, `NOT_PLANNED`, `DUPLICATE`.
`CloseIssueInput` introspects as `issueId`, `stateReason`, `duplicateIssueId`,
`rationale`, `isSuggestion`, `confidence`, `clientMutationId`. The `Issue` object
exposes `stateReason` and `duplicateOf`.

This is a genuine change since February 2026, and it is the one that most affects tbd:
`duplicate` is a supported closed reason with a pointer to the canonical issue, which is
precisely the shape of `resolution: duplicate` plus `duplicate_of`
(`lib/schemas.ts:327-336` for the two field shapes; the `IssueSchema.superRefine`
comment at `:358-363` already names GitHub’s `duplicateIssueId`).

### 2.3 Sub-Issues and Parents

**Method: docs.**

REST endpoints, all under `/repos/{owner}/{repo}/issues/{issue_number}`:

| Operation | Method and path |
| --- | --- |
| Get parent | `GET …/parent` |
| List sub-issues | `GET …/sub_issues` (`per_page` max 100) |
| Add sub-issue | `POST …/sub_issues`, body `sub_issue_id`, optional `replace_parent` |
| Remove sub-issue | `DELETE …/sub_issue`, body `sub_issue_id` |
| Reorder | `PATCH …/sub_issues/priority`, body `sub_issue_id` plus `after_id` or `before_id` |

Three details an adapter has to respect: the body takes the issue **id**, not its
number; the sub-issue “must belong to the same repository owner as the parent issue”, so
cross-repository nesting works within an owner and not across owners; and the REST page
warns that rapid create and delete cycles hit secondary rate limits.

The UI documentation states the limits as **100 sub-issues per parent** and **eight
levels of nesting**. The REST reference states neither, so how the API refuses an
over-limit write is unverified.
GraphQL offers `addSubIssue` (`issueId`, `subIssueId`, `subIssueUrl`, `replaceParent`),
and `CreateIssueInput` takes `parentIssueId`, so a parent can be set at creation in one
call.

Sub-issues and issue types went GA on 2025-04-09 (changelog).

### 2.4 Issue Types

**Method: docs.**

Issue types are defined per organization, not per repository:
`GET/POST /orgs/{org}/issue-types` and `PUT/DELETE /orgs/{org}/issue-types/{id}`, with
`name`, `is_enabled`, `description`, and a `color` drawn from a fixed palette.
Reads need `read:org`; writes need `admin:org` and organization-admin standing.
An issue’s type is set through the `type` parameter on create and update.

For tbd this is the closest provider analogue of `kind`, and it is only available to
organization-owned repositories, which makes it a bounded rather than supported case for
a personal repository.

### 2.5 Issue Fields (Structured Metadata)

**Method: changelog, plus introspection.**

This did not exist when PR #83 was written and directly contradicts its “GitHub has no
custom fields” premise.
Issue fields entered public preview 2026-03-12, opened to all organizations 2026-05-21,
and went generally available 2026-07-02, with four default fields (Priority, Effort,
Start date, Target date) and org-configurable additions.
Multi-select field support went GA 2026-08-07.

The API surface introspects as `issueFieldValues` on `Issue`, `issueFields` on
`CreateIssueInput`, and `issueFieldUpdates` on `UpdateIssueInput`; REST create takes
`issue_field_values`. The `issues` webhook gained `field_added` and `field_removed`
actions, and the timeline gained `IssueFieldAddedEvent`, `IssueFieldChangedEvent`, and
`IssueFieldRemovedEvent`.

A tbd `priority` could map to the default Priority field rather than to a `tbd:` carrier
label. That is a design option for `tbd-lmo9`, not a settled mapping: it is
organization-scoped, newer than the adapter’s other dependencies, and absent on
user-owned repositories.

### 2.6 Issue Dependencies

**Method: docs, changelog, introspection.**

Dependencies on issues went GA 2025-08-21. REST:
`GET/POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`,
`DELETE …/dependencies/blocked_by/{issue_id}`, and `GET …/dependencies/blocking`. The
POST body and DELETE path take `issue_id`. GraphQL exposes `blockedBy`, `blocking`, and
`issueDependenciesSummary` on `Issue`, and the `issue_dependencies` webhook carries
`blocked_by_added`, `blocked_by_removed`, `blocking_added`, `blocking_removed`.

tbd’s `dependencies: [{type: blocks, target}]` now has a faithful provider counterpart,
which Linear’s model does not offer in the same shape.
Whether the adapter projects the dependency graph outward is a scope question for
`tbd-tnks`; nothing in the canonical patch (`integrations/core/types.ts:92-156`) carries
dependencies today.

### 2.7 Labels, Assignees, Milestones

**Method: docs.**

- **Labels** are per repository.
  Full CRUD at `/repos/{owner}/{repo}/labels` plus add, set, remove, and remove-one on
  an issue. `color` is hex without `#`; `description` is 100 characters or fewer.
  Whether adding an unknown label name to an issue creates it or fails is *not stated*
  anywhere in the reference ([§12](#12-what-could-not-be-verified)).
- **Assignees** are capped at **10** per issue.
  `POST`/`DELETE …/assignees` add and remove;
  `GET /repos/{owner}/{repo}/assignees/{user}` checks assignability.
  Users who cannot be assigned are “silently ignored”, so an adapter that does not check
  first will report a success it did not achieve.
  This is the same failure mode the Linear mirror hit with unmapped assignees
  (`MirrorReport.skippedFields`, `integrations/core/types.ts:260-268`).
- **Milestones** are per repository, at most one per issue, with `title`, `state`,
  `due_on`. tbd has no milestone concept and should map nothing to it.

### 2.8 Comments and Timeline

**Method: docs, introspection.**

Issue comments are `GET/POST /repos/{owner}/{repo}/issues/{number}/comments` and
`PATCH/DELETE …/issues/comments/{id}`, paginated at 100 per page.
There is **no resolve or unresolve lifecycle** for issue comments; resolution exists
only on pull request review threads.
tbd’s conflict-report lifecycle depends on Linear’s `commentResolve`
(`integrations/core/types.ts:320-336`), so GitHub needs a different convention.

`GET …/issues/{number}/timeline` returns the merged event stream.
`IssueTimelineItems` introspects to 51 possible types as of 2026-09-15. Treat that as a
dated observation rather than a fixed fact: the union grows as GitHub ships events, and
this brief has already had to correct the number twice.
What matters is that every member this work cares about is present in the live schema:
`ClosedEvent`, `ReopenedEvent`, `MarkedAsDuplicateEvent`, `UnmarkedAsDuplicateEvent`,
`SubIssueAddedEvent`, `SubIssueRemovedEvent`, `ParentIssueAddedEvent`,
`ParentIssueRemovedEvent`, `BlockedByAddedEvent`, `BlockingAddedEvent` (plus their
removals), `IssueTypeAddedEvent`/`ChangedEvent`/`RemovedEvent`,
`IssueFieldAddedEvent`/`ChangedEvent`/`RemovedEvent`, `CrossReferencedEvent`,
`ConnectedEvent`, `DisconnectedEvent`, `TransferredEvent`, `RenamedTitleEvent`.

The timeline is the only place several of these relationships are observable as
*changes* rather than as current state.
tbd’s reconcile engine compares values against a recorded base and deliberately does not
trust event streams or clocks (`plan-2026-08-10-external-tracker-integrations.md`,
Component 10), so the timeline is useful for diagnostics, not for the sync algorithm.

### 2.9 URL and Reference Formats

**Method: docs.**

| Form | Example | Note |
| --- | --- | --- |
| Issue URL | `https://github.com/{owner}/{repo}/issues/{number}` | Also reachable with `?…` and `#issuecomment-…` suffixes |
| PR URL | `https://github.com/{owner}/{repo}/pull/{number}` | `/pull/`, not `/pulls/`; the API path is `/pulls/` |
| Short ref | `#123`, `owner/repo#123` | Auto-linked in bodies and comments; the cross-repo form is what closing keywords accept |
| API URL | `https://api.github.com/repos/{owner}/{repo}/issues/{number}` | `X-GitHub-Api-Version` header selects the version |
| GHES | `https://HOSTNAME/api/v3/…` | The authentication reference documents only `api.github.com`; GHES host handling is unverified here |

* * *

## 3. Pull Requests

**Method: docs, introspection.**

Every pull request is an issue; the reverse is false.
Labels, assignees, milestones, and comments on a PR go through the Issues API; merge,
reviews, files, and commits go through `/pulls/`. `mergeable` is computed asynchronously
and may be `null` on first read.
As of API version `2026-03-10`, `merge_commit_sha` is removed from pull request objects.

Linking a PR to an issue has two mechanisms with different limits:

- **Keywords** in the PR description or a commit message: `close`, `closes`, `closed`,
  `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`, followed by `#N`,
  `owner/repo#N`, or a full URL. The issue closes only when the PR merges into the
  repository’s **default branch**.
- **Manual linking** in the UI: up to **10 issues** per PR, and only issues in the
  **same repository**. Cross-repository linking is keyword-only.

GraphQL exposes both directions: `PullRequest.closingIssuesReferences` and
`Issue.closedByPullRequestsReferences` (introspected).
There is no REST endpoint that returns an issue’s linked PRs, which is the strongest
argument for GraphQL in the PR-association work (`tbd-v75l`).

* * *

## 4. REST Versus GraphQL Coverage

**Method: docs and introspection, per row.**

| Concern | REST | GraphQL | For the adapter |
| --- | --- | --- | --- |
| Issue CRUD, state, `state_reason`, `duplicate_issue_id` | Full | Full (`closeIssue`, `updateIssue`) | REST |
| Batch read by id | One request per issue | `nodes(ids: […])` in one query | GraphQL is the only batched `fetchIssues` |
| Updated-since delta | `GET /issues?state=all&since=&sort=updated` | Search connection | REST |
| Labels, assignees, milestones | Full | Full | REST |
| Sub-issues and parent | Full | Full (`addSubIssue`, `parent`, `subIssues`) | Either; REST needs the issue id |
| Issue types | Org CRUD plus `type` on issue writes | `issueTypeId` on create and update | REST |
| Issue fields | `issue_field_values` on create | `issueFields`, `issueFieldUpdates`, `issueFieldValues` | GraphQL is better specified |
| Dependencies | Full | `blockedBy`, `blocking` | REST |
| Comments | Full, paginated | Full | REST |
| Linked PRs for an issue | **Absent** | `closedByPullRequestsReferences` | GraphQL required |
| Agent assignment | Assignee endpoints plus `agentAssignment` | `replaceActorsForAssignable`, `agentAssignment` | GraphQL; a feature header gates the call, not the schema |
| Projects v2 | Since 2025-09-11, items and fields | Full | Either; both need extra scope |
| Timeline | Full | `timelineItems` | Diagnostics only |

The honest summary is that a REST-first transport covers the whole issue lifecycle and
needs GraphQL for exactly two things: batched reads and linked-PR discovery.
That matches the zero-dependency `fetch` decision already recorded for Phase 3
(`plan-2026-08-10-external-tracker-integrations.md:297`, `:325`), since a GraphQL POST
over `fetch` is the same transport.

* * *

## 5. Pagination

**Method: docs.**

`link` header relations are `next`, `prev`, `first`, `last`, and not all appear on every
page.
`per_page` maxes at 100. Endpoints use `page`, cursor `before`/`after`, or `since`,
depending on the endpoint, and the documentation is explicit that clients should follow
`link` rather than construct URLs.
The Projects REST item endpoints are cursor-paginated.

Every correctness-sensitive connection in the Linear adapter paginates completely, which
is a release-gate row in the compatibility matrix; the same obligation carries to
comments, labels, assignees, sub-issues, and dependencies on GitHub.

* * *

## 6. Rate Limits and Conditional Requests

**Method: docs.**

**Primary limits, REST:** 60 requests/hour unauthenticated; **5,000/hour** for a user
token; 5,000/hour base for a GitHub App installation, scaling by 50/hour per repository
and per user beyond 20 of each to a **12,500/hour** cap; 15,000/hour for an installation
owned by an Enterprise Cloud organization; 1,000/hour per repository for `GITHUB_TOKEN`
in Actions.

**GraphQL** has a separate bucket: 5,000 points/hour for a user (10,000 on Enterprise
Cloud).
Query cost is the number of requests needed for each connection at its `first` or
`last` limit, divided by 100 and rounded, minimum 1 point.
Node limits are 500,000 per query with `first`/`last` between 1 and 100; requests over
10 seconds terminate with 502 or 504.

**Secondary limits:** no more than 100 concurrent requests; 900 points/minute on REST
and 2,000/minute on GraphQL, where a REST `GET`/`HEAD`/`OPTIONS` costs 1 point and
`POST`/`PATCH`/`PUT`/`DELETE` costs 5; 90 seconds of CPU per 60 seconds of real time;
and **80 content-generating requests per minute and 500 per hour**. Exceeding a primary
or secondary limit answers **403 or 429**.

**Headers:** `x-ratelimit-limit`, `-remaining`, `-used`, `-reset`, `-resource`, and
`retry-after` on secondary limits.
`GET /rate_limit` reports every bucket and does not count against the limit.

**Conditional requests:** with `if-none-match` (from `etag`) or `if-modified-since`
(from `last-modified`), a **304 response does not count against the primary rate
limit**. This is the documented way to poll.

**Documented client behavior:** make requests serially rather than concurrently, wait at
least one second between mutating requests, honor `retry-after`, and otherwise wait at
least a minute with exponential backoff.

Sizing this against tbd: the Linear mirror’s measured envelope is roughly 4 calls per
item, about 340 requests for a full 84-item run.
The same shape on GitHub sits far inside 5,000/hour but brushes the content-creation
limit during an onboarding backfill, because issue and comment creation are
content-generating: 500 per hour is the binding constraint on a first mirror, not the
primary limit. The one-second serial guidance also makes a large outbound run
wall-clock-bound rather than quota-bound.

* * *

## 7. Webhooks Versus Polling

**Method: docs.**

Webhook events relevant here, with their action lists as documented:

- `issues`: `assigned`, `closed`, `deleted`, `demilestoned`, `edited`, `field_added`,
  `field_removed`, `labeled`, `locked`, `milestoned`, `opened`, `pinned`, `reopened`,
  `transferred`, `typed`, `unassigned`, `unlabeled`, `unlocked`, `unpinned`, `untyped`.
  A GitHub App needs read access to the Issues permission.
- `sub_issues`: `parent_issue_added`, `parent_issue_removed`, `sub_issue_added`,
  `sub_issue_removed`.
- `issue_dependencies`: `blocked_by_added`, `blocked_by_removed`, `blocking_added`,
  `blocking_removed`.
- `issue_comment`: `created`, `deleted`, `edited`, `pinned`, `unpinned`.
- `projects_v2` and `projects_v2_item`: **organization-scoped only**, and documented as
  public preview.

Delivery rules: the receiver must return 2XX **within 10 seconds** or GitHub terminates
the connection and counts the delivery as failed; payloads are capped at **25 MB** and
an event over the cap is not delivered at all; `X-GitHub-Delivery` is unique per
delivery and is the replay-protection key; missed deliveries are recovered by redelivery
rather than by an automatic retry schedule the documentation commits to.

**Conclusion for tbd: polling, unchanged.** The reasoning that ruled out webhooks for
Linear applies with equal force here.
A CLI has no public HTTPS endpoint that answers in 10 seconds, and the design already
states there are no webhooks and no background provider polling; remote exchange is an
ordinary explicit `tbd sync` (`packages/tbd/docs/tbd-design.md`, §8.7). GitHub’s polling
story is better than Linear’s: `since` on the issues list plus conditional requests
means a quiet repository costs a handful of free 304s per sync.
The gap worth naming is that `since` filters on issue `updated_at`, and a *comment* edit
or a sub-issue relationship change may or may not move it; that is a probe item for
`tbd-lmo9`, not an assumption to build on.

* * *

## 8. Authentication

**Method: docs, plus one local observation.**

| Option | Shape | Fit for tbd |
| --- | --- | --- |
| Fine-grained PAT | Per-repository permissions, explicitly recommended over classic PATs | The default for a repository pilot. Issues write plus Metadata read; Pull requests read for PR associations |
| Classic PAT | Scope-based; needed for Projects (`read:project`, `project`) | Only if Projects v2 enters scope |
| GitHub App installation token | JWT then `POST /app/installations/{id}/access_tokens`; expires in **1 hour**; scopable by repository and permission | Right for a hosted service, wrong for a CLI with no backend to hold a private key |
| `gh auth token` | Whatever the user’s `gh` login holds | tbd’s third credential source, after `GITHUB_TOKEN` and `.env` |
| `GITHUB_TOKEN` in Actions | 1,000 requests/hour per repository | CI only |

tbd’s resolution order is already implemented and provider-generic: process environment
(`GITHUB_TOKEN`), this worktree’s `.env`, the main worktree’s `.env`, then
`gh auth token` for GitHub only (`integrations/core/credentials.ts:105-145`).
Credentials never enter `process.env`, because `buildGitEnv()` spreads the environment
into every git subprocess and git runs user hooks.

**Observed locally on 2026-09-15** (one machine, one account, not a general fact):
`gh auth status` reports a `gho_` token with scopes `gist`, `read:org`, `repo`,
`workflow`. That covers issues, labels, comments, and PRs, and it does **not** include
`project`, so the `gh` fallback cannot drive Projects v2 without
`gh auth refresh -s project`. Any Projects work has to treat a gh-provided token as
insufficient by default.

* * *

## 9. Where GitHub Does Not Fit the Linear-Shaped Seam

The adapter interface is `TrackerAdapter` in
`packages/tbd/src/integrations/core/types.ts:285-398`. Most of it maps cleanly.
These are the members that do not.

### 9.1 Attachments and the One-Writer Claim

`upsertAttachments()` and `listAttachmentUrls()` exist because Linear’s
`attachmentCreate` is a true upsert keyed on `url`, which gives tbd both an idempotent
metadata carrier and the `tbd://bead/<id>` claim that refuses a second repository
writing one item (`integrations/core/link-guard.ts`; design doc §8.7).

GitHub has no attachment object.
The claim needs another carrier, and each candidate has a cost: a marker inside the
managed `⟦tbd⟧` description block is free but is also the field humans edit; a dedicated
marker comment is durable but adds a comment to every linked issue and counts against
the content-creation limit; a `tbd`-namespaced label records that *a* repository claims
the issue but cannot say *which bead*. This is the single largest structural difference
and it belongs to `tbd-lmo9`.

### 9.2 No Comment Resolve Lifecycle

`postConflict()` and `resolveComment()` assume the provider can mark a comment handled.
GitHub issue comments have no such state.
The conflict lifecycle either moves to a label, or to editing the conflict comment in
place, or is tracked only in bridge state with the comment left as a plain notice.

### 9.3 Creates Are Not Idempotent

`createIssue(patch, clientId?)` exists because Linear accepts a client-generated UUID
and rejects a duplicate, which is what makes the write-ahead journal safe: tbd commits
the provisional link *before* provider I/O, and a crash after acceptance replays into
the same item.

Neither GitHub API offers this.
REST create documents no idempotency key; `CreateIssueInput` introspects as
`repositoryId`, `title`, `body`, `assigneeIds`, `milestoneId`, `labelIds`, `projectIds`,
`projectV2Ids`, `issueTemplate`, `issueTypeId`, `parentIssueId`, `issueFields`,
`agentAssignment`, and `clientMutationId` (fourteen fields, 2026-09-15), and
`clientMutationId` is echoed to the caller, not deduplicated by the server.
The same holds for comments.
So the GitHub adapter needs a recovery path rather than an idempotency key: after a
crash, find the item the journal may have created (for example by a journal-UUID marker
written into the body, or by listing the caller’s recent issues with `since`), adopt it
if present, create it if absent.
Both routes have a visible cost, and search-style discovery is eventually consistent.
This is the correctness question the Phase 3 gate should be organized around.

### 9.4 No Archive

`archiveIssue()` and `unarchiveIssue()` are optional on the interface precisely so a
provider without an archive concept can omit them.
GitHub has no archive for issues; `closed` is the end of the line.
Omitting both is the correct implementation, and the engine’s orphan handling then keys
only on deletion and transfer.

* * *

## 10. Mapping GitHub Onto tbd’s Current Model

### 10.1 Adapter Surface

| `TrackerAdapter` member | GitHub implementation | Note |
| --- | --- | --- |
| `resolveRef` | Parse `owner/repo#N`, issue URL, PR URL | `number` is display data; identity is the id or node id |
| `fetchIssues(ids)` | GraphQL `nodes(ids:)`, or N REST GETs | Batching is the only reason GraphQL is needed here |
| `createIssue` | `POST /repos/{o}/{r}/issues` | No client id; see [§9.3](#93-creates-are-not-idempotent) |
| `applyChanges` | `PATCH …/issues/{n}` | Returns `updated_at` for echo suppression |
| `upsertAttachments`, `listAttachmentUrls` | No equivalent | See [§9.1](#91-attachments-and-the-one-writer-claim) |
| `spliceDescription` | `PATCH …/issues/{n}` with the `⟦tbd⟧` block | Markdown body, same as Linear |
| `postConflict`, `resolveComment` | `POST …/comments`; no resolve | See [§9.2](#92-no-comment-resolve-lifecycle) |
| `createComment`, `listComments` | `POST`/`GET …/comments`, paginated | No client id |
| `fetchUpdatedSince` | `GET …/issues?state=all&sort=updated&since=` | Returns PRs; filter on `pull_request` |
| `archiveIssue`, `unarchiveIssue` | Omit | No archive concept |
| `ensureMeta` | Labels, org issue types, issue fields | No workflow states to resolve |
| `listMembers`, `primeActors` | `GET /repos/{o}/{r}/assignees`, paginated | Bind by login and id, per provider |
| `canPushDelegate` | `assignedActors` plus `agentAssignment` | See [§10.3](#103-the-actor-axis) |
| `provision` | Create missing labels; issue types need `admin:org` | Reports before it writes |

### 10.2 Slots and the State Model

The slot vocabulary is `backlog`, `draft`, `todo`, `in_progress`, `paused`, `blocked`,
`in_review`, `done`, `canceled`, `duplicate` (`integrations/core/slots.ts:20-31`). The
terminal half maps exactly; the open half has no GitHub column.

| tbd | GitHub | Confidence |
| --- | --- | --- |
| `closed` + `completed` | `state: closed`, `state_reason: completed` | Exact |
| `closed` + `canceled` | `state: closed`, `state_reason: not_planned` | Exact |
| `closed` + `duplicate` + `duplicate_of` | `state: closed`, `state_reason: duplicate`, `duplicate_issue_id` | Exact, and needs the duplicate bead’s own link to supply the id |
| `todo`, `backlog`, `draft` | `state: open` | Lossy: three slots, one state |
| `in_progress`, `paused`, `blocked`, `in_review` | `state: open` | Lossy: four slots, one state |

Two carriers can restore the lost distinctions, each with a cost.
Exclusive `tbd:` labels are the mechanism the Linear adapter already uses for `blocked`
and `deferred` and need no extra permission, at the price of writing tbd vocabulary into
a shared label namespace.
A Projects v2 Status field is the real board, and it costs an organization-owned
project, `project` scope that a `gh` token does not carry, and a second object to keep
in sync. The state-model spec’s own mapping table already records the terminal half
exactly as above (`plan-2026-08-18-tracker-state-model-and-linear-mapping.md:216-220`);
the open half is undecided for GitHub.

`decomposeSlot()` is the inbound direction, and it has one asymmetry worth naming:
`not_planned` decomposes to `canceled`, so an issue a human closed as “not planned”
pulls in as canceled work, which is the intended reading.

### 10.3 The Actor Axis

`assignee` is the accountable human and `delegate` is the acting agent
(`lib/schemas.ts:285-294`). The actor-axis spec’s forward-looking table
(`plan-2026-08-18-actor-axis-and-identity.md:330-340`) predicted GitHub would render a
human delegate as a second assignee and an agent delegate as “agent assignment”.
Both now have concrete API surfaces:

- **Assignee.** `assignees`, capped at 10, silently ignoring users without access.
  The singular `assignee` field is removed in API version `2026-03-10`, so an adapter
  must read and write the array.
  Identity resolution is already modelled (`integrations/core/actor-binding.ts:25-47`),
  though not quite field for field: `ProviderMember` carries the `id` and the `login`
  used for matching, while `ActorBinding` persists `handle`, `provider_user_id`,
  `display_name`, and `bound_at`. A GitHub login is a matching input, not a stored
  binding field.
- **Delegate.** `Issue.assignedActors` and an `agentAssignment` input on
  `CreateIssueInput`, `UpdateIssueInput`, and `ReplaceActorsForAssignableInput` (all
  introspected). Assigning an issue to Copilot through the API shipped 2025-12-03 and,
  per the documentation, requires a user token and a `GraphQL-Features` header
  (`issues_copilot_assignment_api_support`). The header gates behavior, not
  discoverability: `ReplaceActorsForAssignableInput` introspects identically with and
  without it (checked both ways, 2026-09-15), so the schema cannot tell you whether a
  call will be accepted.
  That is a weaker gate than a hidden surface would be, but it still means acceptance is
  only knowable by attempting the write, so treating agent publication as deferred, and
  reporting the skip, remains the conservative reading.

### 10.4 `extensions.github` Versus `refs`: An Unresolved Discrepancy

**This brief flags the discrepancy; it does not resolve it.**

Two shipped documents describe different homes for a bead’s pull request links:

- `plan-2026-08-10-external-tracker-integrations.md:697-713` decides “the
  `extensions.github` namespace”, with a YAML example carrying `prs: [...]` and
  `issue: ...`, and the `tbd-v75l` bullet under the “Phase 3: GitHub adapter” heading
  makes it “Store `extensions.github.prs`”. Bead `tbd-v75l` repeats it in its own
  description.
- `plan-2026-08-14-external-sync-and-traceability.md:325-330` decides the opposite:
  “GitHub issues are `refs`, not `extensions.github`”, reserving `extensions.<provider>`
  for the single tracker item a bead *is*. The f08 schema encodes that reading
  (`lib/schemas.ts:212-230`, `:282`), `packages/tbd/docs/tbd-design.md:6969-6970` says
  generic `refs` persist GitHub issue and PR URLs, and `tbd ref add` ships.

The August 14 reading is later, implemented, and internally consistent: `refs` is
many-valued and union-merged on `url`, while a provider namespace is single-valued by
construction. The August 10 text and `tbd-v75l` predate it.
The open question is not only which field wins but whether PR associations need anything
`refs` does not already give them: `tbd-v75l` also promises *refreshed display metadata*
(title, state, merged-ness), which is mutable provider data that the design puts in
bridge records rather than in beads.
Owner: `tbd-v75l`, with a documentation correction to whichever spec loses.

* * *

## 11. Salvaged Artifacts at `4795e47f`

Neither artifact is copied into the repository.
Both are reachable at the PR #83 head commit and are worth reading once, at the point
the owning bead starts.

**URL-parsing cases** (`tbd-lmo9`):
`git show 4795e47f:packages/tbd/tests/github-issues.test.ts`. The file holds 48 cases:
24 for URL parsing and formatting, 19 for status mapping, 5 for label diffing.
The PR’s own QA document counted by area rather than by file
(`4795e47f:docs/project/qa/external-issues.qa.md:492-500`, a six-row table totalling 89
across several test files), and none of its three rows for this file match it: 44
claimed for URL parsing against 24 actual, 12 for status mapping against 19, 3 for label
diffing against 5. The row that matters for reuse is the one that overcounts, so the
salvageable parsing table is about half the size the old QA summary implies.
Only the parsing cases are reusable, and they encode strict choices worth re-deciding
rather than inheriting: `^https?://github\.com/…/(issues|pull)/(\d+)$` rejects a
trailing slash, any query string, and any fragment, so a URL copied from a browser with
`#issuecomment-…` fails.
It also has no case for `owner/repo#123`, which `resolveRef` must accept
(`integrations/core/types.ts:292`), and none for a GHES host.
Reuse the table, widen the grammar.
The status-mapping and label-diff cases encode the superseded design and should not be
revived.

**Manual QA script** (`tbd-v1u1`):
`git show 4795e47f:docs/project/qa/external-issues.qa.md`. Its command vocabulary is
obsolete, and its phases 5 and 6 test inheritance and propagation that no longer exist.
What survives is the disposable-pilot skeleton: create a throwaway repository and four
issues, record their URLs, run the lifecycle, assert through the API rather than the UI,
and delete the repository at the end, with a cleanup trap in the semi-automated variant.
That is the same shape as the provider contract in
`packages/tbd/scripts/provider-live-qa-contract.ts` and the Linear playbook at
`packages/tbd/tests/qa/linear-integration.qa.md`, which are the real starting points.
Use the old script only for its repository-provisioning and teardown mechanics.

* * *

## 12. What Could Not Be Verified

Two categories, kept apart on purpose.
The numbered list needs a write against a disposable repository, which this brief did
not do. The block after it needs no write, but rests on a single documentation page that
no second reader has re-opened.

1. **Label auto-creation.** PR #83 asserted that adding an unknown label to an issue
   returns 422 and that creation must be a separate step.
   The current reference states neither behavior.
   Probe before implementing the two-step dance (`tbd-lmo9`).
2. **Identity survival across a transfer.** The docs document the 301 at the old number
   but say nothing about whether `id` and `node_id` are preserved when an issue moves
   between repositories.
   The whole link store depends on the answer (`tbd-lmo9`).
3. **Sub-issue limit enforcement.** 100 children and 8 levels are stated in UI
   documentation only; the API’s refusal mode is unknown.
4. **Webhook retry policy.** The best-practices page documents the 10-second window and
   manual redelivery; it does not commit to an automatic retry count.
   Not load-bearing, since tbd polls.
5. **What moves `updated_at`.** Whether a comment, label, sub-issue, or dependency
   change bumps the issue’s `updated_at`, which is what `since` filters on
   ([§7](#7-webhooks-versus-polling)).
6. **Projects v2 view mutations.** PR #83 recorded that none exist.
   Not re-verified beyond noting that the 2025 REST API exposes a read-only endpoint for
   the items in a view.
7. **Issue fields REST shape.** `issue_field_values` appears on the create endpoint; the
   dedicated reference page for issue fields did not resolve, so the field-definition
   endpoints were not confirmed.
8. **GHES.** Everything here is api.github.com.
   Enterprise Server hosts, versions, and feature availability are unverified.
9. **`gh` token scopes as a general fact.** [§8](#8-authentication) records one
   machine’s login, not a guarantee about anyone else’s.

**Single-sourced, and not re-confirmed in review.** Independent review on 2026-09-15
re-checked fifteen API claims in this brief and reproduced fourteen; the one that did
not was the timeline-member count, now corrected in [§2.8](#28-comments-and-timeline).
The following were outside what that review checked, so they carry one source each and
no second reading. Re-open the cited page before relying on any of them:

- The GraphQL point and node limits in [§6](#6-rate-limits-and-conditional-requests):
  the 5,000 points/hour user bucket, the connection cost formula, and the 500,000-node
  ceiling.
- The issue-fields dates in [§2.5](#25-issue-fields-structured-metadata): the 2026-03-12
  preview start and the 2026-08-07 multi-select GA. The 2026-05-21 all-orgs and
  2026-07-02 GA dates were confirmed; these two were not.
- The 100-children and 8-level sub-issue limits in [§2.3](#23-sub-issues-and-parents),
  which are UI documentation only.
  Item 3 above covers how the API refuses an over-limit write; this covers the numbers
  themselves.
- The 10-issue cap on manual PR linking in [§3](#3-pull-requests).
- The label `color` and `description` constraints in
  [§2.7](#27-labels-assignees-milestones).

* * *

## 13. Open Design Questions

1. **How does a GitHub create become crash-safe without a client id?** Body marker and
   adopt, or list-and-match, or accept a narrow duplicate window with a reported remedy.
   (`tbd-lmo9`; blocks the Phase 3 gate.)
2. **What carries the `tbd://bead/<id>` claim?** Managed block, marker comment, or
   label, and what the one-writer guard costs in each.
   (`tbd-lmo9`.)
3. **Where do the open-end slots live?** `tbd:` carrier labels, a Projects Status field,
   or accept the flattening and report it.
   (`tbd-tnks`.)
4. **What does a conflict report look like without `commentResolve`?** (`tbd-tnks`.)
5. **`extensions.github.prs` or `refs`?** See
   [§10.4](#104-extensionsgithub-versus-refs-an-unresolved-discrepancy).
   (`tbd-v75l`.)
6. **Does the adapter project `kind` to issue types and `priority` to the default
   Priority issue field?** Both are organization-scoped, which makes them bounded rather
   than supported. (`tbd-lmo9`.)
7. **Does tbd project its dependency graph to GitHub’s issue dependencies?** The API now
   supports it and the canonical patch does not carry dependencies.
   (`tbd-tnks`.)
8. **Which API version does the transport pin?** `2026-03-10` costs an explicit header
   and gets the current shape; the unpinned default is `2022-11-28` and keeps the
   removed singular `assignee`. (`tbd-lmo9`.)
9. **Is agent delegation in scope for Phase 3** while `agentAssignment` needs a
   `GraphQL-Features` header?
   (`tbd-v75l` or a follow-on.)

* * *

## References

Fetched or introspected 2026-09-15 unless dated otherwise.

**GitHub REST**

- [Issues](https://docs.github.com/en/rest/issues/issues) ·
  [Sub-issues](https://docs.github.com/en/rest/issues/sub-issues) ·
  [Issue dependencies](https://docs.github.com/en/rest/issues/issue-dependencies) ·
  [Labels](https://docs.github.com/en/rest/issues/labels) ·
  [Assignees](https://docs.github.com/en/rest/issues/assignees) ·
  [Timeline](https://docs.github.com/en/rest/issues/timeline) ·
  [Org issue types](https://docs.github.com/en/rest/orgs/issue-types) ·
  [Project items](https://docs.github.com/en/rest/projects/items)
- [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions) ·
  [Breaking changes](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes)
- [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
  · [Rate limit endpoint](https://docs.github.com/en/rest/rate-limit/rate-limit) ·
  [Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)
  ·
  [Best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [Authenticating to the REST API](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api)
  ·
  [Installation access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

**GitHub GraphQL**

- [Rate limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- Live introspection of `Issue`, `PullRequest`, `IssueTimelineItems`,
  `IssueClosedStateReason`, `CloseIssueInput`, `CreateIssueInput`, `UpdateIssueInput`,
  `AddSubIssueInput`, `ReplaceActorsForAssignableInput`

**Product and workflow docs**

- [Adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)
  ·
  [Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)
  ·
  [Using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  ·
  [Webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)

**Changelog (dates only)**

- [Evolving GitHub Issues and Projects](https://github.blog/changelog/2025-04-09-evolving-github-issues-and-projects/)
  (sub-issues and issue types GA, 2025-04-09)
- [Dependencies on issues](https://github.blog/changelog/2025-08-21-dependencies-on-issues/)
  (2025-08-21)
- [A REST API for GitHub Projects](https://github.blog/changelog/2025-09-11-a-rest-api-for-github-projects-sub-issues-improvements-and-more/)
  (2025-09-11)
- [Assign issues to Copilot using the API](https://github.blog/changelog/2025-12-03-assign-issues-to-copilot-using-the-api/)
  (2025-12-03)
- [REST API version 2026-03-10](https://github.blog/changelog/2026-03-12-rest-api-version-2026-03-10-is-now-available/)
  (2026-03-12)
- [Issue fields are now generally available](https://github.blog/changelog/2026-07-02-issue-fields-are-now-generally-available/)
  (2026-07-02; public preview 2026-03-12)
- [Multi-select fields and “Relates to”](https://github.blog/changelog/2026-08-07-connecting-issues-and-multi-select-field-support/)
  (2026-08-07)

**Superseded source**

- PR [#83](https://github.com/jlevy/tbd/pull/83), head `4795e47f`:
  `docs/project/research/current/research-github-issue-linking-workflows.md`,
  `docs/project/specs/active/plan-2026-02-10-external-issue-linking.md`,
  `docs/project/qa/external-issues.qa.md`, `packages/tbd/tests/github-issues.test.ts`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
