---
type: is
id: is-01kzn514mxmazhwq9fn1qpcpvt
title: "integrations/github/: client, adapter, mapping"
kind: task
status: open
priority: 2
version: 6
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
updated_at: 2026-08-13T09:52:57.299Z
extensions:
  linear:
    id: d4d7b290-87b0-4fba-9978-af3809155d1d
    linked_at: 2026-08-11T06:51:03.671Z
    key: TBD-128
    url: https://linear.app/finterm-ai/issue/TBD-128/integrationsgithub-client-adapter-mapping
---
Implement packages/tbd/src/integrations/github/client.ts, adapter.ts, queries.ts, and mapping.ts behind the existing TrackerAdapter seam. Use native fetch and GitHub REST endpoints only: resolve owner/repo#N and canonical URLs, batch issue reads, updated-since pagination, create/update issue fields, labels, comments, and stable repository targeting. Resolve credentials through integrations/core/credentials.ts using GITHUB_TOKEN then the existing gh auth token fallback without process.env mutation. Extend registry/config/status so repository and owner are validated offline and probed online. TDD with a faithful GitHub mock plus mapping/client/registry/status cases; no new dependency.
