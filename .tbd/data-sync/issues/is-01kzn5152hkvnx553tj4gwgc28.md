---
type: is
id: is-01kzn5152hkvnx553tj4gwgc28
title: "PR links: extensions.github.prs to attachmentLinkGitHubPR"
kind: task
status: open
priority: 2
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - github
  - integration
dependencies:
  - type: blocks
    target: is-01kzn515e154th2ehqthkpcv0v
  - type: blocks
    target: is-01kzx8knkqyxmghreewwsy16h9
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-10T06:16:17.232Z
updated_at: 2026-09-16T00:18:26.917Z
extensions:
  linear:
    id: e4a2e265-ed0d-439d-9db3-51186d517dcf
    linked_at: 2026-08-11T06:51:04.870Z
    key: TBD-129
    url: https://linear.app/finterm-ai/issue/TBD-129/pr-links-extensionsgithubprs-to-attachmentlinkgithubpr
---
Define pull requests as implementation relationships, not generic issue-sync targets: GitHub issues participate in outbound projection, explicit inbound creation, and two-way sync, while PRs are read-only associations stored in extensions.github.prs with stable repo/number/url and refreshed display metadata. Add provider-generic helpers that preserve the existing extensions.github issue-link payload, CLI verbs to link/unlink/list PR associations without changing PR title/body/state, and Linear attachmentLinkGitHubPR/attachmentLinkGitHubIssue upserts keyed by URL. Cover namespace merges, stale/closed PR refresh, duplicate association idempotency, and coexistence with a GitHub issue link.

## Notes

Unresolved discrepancy this bead owns: where a bead's PR links live. plan-2026-08-10-external-tracker-integrations.md:697-713 decides the extensions.github namespace and shows prs plus issue keys, and :1557 states this bead as Store extensions.github.prs, which the description above repeats. plan-2026-08-14-external-sync-and-traceability.md:325-330 decides the opposite (GitHub issues are refs, not extensions.github) and reserves extensions.<provider> for the one tracker item a bead is. The f08 schema encodes the later reading: IssueRef and the refs field in lib/schemas.ts:212-230 and :282, refs union-merged on url, tbd ref add shipped, and packages/tbd/docs/tbd-design.md:6969-6970 says generic refs persist GitHub issue and PR URLs. The later, implemented reading looks right (refs is many-valued, a provider namespace is single-valued by construction), but this bead also promises refreshed display metadata for a PR (title, state, merged-ness), which is mutable provider data that the design keeps in bridge records rather than in beads. Decide both questions together and correct whichever spec loses. Background and citations: docs/project/research/current/research-2026-09-15-github-issues-for-tracker-adapter.md section 10.4 (PR #295). The research also records that REST has no endpoint returning an issue's linked PRs, so PR association discovery needs GraphQL closingIssuesReferences or closedByPullRequestsReferences, and that manual PR-to-issue linking is capped at 10 issues in the same repository while cross-repo linking is keyword-only.
