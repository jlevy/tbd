---
type: is
id: is-01ksrpddt285edvk30rxjxbv7h
title: "[task] Author v0.2.0 release notes (covers f04 migration, upgrade caveats, sibling-worktree behavior)"
kind: task
status: open
priority: 1
version: 2
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies:
  - type: blocks
    target: is-01ksrpdkemmkkhh4j6egqyrvsq
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T01:43:37.537Z
updated_at: 2026-05-29T01:44:13.299Z
---
Prepend a '## 0.2.0' section to packages/tbd/CHANGELOG.md per packages/tbd/docs/guidelines/release-notes-guidelines.md. release.yml greps for '## 0.2.0' verbatim; the heading must match exactly.

Lead with the f04 format bump and its user impact:

1. f03 → f04 on-disk format. Every machine touching a tbd-managed repo must upgrade to v0.2.0.
2. Old clients (≤0.1.30) fail closed with the explicit upgrade message on most commands. KNOWN PRE-EXISTING QUIRK: v0.1.30's 'tbd doctor' reports 'Invalid config file' (exit 0) instead of the upgrade message. If you see that, run 'npm install -g get-tbd@latest' — do not try 'doctor --fix' on the older client.
3. Multi-worktree sibling behavior: the first mutating op from a sibling whose '.tbd/config.yml' was f03 will bump it to f04 in place. Commit on that branch or merge main to publish the upgrade. (tbd-afjh adds an explicit notice.)
4. Migration trigger: in v0.2.0 'tbd doctor --fix' performs the f03→f04 migration directly (tbd-nrvj).
5. Hardening: shared-lock boundary covers init/repair; internal tbd-sync commits force commit.gpgsign=false so sign-by-default envs don't stall; 'tbd doctor --fix' surfaces future-format layouts cleanly without downgrading.

Also: verify packages/tbd/src/lib/tbd-format.ts has FORMAT_HISTORY.f04.introduced === '0.2.0' (should already).
