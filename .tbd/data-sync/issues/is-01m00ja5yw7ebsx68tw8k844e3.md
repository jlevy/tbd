---
type: is
id: is-01m00ja5yw7ebsx68tw8k844e3
title: tbd sync --push silently performs the outbound-only mirror the docs warn against
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:40:03.292Z
updated_at: 2026-08-15T08:16:57.363Z
closed_at: 2026-08-15T08:16:57.363Z
close_reason: tbd sync --push now narrows away from the tracker like any other surface flag, with the honesty notice pointing at 'tbd integration sync --push'. --push --integrations remains the deliberate two-flag form. The e2e test that asserted the old behavior by name was rewritten to pin the new contract.
---
tbd sync --push calls runEnabledIntegrationPushes (sync.ts:205) — the same one-way projection as tbd integration sync --push, with no three-way reconcile.

The setup-linear shortcut warns joiners in bold never to run that command: 'The outbound-only path projects local bead values over the tracker without a three-way reconcile, so it can overwrite a teammate's Linear-side edit that a full sync would have detected and reported as a conflict.' The warning names only 'integration sync --push'. But 'tbd sync --push' is a far more natural thing for an agent to type, carries no warning, and does the same thing.

Fix: give it the same guard the shortcut prescribes, or make it run the full reconcile in the outbound direction. A natural-looking flag should not be the dangerous one.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F6, §1.2, E12
