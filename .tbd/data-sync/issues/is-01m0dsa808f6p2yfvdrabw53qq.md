---
type: is
id: is-01m0dsa808f6p2yfvdrabw53qq
title: Session adapter registry
kind: feature
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0dsa8bnkbes44tnda9tqtft
  - type: blocks
    target: is-01m0dsa8pe5fsxx8c82wf5gfhx
  - type: blocks
    target: is-01m0dsa91nkb3j5b4j4ky8y65p
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:33.031Z
updated_at: 2026-08-19T23:49:46.909Z
extensions:
  linear:
    id: 07a53ed7-2688-4059-b9a4-d31101a091a9
    linked_at: 2026-08-19T23:49:46.909Z
---
A registry mirroring integrations/core/registry.ts. SessionAdapter has provider, poll(refs), and an optional discover(beadId) for providers that support reverse lookup. Adapters ship disabled and are opt-in through integration config.
