# Research Brief: GitHub Issue, PR, and Project Workflows for External Issue Linking

**Last Updated**: 2026-02-11

**Related**:

- [External Issue Linking Spec](../../specs/active/plan-2026-02-10-external-issue-linking.md)
- [External Issues QA Plan](../../qa/external-issues.qa.md)
- [tbd Design Doc](../../../packages/tbd/docs/tbd-design.md)

* * *

## Executive Summary

This research brief documents the GitHub Issues, Pull Requests, Labels, and Projects V2
data models, APIs, workflows, and ecosystem to inform the design and implementation of
tbd's external issue linking feature. It covers four areas:

1. **GitHub data model and APIs** — Issues, PRs, Labels, and Projects V2 internals
2. **Workflow best practices** — How teams use GitHub Issues and Projects effectively
3. **Third-party integrations** — Tools for cross-platform sync (Jira, Linear, etc.)
4. **Alternatives and agent-driven development** — Competing approaches and where
   agent-native tools like tbd fit

The core finding is that GitHub's issue/PR system is simple but powerful: issues have a
minimal state model (`open`/`closed` with `state_reason`), labels are free-form
per-repository strings, and the REST API is straightforward. This simplicity makes
bidirectional sync between tbd beads and GitHub Issues feasible with a small, well-defined
mapping layer. The main complexity lies in label auto-creation (GitHub does not
auto-create labels when adding them to issues) and in the new sub-issues/issue types
features that are evolving rapidly.

**Research Questions**:

1. What is the complete GitHub Issues/PRs/Labels data model and API surface?
2. What are the state transitions, and how do they map to tbd bead statuses?
3. How do GitHub Projects V2 relate to issues, and what automation is available?
4. What third-party tools exist for cross-platform issue sync?
5. What are the emerging alternatives (Linear, Plane, etc.) and how do they compare?
6. How do agent-driven workflows change the requirements for issue tracking?

* * *

## Part 1: GitHub Data Model and APIs

### 1.1 GitHub Issues

GitHub Issues are the fundamental work-tracking unit. Each issue belongs to a single
repository and has:

| Field | Type | Notes |
| --- | --- | --- |
| `number` | integer | Unique per-repo, auto-incremented |
| `title` | string | Required |
| `body` | string (Markdown) | Optional |
| `state` | `open` \| `closed` | Two states only |
| `state_reason` | `completed` \| `not_planned` \| `reopened` \| `null` | Since 2022; ignored unless `state` changes |
| `labels` | string[] | Free-form, per-repo |
| `assignees` | user[] | Up to 10 |
| `milestone` | object \| null | Per-repo milestone |
| `locked` | boolean | Conversation lock |
| `comments` | integer | Comment count |
| `created_at` / `updated_at` / `closed_at` | ISO 8601 | Timestamps |

**Key design points:**

- Issues and PRs share a unified number space within a repository (issue #5 and PR #5
  cannot coexist).
- The `pull_request` field on an issue object indicates whether it is actually a PR.
  GitHub's Issues API endpoints work for both issues and PRs for most operations
  (labels, assignees, comments).
- There is no organization-level issue concept — issues always belong to a repository.
  Teams wanting cross-repo issues typically create a dedicated "issues" repository.

#### State Model

The state model is intentionally minimal:

```
          reopen
  ┌──────────────────────┐
  │                      │
  ▼                      │
 open ──────────────► closed
        close              │
                           ├── state_reason: completed  (default)
                           ├── state_reason: not_planned
                           └── state_reason: reopened   (after reopen+close)
```

The `state_reason` field was added in 2022. Before that, all closures were equivalent.
The `duplicate` state_reason exists but is undocumented — it appears when closing via
the "Close as duplicate" UI option.

**Implications for tbd sync:**

- tbd has five statuses (`open`, `in_progress`, `blocked`, `deferred`, `closed`).
  GitHub has two states. The mapping is necessarily lossy:
  - `in_progress` and `blocked` have no GitHub equivalent (both map to `open`)
  - `deferred` maps to `closed` with `state_reason: not_planned`
  - Reverse mapping must be careful: reopening a `blocked` bead on GitHub should not
    change it to `open` (it should stay `blocked`)

