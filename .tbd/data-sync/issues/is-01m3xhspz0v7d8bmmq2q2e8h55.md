---
type: is
id: is-01m3xhspz0v7d8bmmq2q2e8h55
title: Correct README setup bootstrap ordering
kind: bug
status: in_progress
priority: 2
version: 2
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-10-02T05:36:07.643Z
updated_at: 2026-10-02T05:37:11.769Z
started_at: 2026-10-02T05:37:11.765Z
---
User reproduced shortcut setup-tbd failing before repository initialization in 0.9.0; candidate 0.10.0 behaves the same. Correct README Quick Start and setup-tbd introduction to install CLI, use prime for initial instructions, ask prefix and run setup, then load shortcut to review policies. Validate before/after in isolated fixture, commit to README stack layer and restack release; refresh applicable review/package evidence and push. No merge or release.
