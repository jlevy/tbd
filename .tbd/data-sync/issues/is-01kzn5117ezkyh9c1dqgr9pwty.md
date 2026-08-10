---
type: is
id: is-01kzn5117ezkyh9c1dqgr9pwty
title: tests/fixtures/linear-mock.ts + Phase 1 golden tryscripts
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn511m3x7ekbbkz2h5dcfqj
  - type: blocks
    target: is-01kzn5147yrf3sw28jc7n600r7
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:13.293Z
updated_at: 2026-08-10T21:54:58.015Z
extensions:
  linear:
    id: 66764af6-1f30-47c1-ac47-074f658618ad
    key: TBD-62
    url: https://linear.app/finterm-ai/issue/TBD-62/testsfixtureslinear-mockts-phase-1-golden-tryscripts
    linked_at: 2026-08-10T21:10:27.200Z
---
http.createServer returning canned GraphQL responses, selected via LINEAR_API_URL; credential still required so the auth path is exercised. Golden coverage: status unconfigured -> configured -> valid; mirror; re-mirror no-op; link guard; duplicate-id create treated as success; attachment upsert does not duplicate; rate-limit backoff. Plus a secret-hygiene test asserting no credential substring appears in stdout, stderr, --json, bridge state, or error text INCLUDING failure paths. Spec Testing Strategy.

## Notes

Mock Linear server exists (tests/helpers/linear-mock-server.ts) and reproduces the API's real quirks: 200-with-errors, 400 RATELIMITED, duplicate-id rejection, attachment upsert on url. Covered by unit tests. NOT done: tryscript goldens driving the CLI against it.
