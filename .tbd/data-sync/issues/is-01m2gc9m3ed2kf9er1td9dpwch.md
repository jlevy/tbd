---
type: is
id: is-01m2gc9m3ed2kf9er1td9dpwch
title: "PR #287 review R1: sync dry-run notice is invisible under --json"
kind: bug
status: closed
priority: 1
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
parent_id: is-01m2gc9377byvp9mbna5c70bvp
hold: null
hold_until: null
created_at: 2026-09-14T16:34:08.109Z
updated_at: 2026-09-14T16:40:11.749Z
started_at: 2026-09-14T16:35:57.429Z
closed_at: 2026-09-14T16:40:11.749Z
close_reason: |-
  Fixed. The notice now passes structured data — notice(msg, { skippedSurfaces: ['integrations'], reason: 'dry-run' }) — so it survives --json, matching the surface-narrowing notice at sync.ts:173-181 that solved this for the adjacent case. The finding was correct and my original comment was worse than wrong: it claimed 'same reasoning as the surface-narrowing notice above' while omitting the payload that makes the reasoning hold.

  Verified in a scratch repo with linear enabled and on_tbd_sync: guarded — text mode prints the notice; --json puts {"skippedSurfaces":["integrations"],"reason":"dry-run"} on stderr with stdout clean.

  Test gap closed too: 5 new cases in tests/cli-sync-surface-honesty.tryscript.md, including the JSONL diagnostic assertion. Verified red by removing the payload and re-running: 'JSON mode carries the unevaluated surface as a structured diagnostic' fails, 20 passed / 1 failed. 21 pass with it.
resolution: null
duplicate_of: null
---
cli/commands/sync.ts:283-286. notice(message) with no jsonData emits NOTHING under --json (cli/lib/output.ts:405-413 writes only when jsonData !== undefined). So tbd-uygb's defect survives in the mode agents actually run: 'tbd sync --dry-run --json' and '--integrations --dry-run --json' still exit 0 with no tracker mention. The adjacent notice at sync.ts:173-181 passes { skippedSurfaces: ['integrations'] } for exactly this reason, and tests/cli-sync-surface-honesty.tryscript.md:108-123 pins that stderr-JSONL contract. The new notice also has no test. Fix: pass structured jsonData and add text + --json tryscript cases.
