---
type: is
id: is-01kzmm9dhgj1ygc3qysrehs66v
title: Run manual release-candidate QA for bead watch
kind: task
status: open
priority: 1
version: 3
spec_path: tests/qa/watch-infrastructure-release.qa.md
labels:
  - bead-watch
  - validation
dependencies: []
parent_id: is-01kzmm8zqnf8q210etncddjn6h
created_at: 2026-08-10T01:23:42.255Z
updated_at: 2026-08-10T01:47:07.004Z
---
Execute the watch infrastructure QA playbook against a packed or published candidate on real GitHub transport and representative macOS/Linux/Windows shells; test network interruption, credentials, long-running worker restart/idempotency, existing-workflow non-disruption, cleanup, and operator-readable output. Record evidence before release promotion. Linear sandbox exercises are explicitly optional and non-gating.

## Notes

Current source candidate and isolated-prefix tarball smoke passed. Remaining release-promotion evidence: repeat tarball at exact release-tag SHA/checksum; credentialed private remote; real protected-ref/worktree coexistence; brief/persistent transport failure; durable worker restart/idempotency; intended runner permissions; representative macOS/Linux/Windows artifact samples. Linear sandbox remains explicitly non-gating.
