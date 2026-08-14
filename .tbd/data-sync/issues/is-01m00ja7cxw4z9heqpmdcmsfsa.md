---
type: is
id: is-01m00ja7cxw4z9heqpmdcmsfsa
title: tbd sync --dry-run and --status never cover the tracker
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:40:04.765Z
updated_at: 2026-08-14T16:40:04.765Z
---
Two gaps in the same surface:

1. tbd --dry-run sync previews docs and git but never Linear. The dry-run guard returns before fullSync, and surface 3 excludes dry runs outright (sync.ts:234). So the one command an agent reaches for to answer 'what would this do to Linear?' is exactly the one that will not say — while tbd --dry-run integration sync does preview it. The inconsistency is the problem.

2. tbd sync --status reports git and docs but nothing about the tracker: not whether it is enabled, reachable, when it last synced, or whether intents are pending. That is precisely the state tbd prime and any hook would want to read for freshness (see tbd-zhel).

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F7, §1.2, E12
