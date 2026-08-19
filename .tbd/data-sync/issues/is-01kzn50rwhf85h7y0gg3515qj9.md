---
type: is
id: is-01kzn50rwhf85h7y0gg3515qj9
title: "integrations/core/credentials.ts: resolveCredential + maskSecret"
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50shqxerds5m8kxpwmxc4
  - type: blocks
    target: is-01kzn50tnf2yx0ndsgpfqw91mb
  - type: blocks
    target: is-01kzn514mxmazhwq9fn1qpcpvt
parent_id: is-01kzn2w8hvc83qrgk9h70rf73y
created_at: 2026-08-10T06:16:04.752Z
updated_at: 2026-08-10T17:35:53.842Z
closed_at: 2026-08-10T17:35:53.842Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
ResolvedCredential { value, source: 'env'|'dotenv'|'gh-cli' }. resolveCredential(provider, repoRoot) resolution order: process env (LINEAR_API_KEY/GITHUB_TOKEN), then .env via readEnvFile, then gh auth token (GitHub only). maskSecret(value) shows last 4 only. Credentials travel only through ResolvedCredential, never process.env, never bridge state, never logs or --json. Spec Component 1.
