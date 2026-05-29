---
type: is
id: is-01ksrpdqq35gddkbpr21xrdrqd
title: "[task] Phase 5: post-publish re-validate ATA, flowmark, and this repo with published v0.2.0"
kind: task
status: open
priority: 1
version: 1
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:47.682Z
updated_at: 2026-05-29T01:43:47.682Z
---
Per tests/qa/release-v0.2.0-upgrade.qa.md §5.

Steps:
- 'npm install -g get-tbd@0.2.0' (replace the local dev install)
- 'tbd --version' → '0.2.0'
- Re-run §5.2 against ai-trade-arena: tbd status / doctor / list / create / sync — no re-migration noise, no surprise tracked diffs
- Re-run §5.3 against flowmark and its /private/tmp siblings
- §5.4: 'tbd shortcut --list' and 'tbd guidelines --list' work in this repo (they currently fail-closed on global v0.1.30 because this repo is f04)

Update playbook status table to ✅ on success.
