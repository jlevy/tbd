---
type: is
id: is-01kzrsajhday2nyvfnbk2c097t
title: "Phase 6.2: prove packaged install, lifecycle, wake, and Git isolation"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - qa
  - packaging
  - isolation
  - web
dependencies:
  - type: blocks
    target: is-01kzrsarka5sq9h3x8v5yp7vpm
parent_id: is-01kzrs779s8d2t4qmvpx310p22
created_at: 2026-08-11T16:08:40.748Z
updated_at: 2026-08-11T16:25:05.034Z
extensions:
  linear:
    id: 6a507fb2-ddf1-4fa0-a230-2feef233958b
    linked_at: 2026-08-11T16:25:05.034Z
    key: TBD-151
    url: https://linear.app/finterm-ai/issue/TBD-151/phase-62-prove-packaged-install-lifecycle-wake-and-git-isolation
---
Build/pack/install an isolated candidate and prove dist/web/index.html is present; exercise tbd web --help/dry-run/start, default and pinned ports, Host/Origin rejection, POST 404, SSE wake/resume, local refresh, SIGINT 130/SIGTERM cleanup, theme/reduced-motion manual checks, and snapshot caller worktree/refs/FETCH_HEAD/hidden worktree/locks before/after. Record exact evidence.
