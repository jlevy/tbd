---
type: is
id: is-01m2esegb93vkm6se4pc0gsn5h
title: Invalid identity.agent_map now fails integration commands after the agent_map fix; validate at config load
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m0c4z87m3kd0cyw2qkd5k6z4
created_at: 2026-09-14T01:45:30.728Z
updated_at: 2026-09-14T01:45:34.589Z
---
Behavior change in PR #283 (tbd-w3tv). On main, resolveProviderSettings never forwarded identity.agent_map, so any value was ignored. With the fix (provider-settings.ts:150, integration-runner.ts:91) the map reaches the LinearAdapter constructor, which throws for an empty agent name or a non-UUID app user id (linear/adapter.ts:214-222). The config schema accepts any string record (lib/schemas.ts:901), so a repository that carries a placeholder or malformed agent_map starts failing `tbd integration sync`, `integration setup`, and `integration link` after upgrade, and `tbd sync` reports the tracker fold as failed.

Fix: validate agent_map at config load (schema refinement or provider-settings) with the same messages, add a doctor check naming the key, and list it in the release notes. Red first: a config with `agent_map: { bot: not-a-uuid }` fails `tbd doctor` with the key name rather than an adapter stack.
