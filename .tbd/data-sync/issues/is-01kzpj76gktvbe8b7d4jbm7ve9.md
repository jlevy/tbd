---
type: is
id: is-01kzpj76gktvbe8b7d4jbm7ve9
title: "PR #207 review R1: board sort tiebreaks on display id, CLI uses ULID"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01kzpj754g9qh0be784sdkxdwr
created_at: 2026-08-10T19:26:01.234Z
updated_at: 2026-08-10T19:26:01.234Z
---
bead-web.ts sortIssues tiebreaks equal-priority/equal-timestamp rows by display id; ListHandler.sortIssues (list.ts:266) tiebreaks by extractUlidFromInternalId, and ready.ts sorts by priority then internal id. Same query can order ties differently than the CLI. Fix: tiebreak on extractUlidFromInternalId(issue.id) to match.
