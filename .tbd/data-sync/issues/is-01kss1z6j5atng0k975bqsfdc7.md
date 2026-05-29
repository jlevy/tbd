---
type: is
id: is-01kss1z6j5atng0k975bqsfdc7
title: QA playbook still instructs removed cut-release shortcut
kind: bug
status: closed
priority: 2
version: 3
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
  - docs
dependencies: []
parent_id: is-01ksrpdkemmkkhh4j6egqyrvsq
created_at: 2026-05-29T05:05:34.276Z
updated_at: 2026-05-29T05:09:13.772Z
closed_at: 2026-05-29T05:09:13.771Z
close_reason: "Fixed in PR head 5ecb7f2: Phase 3 now links directly to docs/publishing.md instead of the removed cut-release shortcut."
---
The v0.2.0 QA playbook says to follow `tbd shortcut cut-release` in Phase 3, but this release removes that standard shortcut and relocates the project-specific release flow to docs/publishing.md. Update the playbook so the release operator follows docs/publishing.md directly.
