---
type: is
id: is-01m2yr30ecm6g3wt44b1bhjdgm
title: "Reconcile PR stack #309/#310 with changes already landed on origin/main"
kind: task
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2ynnnzw1d0kxwm0s4qvdevf
hold: null
hold_until: null
created_at: 2026-09-20T06:29:36.330Z
updated_at: 2026-09-20T06:29:46.006Z
started_at: 2026-09-20T06:29:46.005Z
---
Fetch origin/main and reconcile the complete formal PR stack #309/#310 on top of upstream changes that landed first. Preserve upstream PR316 reviewable-unit and stack-routing guidance alongside the reviewed policy, lifecycle and delegation changes. Use gh stack rebase rather than a merge commit for the formal stack, inspect all text and semantic conflict resolutions, verify upper-layer patch preservation, regenerate affected integration/golden artifacts, run focused checks and full CI on both final pushed heads. This is branch reconciliation; merging the PRs into main remains outside the review/fix request.
