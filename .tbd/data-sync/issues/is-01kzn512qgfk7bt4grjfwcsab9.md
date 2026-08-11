---
type: is
id: is-01kzn512qgfk7bt4grjfwcsab9
title: "integrations/core/intents.ts: write-ahead journal and replay"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn513dx5caz86bq89cm502s
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:14.831Z
updated_at: 2026-08-11T06:50:56.586Z
extensions:
  linear:
    id: 1bc76460-8812-4ce8-b3bf-5844dee9ef8b
    linked_at: 2026-08-11T06:50:56.586Z
    key: TBD-123
    url: https://linear.app/finterm-ai/issue/TBD-123/integrationscoreintentsts-write-ahead-journal-and-replay
---
There is no transaction spanning git and an external API, so compensate: before any external write, append planned writes (with client-generated UUIDs) to intents.yml and commit; on restart, unfinished intents replay. Attachment writes are idempotent by design; issueCreate replays treat duplicate-id as success; issueUpdate replays are followed by a base refresh so they cannot echo. Sync runs under the existing repo-scoped data-sync lock, so git serializes volunteers exactly as it already does for tbd sync. Tests simulate a crash at each step. Spec Component 10.
