---
type: is
id: is-01m00j9jkhwgbczp3hkcy38z7q
title: A quiet tbd sync must write nothing (bridge records rewritten on every run)
kind: bug
status: open
priority: 0
version: 7
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - sync-efficiency
  - phase-1
dependencies:
  - type: blocks
    target: is-01m00h60xmsj85fqn07wkrtjqd
  - type: blocks
    target: is-01m00h57nkvtvkbqn992w5fm2e
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:39:43.473Z
updated_at: 2026-08-14T17:25:09.155Z
---
MEASURED against the bundled mock Linear server: a settled mirror, re-synced with nothing changed anywhere, still rewrites EVERY bridge link record. The only diff is the timestamp:

  - synced_at: 2026-08-14T16:34:57.878Z
  + synced_at: 2026-08-14T16:34:57.898Z

Cause: the apply loop iterates every synchronizable pair, not only changed ones (sync-engine.ts:1097 over executablePairs), and ends by calling writeLinkRecord unconditionally with synced_at: options.now() (sync-engine.ts:1216-1230). synced_at is a persisted schema field (schemas.ts:425), so the file genuinely differs.

Consequences compound:
- Every sync writes N files, so every sync commits, so every sync pushes, so the parent repo's pre-push hook fires every sync (see tbd-7okw). The cheap no-push path (sync.ts:1220, verified: a git-only no-op sync is 2.9s with zero commits) never happens once Linear is on.
- tbd changes fills with commits carrying no information.
- report.nothingToDo is true while N files are rewritten, so the report and the git history disagree. Anything built on the report — a hook, a dashboard — believes the sync was free.

Fix, either: (a) write the record only when a field other than synced_at differs, or (b) drop synced_at from LinkRecordSchema entirely — it is diagnostic only; correctness rides on base and remote_updated_at, and the git commit time already records when the record moved.

Add the regression test the audit used: settle a mirror, run once more, assert ZERO bytes change under bridge/<provider>/links/. Nothing currently pins this.

This is the highest-priority efficiency item: it is what makes 'sync is free when nothing happened' true, which every frequent-sync design depends on.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F9, §1.7, E10
