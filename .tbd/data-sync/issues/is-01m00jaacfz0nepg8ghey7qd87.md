---
type: is
id: is-01m00jaacfz0nepg8ghey7qd87
title: Fix the sync.ts comment claiming the integration fold is off by default
kind: bug
status: open
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:40:07.823Z
updated_at: 2026-08-14T17:25:09.178Z
---
sync.ts:1155 opens the integration fold site with 'Integration fold, off by default.' It is ON by default: sync_on_tbd_sync defaults to true (schemas.ts:581) and the guard tests !== false. A reader auditing this file — human or agent — takes away the reverse of the truth.

One line, and exactly the kind of thing a future audit trusts.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F8, §1.2, E13