#### REST API Endpoints

| Operation | Method | Endpoint |
| --- | --- | --- |
| List repo issues | GET | `/repos/{owner}/{repo}/issues` |
| Get single issue | GET | `/repos/{owner}/{repo}/issues/{number}` |
| Create issue | POST | `/repos/{owner}/{repo}/issues` |
| Update issue | PATCH | `/repos/{owner}/{repo}/issues/{number}` |
| Lock conversation | PUT | `/repos/{owner}/{repo}/issues/{number}/lock` |
| Unlock | DELETE | `/repos/{owner}/{repo}/issues/{number}/lock` |

The list endpoint returns both issues and PRs by default. Use `?pull_request=false` or
check the `pull_request` field to filter.

**Reference**: [GitHub REST API: Issues](https://docs.github.com/en/rest/issues/issues)

### 1.2 GitHub Pull Requests

PRs extend the issue model with merge-specific fields:

| Field | Type | Notes |
| --- | --- | --- |
| `head` / `base` | branch ref | Source and target branches |
| `mergeable` | boolean \| null | `null` while computing |
| `merged` | boolean | Whether PR was merged |
| `draft` | boolean | Draft PR status |
| `requested_reviewers` | user[] | Review requests |
| `merge_commit_sha` | string \| null | Test merge commit, then actual |

**Key points:**

- PRs share the `/issues/` API for labels, assignees, milestones, and comments.
  PR-specific operations (merge, reviews, files) use `/pulls/`.
- Cross-repository PRs require `username:branch` notation for the head ref.
- The `mergeable` field is computed asynchronously — it may be `null` on first fetch.

| Operation | Method | Endpoint |
| --- | --- | --- |
| List PRs | GET | `/repos/{owner}/{repo}/pulls` |
| Get PR | GET | `/repos/{owner}/{repo}/pulls/{number}` |
| Create PR | POST | `/repos/{owner}/{repo}/pulls` |
| Update PR | PATCH | `/repos/{owner}/{repo}/pulls/{number}` |
| Merge PR | PUT | `/repos/{owner}/{repo}/pulls/{number}/merge` |
| List commits | GET | `/repos/{owner}/{repo}/pulls/{number}/commits` |
| List files | GET | `/repos/{owner}/{repo}/pulls/{number}/files` |
| Check merged | GET | `/repos/{owner}/{repo}/pulls/{number}/merged` |

**Implication for tbd**: The `external_issue_url` field accepts both `/issues/` and
`/pull/` URLs. Since GitHub's Issues API handles both uniformly for status and label
operations, the sync logic does not need to differentiate.

**Reference**: [GitHub REST API: Pulls](https://docs.github.com/en/rest/pulls/pulls)

### 1.3 Labels

Labels are free-form strings scoped to a repository. They have:

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Case-sensitive display name |
| `color` | hex string | 6-char hex color (no `#` prefix) |
| `description` | string | Optional description |

**Key design points:**

- Labels are **per-repository**, not per-organization or per-project.
- GitHub provides 9 default labels on new repos: `bug`, `documentation`, `duplicate`,
  `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`.
- Labels must exist in a repository before they can be added to an issue.
  The API returns **422 Validation Failed** if you try to add a non-existent label.
- Anyone with write access can create labels; triage access allows applying them.

#### REST API Endpoints

| Operation | Method | Endpoint |
| --- | --- | --- |
| List repo labels | GET | `/repos/{owner}/{repo}/labels` |
| Create label | POST | `/repos/{owner}/{repo}/labels` |
| Get label | GET | `/repos/{owner}/{repo}/labels/{name}` |
| Update label | PATCH | `/repos/{owner}/{repo}/labels/{name}` |
| Delete label | DELETE | `/repos/{owner}/{repo}/labels/{name}` |
| List issue labels | GET | `/repos/{owner}/{repo}/issues/{number}/labels` |
| Add labels to issue | POST | `/repos/{owner}/{repo}/issues/{number}/labels` |
| Set issue labels | PUT | `/repos/{owner}/{repo}/issues/{number}/labels` |
| Remove all labels | DELETE | `/repos/{owner}/{repo}/issues/{number}/labels` |
| Remove one label | DELETE | `/repos/{owner}/{repo}/issues/{number}/labels/{name}` |

**Implication for tbd sync**: When pushing labels from a tbd bead to GitHub, the sync
must first ensure the label exists in the repository (create if not, ignore 422 if
already exists), then add it to the issue. This two-step approach is idempotent.

**Reference**: [GitHub REST API: Labels](https://docs.github.com/en/rest/issues/labels),
[Managing Labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)

### 1.4 Milestones

Milestones group issues within a repository by target date:

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Milestone name |
| `state` | `open` \| `closed` | |
| `due_on` | ISO 8601 \| null | Target date |
| `description` | string | Optional |

- Milestones are per-repository (like labels).
- An issue can have at most one milestone.
- Not currently relevant to tbd sync (no milestone field on beads), but worth noting
  for future extensions.

**Reference**: [GitHub REST API: Milestones](https://docs.github.com/en/rest/issues/milestones)

### 1.5 Sub-Issues (New, GA 2025)

GitHub announced general availability of sub-issues in early 2025, replacing the earlier
Tasklists beta:

- **Parent-child hierarchy**: Issues can have up to 100 sub-issues, nested up to 8
  levels deep.
- **Progress tracking**: Projects V2 includes a "sub-issue progress" field showing
  completion percentage.
- **Slide-out panel**: Sub-issues can be viewed/edited inline from the parent issue
  page.
- **API access**: Sub-issues can be managed via GraphQL mutations.

**Limitations:**

- Project table/board views do not display nested hierarchies — only flat lists with
  "Group by Parent Issue" as a workaround.
- No recursive hierarchy display in project views (highly requested feature, no
  timeline).

**Implication for tbd**: tbd already has parent-child bead relationships with
inheritance. GitHub's sub-issues are complementary — a tbd epic could link to a GitHub
parent issue, and child beads could link to GitHub sub-issues. However, this is future
work beyond the v1 `external_issue_url` feature.

**Reference**: [GitHub Docs: Adding Sub-Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues),
[Evolving GitHub Issues (GA)](https://github.com/orgs/community/discussions/154148)

### 1.6 Issue Types (New, GA 2025)

GitHub introduced organization-level issue types alongside sub-issues:

- **Default types**: `task`, `bug`, `feature` — provided out of the box.
- **Custom types**: Organization admins can create custom types (e.g., `spike`,
  `initiative`, `epic`).
- **Organization-scoped**: Unlike labels (per-repo), issue types are defined at the
  organization level and available across all repos.
- **Projects integration**: The "Type" field can be added to project views for
  filtering and grouping.
- **API access**: Available via GraphQL mutations (not yet via `gh` CLI flags).

**Implication for tbd**: tbd beads already have a `type` field (`task`, `bug`,
`feature`, `epic`). A future enhancement could map tbd types to GitHub issue types,
but this is not needed for v1.

**Reference**: [GitHub Docs: Managing Issue Types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization),
[Issue Types Public Preview](https://github.com/orgs/community/discussions/148715)

### 1.7 GitHub Projects V2

Projects V2 is GitHub's flexible project management layer, replacing the deprecated
"classic" project boards.

#### Data Model

| Concept | Description |
| --- | --- |
| **Project** (`ProjectV2`) | Container owned by user or organization |
| **Items** (`ProjectV2Item`) | Issues, PRs, or Draft Issues added to the project |
| **Fields** | Custom metadata on items (text, number, date, single select, iteration) |
| **Views** (`ProjectV2View`) | Saved filter/sort/layout configurations |
| **Workflows** | Built-in automation rules |

**Field types:**

| Type | Value Format | Notes |
| --- | --- | --- |
| Text | string | Free-form |
| Number | string (e.g., `"100.1"`) | Numeric as string |
| Date | `YYYY-MM-DD` | ISO date |
| Single Select | option ID | Powers board columns (e.g., "Status") |
| Iteration | iteration ID | Sprint/cycle tracking |

**Limits**: Up to 50 custom fields per project. Up to 50,000 items per project
(increased from 1,200 in the GA release).

#### View Layouts

| Layout | Description | Key Features |
| --- | --- | --- |
| **Table** | Spreadsheet-style | Sort, filter, group, show/hide columns |
| **Board** (Kanban) | Column-based | Drag-and-drop, WIP limits (advisory only), field sums |
| **Roadmap** | Timeline | Date/iteration fields, zoom levels (month/quarter/year) |

**Board/Kanban specifics:**

- Columns are derived from a single select field (typically "Status").
- Drag-and-drop between columns automatically updates the field value.
- Column limits (WIP limits) are **advisory only** — they display a visual indicator
  but do not block items from being added. This is a highly requested enforcement
  feature with no timeline.
- Horizontal grouping (swim lanes) and slicing (side-panel filtering) are available.

#### Built-in Automations

| Trigger | Action | Default? |
| --- | --- | --- |
| Item closed | Set status to "Done" | Yes |
| PR merged | Set status to "Done" | Yes |
| Item added to project | Set status (configurable) | No |
| Item reopened | Set status (configurable) | No |
| Status changed to value | Close/reopen underlying issue | No |

Additional automation types:

- **Auto-add**: Automatically adds new items from a repo matching filter criteria.
  Limit: 20 auto-add workflows per org. Does not retroactively add existing items.
- **Auto-archive**: Archives items matching filter criteria (supports `is`, `reason`,
  `updated` filters).

**For anything beyond these**, teams must use GitHub Actions or the GraphQL API.
Built-in workflows cannot trigger on column-to-column moves, custom field changes, or
cross-project events.

#### GraphQL API

Authentication requires a classic PAT or GitHub App token with `project` scope.
Fine-grained PATs do not work with the Projects V2 GraphQL API.

**Key mutations:**

| Mutation | Purpose |
| --- | --- |
| `addProjectV2ItemById` | Add issue/PR to project |
| `addProjectV2DraftIssue` | Create draft issue |
| `updateProjectV2ItemFieldValue` | Set field value |
| `clearProjectV2ItemFieldValue` | Clear field value |
| `deleteProjectV2Item` | Remove item |
| `archiveProjectV2Item` | Archive item |
| `createProjectV2Field` | Create custom field |
| `updateProjectV2` | Update project settings |
| `createProjectV2` | Create new project |

**Critical constraint**: You cannot add an item and update its fields in the same API
call. The add must complete first, returning the item ID, before fields can be set.

**No view mutations exist** — there are no GraphQL mutations for creating, updating, or
deleting views. View management is UI-only.

**Reference**: [GitHub Docs: About Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects),
[Using the API to Manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects),
[Built-in Automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)

* * *

## Part 2: Workflow Best Practices

### 2.1 Issue Lifecycle Patterns

**Simple flow (small teams):**
```
open → in progress (via assignee + label) → closed (completed)
```

**Kanban flow (with Projects V2 board):**
```
Backlog → Todo → In Progress → In Review → Done
```
Each stage is a single-select option on the Status field. Moving cards between columns
updates the status automatically.

**Sprint/iteration flow:**
```
Backlog → Sprint N (via iteration field) → In Progress → Done
```
Iteration fields support configurable durations, start dates, and breaks.

### 2.2 Label Conventions

Common label taxonomies:

| Category | Examples | Purpose |
| --- | --- | --- |
| **Type** | `bug`, `feature`, `enhancement`, `question` | What kind of work |
| **Priority** | `P0-critical`, `P1-high`, `P2-medium`, `P3-low` | Urgency |
| **Status** | `needs-triage`, `confirmed`, `wontfix` | Workflow state |
| **Area** | `frontend`, `backend`, `docs`, `infra` | Codebase area |
| **Effort** | `good first issue`, `help wanted` | Contributor signals |

**Best practice**: Use consistent label naming across repos in an organization.
GitHub does not enforce this — it requires manual discipline or automation
(GitHub Actions that create standard labels on repo creation).

### 2.3 Cross-Repository Workflows

GitHub does not natively support cross-repo issues. Common patterns:

1. **Dedicated issues repo**: Create `org/issues` or `org/tracker` repo for
   organization-wide issues. Link PRs from code repos using `org/issues#123`.

2. **Organization-level Projects**: A single project aggregates issues from multiple
   repos. This is the primary cross-repo coordination mechanism.

3. **Issue references**: Use `owner/repo#number` syntax in issue/PR bodies and
   comments to create cross-references. GitHub auto-links these.

4. **Autoclose via PR**: Including `Fixes owner/repo#123` in a PR description
   automatically closes the referenced issue when the PR merges — even cross-repo.

### 2.4 Automation Patterns with GitHub Actions

For workflows beyond built-in automations:

```yaml
# .github/workflows/project-automation.yml
on:
  issues:
    types: [opened, labeled]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v1
        with:
          project-url: https://github.com/orgs/myorg/projects/1
          github-token: ${{ secrets.PROJECT_TOKEN }}
```

**Authentication note**: The default `GITHUB_TOKEN` cannot access Projects V2.
You need either a GitHub App installation token (recommended for org projects) or a
classic PAT with `project` scope.

### 2.5 PR-Issue Linking

GitHub supports automatic issue closing via keywords in PR descriptions:

| Keyword | Effect |
| --- | --- |
| `Fixes #N` | Closes issue #N when PR merges |
| `Closes #N` | Same as Fixes |
| `Resolves #N` | Same as Fixes |

These work cross-repo with full URLs: `Fixes https://github.com/owner/repo/issues/N`.

**Implication for tbd**: When a bead is linked to a GitHub issue and the agent creates
a PR that fixes it, the PR description can include `Fixes <url>` to auto-close the
GitHub issue on merge. The next `tbd sync --external` would then pull the closed state
back to the bead.

* * *

## Part 3: Third-Party Integrations and Tools

### 3.1 Jira-GitHub Integration

The native "GitHub for Jira" app provides **one-way** linking: it shows GitHub commits,
branches, and PRs on Jira tickets. It does not create bidirectional issue sync.

For bidirectional sync, third-party tools are required:

| Tool | Sync Type | Key Features | Pricing |
| --- | --- | --- | --- |
| **Exalate** | Bidirectional | Groovy scripting, field mapping, multi-platform | Per-connection |
| **Unito** | Bidirectional | No-code rules, custom field sync | Per-user |
| **Getint** | Bidirectional | Single app (vs. Exalate's two), unlimited fields | Per-instance |

**Common sync fields**: status, assignees, comments, labels, priority, due dates,
custom fields.

**Key challenge**: Jira and GitHub have fundamentally different data models. Jira has
rich workflow states (customizable per project), while GitHub has only `open`/`closed`.
Sync tools must map between these, similar to how tbd maps its five statuses to GitHub's
two states.

**Reference**: [Exalate: Jira GitHub Integration](https://exalate.com/blog/jira-github-issues-integration/),
[Unito: GitHub Jira Integration](https://unito.io/integrations/github-jira/)

### 3.2 Linear-GitHub Integration

Linear provides native bidirectional GitHub sync:

- Merging a GitHub PR can auto-update the Linear issue status.
- Creating a branch from Linear auto-links it to the issue.
- Comments and status changes sync between platforms.

Linear's API is GraphQL-based with OAuth refresh tokens (updated 2025/2026). It offers
a faster, more opinionated UX than GitHub Issues but is a separate paid product.

**Implication for tbd**: Linear is a potential future sync target alongside GitHub.
The `external_issue_url` field could accept Linear URLs
(`https://linear.app/team/issue/TEAM-123`), but the sync logic would need a separate
provider implementation.

**Reference**: [Linear GitHub Integration](https://linear.app/integrations/github),
[Linear Review 2026](https://work-management.org/software-development/linear-review/)

### 3.3 Other Integration Tools

| Tool | Focus | GitHub Support |
| --- | --- | --- |
| **Zapier/Make** | General automation | Webhook-based, no deep field sync |
| **ZenHub** | GitHub-native PM | Adds epics, estimates, sprints to GitHub |
| **GitKraken** | Git client | Issue board integration |
| **Plane** | Open-source PM | GitHub issue sync (emerging) |
| **Shortcut** | PM for software teams | GitHub PR linking |

### 3.4 GitHub CLI (`gh`) as Integration Layer

The `gh` CLI is the primary interface tbd uses for GitHub API operations. Key
capabilities:

```bash
# Issue operations
gh issue create --title "..." --body "..." --label "bug"
gh issue close 123 --reason "completed"
gh issue reopen 123
gh issue view 123 --json state,stateReason,labels

# Label operations
gh label create "priority:high" --color "FF0000"
gh api repos/{owner}/{repo}/issues/{number}/labels -f labels[]="bug"

# PR operations
gh pr create --title "..." --body "..."
gh pr merge 123 --squash

# Raw API access
gh api repos/{owner}/{repo}/issues/123 --jq '.state'
gh api repos/{owner}/{repo}/issues/123 -f state=closed -f state_reason=completed
```

**Authentication**: `gh auth login` handles OAuth flow. Tokens are stored securely.
The `GH_TOKEN` environment variable can override for CI/automation.

**Implication for tbd**: All external issue operations in tbd use `gh api` via
`execFile`, following the pattern established in `github-fetch.ts`. This avoids direct
HTTP calls and leverages `gh`'s authentication and error handling.

* * *

## Part 4: Alternatives and Agent-Driven Development

### 4.1 Issue Tracker Landscape

| Tracker | Model | API | GitHub Integration | Agent-Friendliness |
| --- | --- | --- | --- | --- |
| **GitHub Issues** | Simple (open/closed) | REST + GraphQL | Native | High (gh CLI) |
| **Linear** | Rich (customizable states) | GraphQL | Bidirectional | Medium |
| **Jira** | Complex (custom workflows) | REST | Via plugins | Low (heavy UI) |
| **Plane** | Medium (open-source) | REST | Sync | Medium |
| **Shortcut** | Medium | REST | PR linking | Medium |
| **tbd Beads** | Rich (5 states, deps) | CLI | Planned | Very high |

### 4.2 Agent-Driven Development Patterns

AI coding agents (Claude Code, Cursor, Codex, etc.) change issue tracking requirements:

1. **CLI-first interfaces**: Agents interact via CLI, not web UI. Tools must have
   comprehensive CLI/API coverage. GitHub Issues + `gh` CLI scores well here.

2. **Structured output**: Agents need `--json` output for parsing. GitHub's
   `--json` flag and `--jq` filtering are excellent for this.

3. **Batch operations**: Agents often need to create/update multiple issues in sequence.
   GitHub's API handles this well, though rate limits apply (5,000 requests/hour for
   authenticated users).

4. **Context preservation**: Agents lose context between sessions. Issue trackers serve
   as persistent memory. tbd's bead system is designed specifically for this — beads
   persist across agent sessions via git.

5. **Dependency tracking**: Agents benefit from knowing which tasks are blocked.
   GitHub Issues has no native dependency concept. tbd beads have first-class
   dependencies (`tbd dep add`), which is a key differentiator.

6. **Auto-discovery**: Agents should be able to find available work without human
   guidance. tbd's `tbd ready` command returns beads that have no blockers — perfect
   for autonomous agent workflows.

### 4.3 Why External Issue Linking Matters for Agents

The external issue linking feature bridges two worlds:

- **tbd beads**: Rich, git-native, agent-optimized issue tracking with dependencies,
  inheritance, and CLI-first design.
- **GitHub Issues**: The industry-standard, human-readable, web-accessible issue
  tracker that teams already use.

By linking beads to GitHub Issues, agents can:

1. Work locally with tbd's rich model (dependencies, inheritance, batch operations)
2. Keep stakeholders informed via GitHub Issues (which they already monitor)
3. Sync status changes bidirectionally without manual intervention
4. Leverage GitHub's ecosystem (PR auto-close, project boards, notifications)

This is analogous to how `git` works: developers work locally with rich tooling, then
push to a remote that others consume through a web interface.

### 4.4 Design Decisions Informed by This Research

| Decision | Rationale from Research |
| --- | --- |
| Accept both `/issues/` and `/pull/` URLs | GitHub's Issues API handles both uniformly |
| Two-step label creation | GitHub API returns 422 for non-existent labels |
| `state_reason` mapping for deferred | `not_planned` is the closest GitHub equivalent |
| No `in_progress`/`blocked` sync to GitHub | No GitHub equivalent exists |
| Sync-at-sync-time (not on every operation) | Matches git's push/pull model; enables batching |
| Use `gh api` via `execFile` | Leverages existing auth; follows `github-fetch.ts` pattern |
| Advisory-only approach to Projects V2 | No API for view mutations; projects are optional |

* * *

## Validated References

### GitHub Official Documentation

- [REST API: Issues](https://docs.github.com/en/rest/issues/issues) — Issue CRUD,
  state, state_reason
- [REST API: Labels](https://docs.github.com/en/rest/issues/labels) — Label CRUD,
  issue label management
- [REST API: Pulls](https://docs.github.com/en/rest/pulls/pulls) — PR CRUD, merge,
  reviews
- [REST API: Milestones](https://docs.github.com/en/rest/issues/milestones) —
  Milestone management
- [Managing Labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels) —
  Label scope, defaults, permissions
- [About Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) —
  Projects V2 overview
- [Using the API to Manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects) —
  GraphQL mutations/queries
- [Built-in Automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations) —
  Default and configurable workflows
- [Automating Projects Using Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions) —
  GitHub Actions integration
- [Adding Items Automatically](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically) —
  Auto-add workflows
- [Archiving Items Automatically](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/archiving-items-automatically) —
  Auto-archive workflows
- [Customizing the Board Layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout) —
  Kanban WIP limits, column sums
- [Customizing the Roadmap Layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout) —
  Timeline view
- [Adding Sub-Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) —
  Parent-child issue hierarchy
- [Managing Issue Types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization) —
  Organization-level types
- [GraphQL Mutations Reference](https://docs.github.com/en/graphql/reference/mutations) —
  Full mutation list

### GitHub Community Discussions

- [Evolving GitHub Issues and Projects (GA)](https://github.com/orgs/community/discussions/154148) —
  Sub-issues, issue types GA announcement
- [Sub-issues Public Preview](https://github.com/orgs/community/discussions/139932) —
  Feature details and feedback
- [Issue Types Public Preview](https://github.com/orgs/community/discussions/148715) —
  Issue types details
- [Kanban WIP Limits Discussion](https://github.com/orgs/community/discussions/4848) —
  Community request for enforced limits
- [ProjectV2View Mutations](https://github.com/orgs/community/discussions/153532) —
  Confirmation that view mutations don't exist

### Third-Party Integration References

- [Exalate: Jira GitHub Integration Guide](https://exalate.com/blog/jira-github-issues-integration/) —
  Bidirectional sync setup
- [Unito: GitHub Jira Integration](https://unito.io/integrations/github-jira/) —
  No-code sync rules
- [Linear GitHub Integration](https://linear.app/integrations/github) —
  Native bidirectional sync
- [Linear Review 2026](https://work-management.org/software-development/linear-review/) —
  Feature comparison

### Technical Blog Posts

- [DevOps Journal: GitHub GraphQL ProjectsV2 Examples](https://devopsjournal.io/blog/2022/11/28/github-graphql-queries) —
  Practical query/mutation examples
- [Some Natalie: Intro to GraphQL with GitHub Projects](https://some-natalie.dev/blog/graphql-intro/) —
  Custom fields via API
- [Den Delimarsky: Programmatically Setting Issue Types](https://den.dev/blog/set-github-issue-type/) —
  GraphQL workaround for issue types
