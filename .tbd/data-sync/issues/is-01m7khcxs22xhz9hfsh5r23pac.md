---
type: is
id: is-01m7khcxs22xhz9hfsh5r23pac
title: "PR #332 D7: Remove the unreachable Codex customized hook role"
kind: chore
status: closed
priority: 3
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-11-17T01:19:31.618Z
updated_at: 2026-11-17T02:11:26.165Z
started_at: 2026-11-17T01:19:50.414Z
closed_at: 2026-11-17T02:11:26.165Z
close_reason: "fixed on #332 by the owning session (5f109845, e7add9fc)"
resolution: null
duplicate_of: null
---
Review D (Low). CODEX_HOOK_ANCHORS is empty (packages/tbd/src/cli/lib/hook-commands.ts:40), so the Codex customized role, filled, codexSlotKey, unfilledCodexHooks, CodexHooksInspection.customized, the setup note near setup.ts:3676 and doctor.ts:2330-2332 are unreachable. Fix: classify a Codex handler as tbd's or the user's. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
