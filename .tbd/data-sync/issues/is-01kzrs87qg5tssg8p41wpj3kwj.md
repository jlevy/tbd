---
type: is
id: is-01kzrs87qg5tssg8p41wpj3kwj
title: "Phase 3.3: implement in-process remote/local wake coordinator"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - server
  - watch
  - web
dependencies:
  - type: blocks
    target: is-01kzrs8gb1ky34vpdv7qfdfv4q
parent_id: is-01kzrs66v8et3vwh2tpmk3v9d9
created_at: 2026-08-11T16:07:24.143Z
updated_at: 2026-08-11T16:29:38.633Z
closed_at: 2026-08-11T16:29:38.632Z
close_reason: Implemented src/cli/web/wake.ts with in-process AbortSignal watch, runIssueSync pull-before-reload, report-tip resume state, debounced hidden-worktree observation, suppression/no-op correctness, backoff, bounded log, and two deterministic wake tests.
extensions:
  linear:
    id: b5dfad0e-d667-4fe6-8b53-3d4cb58955d5
    linked_at: 2026-08-11T16:24:47.596Z
    key: TBD-141
    url: https://linear.app/finterm-ai/issue/TBD-141/phase-33-implement-in-process-remotelocal-wake-coordinator
---
Create packages/tbd/src/cli/web/wake.ts. Run watchForIssueChanges with AbortSignal and resume tip; on remote movement call runIssueSync then BoardState.reload and broadcast; debounce fs.watch on the hidden issue directory for unpublished local edits; distinguish local/remote events by snapshot diff, apply retry/recycle backoff, unref timers, and suppress expected abort noise. Add deterministic fake-watch/fake-fs tests.
