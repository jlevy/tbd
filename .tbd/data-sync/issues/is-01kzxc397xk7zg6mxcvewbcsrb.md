---
type: is
id: is-01kzxc397xk7zg6mxcvewbcsrb
title: Do not replay outbound integration intents during sync --pull
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T10:53:42.524Z
updated_at: 2026-08-13T11:49:49.483Z
closed_at: 2026-08-13T11:49:49.483Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
PR #206 thread PRRT_kwDOQ109P86YTR1E: runSync replayed pending provider mutations before honoring inbound direction, so --pull could write externally. In inbound-only mode leave existing journals untouched, do not plan redundant new outbound intents, preserve suppressed local divergence/base semantics, and prove the provider remains unchanged while the next full sync pushes the durable local change. This bead is the fixed disposition for the formal review thread.
