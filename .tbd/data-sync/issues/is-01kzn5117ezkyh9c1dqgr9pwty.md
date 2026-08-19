---
type: is
id: is-01kzn5117ezkyh9c1dqgr9pwty
title: tests/fixtures/linear-mock.ts + Phase 1 golden tryscripts
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn511m3x7ekbbkz2h5dcfqj
  - type: blocks
    target: is-01kzn5147yrf3sw28jc7n600r7
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:13.293Z
updated_at: 2026-08-11T06:45:58.292Z
closed_at: 2026-08-11T06:45:58.292Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
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
