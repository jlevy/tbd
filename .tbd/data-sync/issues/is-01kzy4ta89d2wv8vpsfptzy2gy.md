---
type: is
id: is-01kzy4ta89d2wv8vpsfptzy2gy
title: Extract provider-neutral live compatibility QA harness
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - qa
dependencies: []
parent_id: is-01kzxz152g5e546pxjs6w8ckbs
created_at: 2026-08-13T18:05:43.048Z
updated_at: 2026-08-13T18:09:18.974Z
closed_at: 2026-08-13T18:09:18.973Z
close_reason: Provider-neutral compatibility checklist extracted, tested, documented, and proven by a successful 11-scenario Linear API run; future GitHub QA can reuse it without executing Linear-specific code.
---
Make the API-driven live compatibility contract import-safe and provider-neutral so a future GitHub driver can reuse the same stable scenario checklist, completion enforcement, and reporting without importing or executing the Linear-specific runner.

## Notes

Added import-safe scripts/provider-live-qa-contract.ts with the stable 11-scenario identifiers and completion checklist. It rejects duplicate evidence, reports every omitted scenario, records only successful actions, and is consumed by the Linear runner. Unit proof is green and the full Linear driver passed all 11 scenarios with cleanup.
