---
type: is
id: is-01kzn50rjq62yqzncaw571hx87
title: "lib/env-file.ts: readEnvFile + checkEnvIgnored, engines >=20.12"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50rwhf85h7y0gg3515qj9
parent_id: is-01kzn2w8hvc83qrgk9h70rf73y
created_at: 2026-08-10T06:16:04.438Z
updated_at: 2026-08-10T17:35:53.829Z
closed_at: 2026-08-10T17:35:53.828Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
readEnvFile(repoRoot): Promise<Map<string,string>> using Node built-in util.parseEnv (no new dependency). checkEnvIgnored(repoRoot): git check-ignore .env. MUST NOT write into process.env: buildGitEnv() in lib/git-env.ts spreads process.env into every git subprocess and git runs user hooks, so a secret there leaks to all hooks. Bump engines.node from >=20 to >=20.12 (util.parseEnv floor) in packages/tbd/package.json. Tests: fixture parsing (quotes, comments, export prefix), precedence, and a no-process.env-mutation invariant. Spec Dependencies + Component 1.
