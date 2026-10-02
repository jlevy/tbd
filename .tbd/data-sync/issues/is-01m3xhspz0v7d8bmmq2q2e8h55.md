---
type: is
id: is-01m3xhspz0v7d8bmmq2q2e8h55
title: Correct README setup bootstrap ordering
kind: bug
status: in_progress
priority: 2
version: 3
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-10-02T05:36:07.643Z
updated_at: 2026-10-02T05:40:00.266Z
started_at: 2026-10-02T05:37:11.765Z
---
Verify standard first-install and existing-project flows, whether the user installs the CLI or explicitly asks the agent to run npm install -g get-tbd@latest. Correct README and setup shortcut ordering. Fix pre-init prime command rendering and handoff to setup-tbd after initialization. Add sequence regression and golden coverage; validate packed CLI installation, prime, setup, post-setup shortcut and existing-project refresh. Changes in README/release owning stack layers, refresh proofs/reviews and push; no merge or release.
