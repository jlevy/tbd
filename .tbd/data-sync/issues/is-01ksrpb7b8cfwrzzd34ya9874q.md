---
type: is
id: is-01ksrpb7b8cfwrzzd34ya9874q
title: "[epic] Release tbd v0.2.0 (shared common-dir worktree, f04 migration)"
kind: epic
status: open
priority: 0
version: 11
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels: []
dependencies: []
child_order_hints:
  - is-01ksrpbzcggmzd76nf6eh4vqf4
  - is-01ksrpc66nv4f23t31t3e4758m
  - is-01ksrpcdpq0v2qkqtk33m0k55t
  - is-01ksrpcjhh597rhrxvac09m6wc
  - is-01ksrpcxj1c6esrthdwvd6390g
  - is-01ksrpd50dfwh6y3449a864dmq
  - is-01ksrpddt285edvk30rxjxbv7h
  - is-01ksrpdkemmkkhh4j6egqyrvsq
  - is-01ksrpdqq35gddkbpr21xrdrqd
  - is-01kss0t446hjek1vq150eaxk89
created_at: 2026-05-29T01:42:25.383Z
updated_at: 2026-05-29T04:45:19.365Z
---
Track all remaining work to ship v0.2.0 — the first release carrying the f03→f04 on-disk format bump (shared common-dir sync worktree).

QA playbook: tests/qa/release-v0.2.0-upgrade.qa.md

Migration on the testbed (ai-trade-arena, 3548 issues) works end-to-end: clean byte-identical issue migration, legacy worktree removed, idempotent rerun, old-client fail-closed, doctor recovery, sign-by-default overlay. Findings to close before publish:

1. Migration trigger UX mismatch (tbd status/doctor → doctor --fix but migration is in sync).
2. Sibling-worktree silently bumps per-checkout config to f04 with no notice.
3. Stale dist/ is a test-suite footgun.
4. Phase 2.D validation on flowmark.
5. v0.2.0 release notes (incl. 0.1.30 upgrade caveat).
6. Cut release.
7. Post-publish re-validation.
8. tbd doctor exit-code semantics on hard findings.
