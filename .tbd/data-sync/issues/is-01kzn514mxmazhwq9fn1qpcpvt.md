---
type: is
id: is-01kzn514mxmazhwq9fn1qpcpvt
title: "integrations/github/: client, adapter, mapping"
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
    target: is-01kzn5152hkvnx553tj4gwgc28
  - type: blocks
    target: is-01kzx8kn4vtndb0t84345snpy5
  - type: blocks
    target: is-01kzx8knkqyxmghreewwsy16h9
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-10T06:16:16.797Z
updated_at: 2026-09-16T00:18:08.815Z
extensions:
  linear:
    id: d4d7b290-87b0-4fba-9978-af3809155d1d
    linked_at: 2026-08-11T06:51:03.671Z
    key: TBD-128
    url: https://linear.app/finterm-ai/issue/TBD-128/integrationsgithub-client-adapter-mapping
---
Implement packages/tbd/src/integrations/github/client.ts, adapter.ts, queries.ts, and mapping.ts behind the existing TrackerAdapter seam. Use native fetch and GitHub REST endpoints only: resolve owner/repo#N and canonical URLs, batch issue reads, updated-since pagination, create/update issue fields, labels, comments, and stable repository targeting. Resolve credentials through integrations/core/credentials.ts using GITHUB_TOKEN then the existing gh auth token fallback without process.env mutation. Extend registry/config/status so repository and owner are validated offline and probed online. TDD with a faithful GitHub mock plus mapping/client/registry/status cases; no new dependency.

## Notes

Provider research for this bead: docs/project/research/current/research-2026-09-15-github-issues-for-tracker-adapter.md (PR #295), verified 2026-09-15. Reusable test material from closed PR #83: read it with git show 4795e47f:packages/tbd/tests/github-issues.test.ts. That file has 48 cases (24 URL parsing and formatting, 19 status mapping, 5 label diff); only the parsing cases are reusable, and the mapping cases encode the superseded deferred-to-not_planned design. Do not copy the file. Its URL regex is anchored and rejects a trailing slash, any query string, and any fragment, so a browser-copied URL ending in an issuecomment anchor fails; it also has no case for the owner/repo#123 short form (which resolveRef must accept, core/types.ts:292) or for a GHES host. Reuse the table, widen the grammar. Decisions this bead owns per the research: creates are not idempotent on GitHub (no client id in REST or in GraphQL CreateIssueInput; clientMutationId is echoed, not deduplicated), so the write-ahead journal needs a recovery path rather than an idempotency key; the tbd://bead one-writer claim needs a carrier that is not an attachment; which X-GitHub-Api-Version to pin (2026-03-10 removes the singular assignee field, unpinned defaults to 2022-11-28); whether kind maps to org issue types and priority to the default Priority issue field. Unverified items to probe against a disposable repo: label auto-creation when adding an unknown label (PR #83 asserted 422 without a citation and the current docs say nothing), whether an issue id survives a cross-repo transfer, and what bumps issue updated_at, which the since filter keys on.
