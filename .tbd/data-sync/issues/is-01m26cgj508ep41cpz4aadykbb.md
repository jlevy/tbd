---
type: is
id: is-01m26cgj508ep41cpz4aadykbb
title: Document bidirectional Linear assignee resolution accurately
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T19:25:31.163Z
updated_at: 2026-09-10T20:20:02.845Z
started_at: 2026-09-10T19:35:40.116Z
closed_at: 2026-09-10T20:20:02.845Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Current docs overstate identity.user_map as required for outbound assignees. Shipped adapter first honors explicit mapping, then stable bridge bindings and exact Linear member-directory resolution; unknown inbound identities still require mapping. Correct all current user-facing and design surfaces.
