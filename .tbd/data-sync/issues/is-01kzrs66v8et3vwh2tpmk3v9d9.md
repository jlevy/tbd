---
type: is
id: is-01kzrs66v8et3vwh2tpmk3v9d9
title: "Phase 3: productize tbd web server, wake pipeline, and CLI lifecycle"
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - pr-207
dependencies:
  - type: blocks
    target: is-01kzrs6dd1abehychzed2yc1fk
parent_id: is-01kzn5wbxkb6c0db6k19wj7yzj
child_order_hints:
  - is-01kzrs7qw8qv2ynt64n9c2w0y6
  - is-01kzrs7yrc2hjjks6qc38mhc2y
  - is-01kzrs87qg5tssg8p41wpj3kwj
  - is-01kzrs8gb1ky34vpdv7qfdfv4q
  - is-01kzrs8phwbdy9hdkxm6c6k8pe
created_at: 2026-08-11T16:06:17.703Z
updated_at: 2026-08-11T16:07:39.323Z
---
Implement src/cli/commands/web.ts and src/cli/web/{server,board,wake,http}.ts per the spec: loopback-only, read-only, in-process watch + issue pull, SSE resume/backpressure, bounded lifecycle, port search, readiness-gated --open, strict validation, and focused lifecycle/security tests.
