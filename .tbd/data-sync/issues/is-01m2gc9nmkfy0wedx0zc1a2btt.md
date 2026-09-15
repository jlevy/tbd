---
type: is
id: is-01m2gc9nmkfy0wedx0zc1a2btt
title: "PR #287 review R4: false determinism claim in import comment"
kind: bug
status: closed
priority: 2
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
parent_id: is-01m2gc9377byvp9mbna5c70bvp
hold: null
hold_until: null
created_at: 2026-09-14T16:34:09.683Z
updated_at: 2026-09-14T16:40:12.740Z
started_at: 2026-09-14T16:38:46.296Z
closed_at: 2026-09-14T16:40:12.740Z
close_reason: "Fixed: comment rewritten. The claim that two clones compute the same replacement was false — generateInternalId mints a fresh random ULID per run (lib/ids.ts:116-118), so the derived short ID differs per clone either way. The comment now states the property actually gained: agreement with resolveDuplicateShortIds (file/id-mapping.ts:245-254), which recomputes displaced short ids from the ULID the same way, so a displaced bead already sits where a later ids.yml repair would put it. The PR description carries the same correction."
resolution: null
duplicate_of: null
---
cli/commands/import.ts:592-593 and the PR description. The comment claims the derived short ID means two clones importing the same file compute the same replacement. False: generateInternalId() (lib/ids.ts:116-118) mints a fresh random ULID per run, so the derived id differs per clone. The real property gained over generateUniqueShortId is agreement with resolveDuplicateShortIds (file/id-mapping.ts:245-254), which recomputes from the ULID if two clones' ids.yml later collide. Fix: state the real property; correct the PR description.
