---
type: is
id: is-01kxz3mgdhc9j6ys7brk59z96e
title: "Phase 3: coordination pilot on shipped watch — last_actor in reports, dispatch conventions, QA playbook"
kind: feature
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies: []
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:54.961Z
updated_at: 2026-08-15T05:33:51.894Z
closed_at: 2026-08-15T05:33:51.894Z
close_reason: "The legacy PR #197 integration design was superseded by the active external-tracker plan and the production implementation merged in PR #206."
---
The watch itself shipped in PR #196 (tbd changes + tbd watch, blocking one-shot with --since chaining) — this phase only composes with it. (1) Verify last_actor (Phase 0 field) surfaces in tbd changes/tbd watch field deltas so woken agents skip their own and the bridge's writes; add to the normative change-field list if needed. (2) QA playbook: full Linear → bead → agent → Linear loop using the watch-beads shortcut's watch-then-spawn recipe + tbd bridge sync on cron, two agents + bridge concurrent, no echo/ping-pong. (3) Document dispatch conventions (assignee=agent, label=mode, status=lifecycle) in tbd-docs, watch-beads shortcut, and skill docs. Spec Design §6/§6a, Phase 3.

## Notes

Deferred legacy scope from the provider plan on PR #197. Do not implement the description as written: core config/schema/tbd-sync coupling is superseded by the active Integration Layer rules. tbd-vm5s will replace, split, close, or re-spec this bead after a provider-isolated Linear plan exists. This is not a PR #205 or watch-release blocker.
