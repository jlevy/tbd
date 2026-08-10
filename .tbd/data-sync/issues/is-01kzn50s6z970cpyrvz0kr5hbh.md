---
type: is
id: is-01kzn50s6z970cpyrvz0kr5hbh
title: "lib/schemas.ts + core/registry.ts: IntegrationsConfigSchema and provider registry"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50shqxerds5m8kxpwmxc4
  - type: blocks
    target: is-01kzn50xxkvctdk2803abt4aaz
parent_id: is-01kzn2w8hvc83qrgk9h70rf73y
created_at: 2026-08-10T06:16:05.086Z
updated_at: 2026-08-10T06:16:09.906Z
---
IntegrationsConfigSchema: { sync_on_tbd_sync, linear: { enabled, team_key, select: { kinds, statuses, labels, linked }, create_labels, max_nesting, user_map } }. Optional on ConfigSchema so existing configs are untouched. registry.ts: providerFor(refOrName) inferring provider from ref shape (FIN-123, Linear URL, owner/repo#123) and configured() listing enabled providers. Spec Component 6.
