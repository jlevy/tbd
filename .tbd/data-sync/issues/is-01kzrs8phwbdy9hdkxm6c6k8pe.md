---
type: is
id: is-01kzrs8phwbdy9hdkxm6c6k8pe
title: "Phase 3.5: register WebHandler CLI surface and process lifecycle"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - cli
  - lifecycle
  - web
dependencies:
  - type: blocks
    target: is-01kzrs9mb24gzv94d2mvexqnbd
parent_id: is-01kzrs66v8et3vwh2tpmk3v9d9
created_at: 2026-08-11T16:07:39.323Z
updated_at: 2026-08-11T16:08:09.825Z
---
Create packages/tbd/src/cli/commands/web.ts and register it lazily in cli.ts. Validate --port and --interval with exit 2; implement --open readiness-gated launch, --dry-run without bind, text/JSON startup descriptor via OutputManager, explicit SIGINT=130/SIGTERM lifecycle with process.once and second-signal force exit, actionable operational errors, and unchanged startup cost for other commands. Add built-CLI tests and tryscript help/dry-run coverage.
