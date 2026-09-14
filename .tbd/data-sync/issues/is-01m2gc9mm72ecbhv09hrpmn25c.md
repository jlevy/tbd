---
type: is
id: is-01m2gc9mm72ecbhv09hrpmn25c
title: "PR #287 review R2: dry-run tracker notice fires with no config check"
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
created_at: 2026-09-14T16:34:08.646Z
updated_at: 2026-09-14T16:40:12.225Z
started_at: 2026-09-14T16:35:57.870Z
closed_at: 2026-09-14T16:40:12.224Z
close_reason: |-
  Fixed. The dry-run branch now reads config and computes inert (!syncFoldPosture(resolveSyncFoldMode(...)).runs || integrationsInert(config)) before emitting, matching both neighbours at sync.ts:167-172 and :295-301.

  Confirmed against this very repository, which is the case the finding describes: .tbd/config.yml has on_tbd_sync: off, so tbd sync never touches the tracker here — yet before this fix every tbd sync --dry-run printed a notice telling the user to go run a tracker command. It is now correctly silent here, and prints in a scratch repo with the fold enabled.
resolution: null
duplicate_of: null
---
cli/commands/sync.ts:279. The notice fires whenever syncIntegrations is true, with no integrationsInert/posture check, so every repo with no tracker configured gets it on every 'tbd sync --dry-run', pointing at a command that does nothing for them. Both neighbours gate first: sync.ts:167-172 and sync.ts:295-301. Fix: hoist readConfig + syncFoldPosture + integrationsInert above both branches and gate the notice on !inert.
