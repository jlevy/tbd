---
type: is
id: is-01kzn50tnf2yx0ndsgpfqw91mb
title: "integrations/linear/client.ts: LinearClient.gql with rate limiting"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50vbgseh54rtpjz6jf2g1
parent_id: is-01kzn2w8x0c038fhk1c859248r
created_at: 2026-08-10T06:16:06.574Z
updated_at: 2026-08-10T17:35:53.902Z
closed_at: 2026-08-10T17:35:53.902Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
gql<T>(query, variables, schema): raw 'Authorization: <key>' header (NOT Bearer for API keys). Check the GraphQL errors array: partial success arrives with HTTP 200. RATELIMITED arrives on HTTP 400 (not 429): back off to X-RateLimit-Requests-Reset with bounded retries. Read X-RateLimit-Requests-Remaining and warn below a floor rather than trusting the documented quota (observed 2500/hr, documented 5000). Pagination helper capped at first:250 (undocumented max). LINEAR_API_URL override for the mock server, credential still required so tests exercise auth. Spec Component 8.
