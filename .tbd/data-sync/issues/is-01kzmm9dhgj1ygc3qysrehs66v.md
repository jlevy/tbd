---
type: is
id: is-01kzmm9dhgj1ygc3qysrehs66v
title: Run manual release-candidate QA for bead watch
kind: task
status: open
priority: 1
version: 5
spec_path: tests/qa/watch-infrastructure-release.qa.md
labels:
  - bead-watch
  - validation
dependencies: []
parent_id: is-01kzmm8zqnf8q210etncddjn6h
created_at: 2026-08-10T01:23:42.255Z
updated_at: 2026-08-10T02:48:08.011Z
---
Execute the watch infrastructure QA playbook against a packed or published candidate on real GitHub transport and representative macOS/Linux/Windows shells; test network interruption, credentials, long-running worker restart/idempotency, existing-workflow non-disruption, cleanup, and operator-readable output. Record evidence before release promotion. Linear sandbox exercises are explicitly optional and non-gating.

## Notes

Automated source and isolated-prefix tarball smokes now pass with concurrent watchers, every selector, output mode, exit class, active-watch full sync/read coexistence, and caller/ref/FETCH_HEAD/hidden-worktree/lock/private-ref assertions; cross-platform built-candidate smoke is wired into CI. Remaining release-promotion evidence: repeat the tarball at the exact release-tag SHA and checksum; run the exact artifact under Node 20; credentialed private GitHub remote; before/after protected-state snapshot; brief/persistent transport failures; durable worker restart/idempotency; intended runner permissions; representative macOS/Linux/Windows packed-artifact and shell samples; human operator review; idle soak. Linear remains non-gating.
