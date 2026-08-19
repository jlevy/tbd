---
type: is
id: is-01m0dsa91nkb3j5b4j4ky8y65p
title: Claude Managed Agents session adapter
kind: feature
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies: []
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:34.100Z
updated_at: 2026-08-19T23:48:38.103Z
extensions:
  linear:
    id: 13c3dc5e-f996-4792-bd39-9bcb4cecfc02
    linked_at: 2026-08-19T23:48:38.103Z
---
sessions.list filtered on metadata.bead_id (metadata allows 8 keys); statuses idle/running/rescheduling/terminated map into the tbd vocabulary. Console URL is https://platform.claude.com/workspaces/{workspace}/sessions/{id} and the workspace segment is not on the session object, so carry it as config. Implements discover. Beta, Claude API and Claude Platform on AWS only.
