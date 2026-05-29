---
type: is
id: is-01ksrpcjhh597rhrxvac09m6wc
title: "[task] Run Phase 2.D upgrade validation on flowmark (two sibling worktrees, tbd_version 0.1.12)"
kind: task
status: closed
priority: 2
version: 4
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdkemmkkhh4j6egqyrvsq
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:09.616Z
updated_at: 2026-05-29T03:50:25.838Z
closed_at: 2026-05-29T03:50:25.837Z
close_reason: "All flowmark scenarios green: main checkout + two sibling worktrees migrated cleanly under tbd-afjh notice; 56 issues preserved; idempotent on rerun. Playbook status table updated."
---
Second testbed for f03→f04 migration per tests/qa/release-v0.2.0-upgrade.qa.md §2.D. Covers cases ATA doesn't:
- Lower baseline 'tbd_version: 0.1.12' (vs ATA's dev version) — exercises longer migration distance.
- Two sibling worktrees at /private/tmp/flowmark-pr47-fresh.vvTbeB and /private/tmp/flowmark-pr49.BeDey9 (vs ATA's one).
- Pre-existing untracked '.agents/' and '.codex/' artifacts in main checkout — exercises the codex-hook noise pre-flight (§2.0).

Expected: same migration outcome as ATA. If something diverges, capture in playbook and convert to a bug.

Repo: /Users/levy/wrk/github/flowmark
