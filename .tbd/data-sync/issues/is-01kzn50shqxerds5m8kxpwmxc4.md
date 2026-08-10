---
type: is
id: is-01kzn50shqxerds5m8kxpwmxc4
title: "cli/commands/integration.ts: command group scaffold + status subcommand"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50sw125xdztxh9rqhm5mp
  - type: blocks
    target: is-01kzn510a0s6yafgt5j1x9nyss
parent_id: is-01kzn2w8hvc83qrgk9h70rf73y
created_at: 2026-08-10T06:16:05.430Z
updated_at: 2026-08-10T17:35:53.927Z
closed_at: 2026-08-10T17:35:53.927Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
Command group on BaseCommand (this.ctx, this.output.data(json, textFn), CLIError, shared exit codes). status probes per provider: configured, credential (present/source/mask), .env gitignore hygiene, credential valid (Linear: { viewer { id } }), target resolvable (team key -> UUID), meta cache age, link count, drift count. Every failure carries a one-line remedy. Exit 0 when healthy OR validly unconfigured (with setup guidance); 1 on probe failure. Spec Component 2.
