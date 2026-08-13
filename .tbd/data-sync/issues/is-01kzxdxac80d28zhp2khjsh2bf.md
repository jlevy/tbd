---
type: is
id: is-01kzxdxac80d28zhp2khjsh2bf
title: Make tbd sync --push use outbound integration projection
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - pr-review
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:25:24.231Z
updated_at: 2026-08-13T11:49:49.540Z
closed_at: 2026-08-13T11:49:49.540Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
PR #206 thread PRRT_kwDOQ109P86YTR1T: Surface 3 maps --pull to inbound but maps --push to direction both, so tbd sync --push can pull tracker edits and inbound-create beads despite the documented global direction contract. Extract the existing integration projection into a shared locked runner, call it before the issue push when possible and as the contained fallback otherwise, preserve bulk affirmation, and prove the built CLI never reads remote changes into beads under --push.
